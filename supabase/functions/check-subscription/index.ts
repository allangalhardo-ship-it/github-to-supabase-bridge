import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PlanType = "standard" | "pro" | null;

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Usar ambiente sandbox para testes, produção para live
const ASAAS_API_URL = "https://api.asaas.com/v3";
// Para testes use: const ASAAS_API_URL = "https://sandbox.asaas.com/api/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("No authorization header provided");
    }

    // Create Supabase client with auth header
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Use getClaims to validate JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      throw new Error("Token inválido ou expirado");
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email as string;
    
    if (!userEmail) throw new Error("User email not available in token");

    // Get user creation date and subscription data from service role client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userCreatedAt = userData?.user?.created_at;

    // Check for subscription data in usuarios table
    const { data: usuarioData } = await supabaseAdmin
      .from("usuarios")
      .select("trial_end_override, asaas_subscription_id, asaas_plan, asaas_subscription_end")
      .eq("id", userId)
      .maybeSingle();
    
    const trialEndOverride = usuarioData?.trial_end_override;
    const asaasSubscriptionId = usuarioData?.asaas_subscription_id;
    const asaasPlan = usuarioData?.asaas_plan as PlanType;
    const asaasSubscriptionEnd = usuarioData?.asaas_subscription_end;

    logStep("User authenticated", { userId, email: userEmail, hasAsaasSubscription: !!asaasSubscriptionId });

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");

    // Check Asaas subscription if available
    if (asaasApiKey && asaasSubscriptionId) {
      logStep("Checking Asaas subscription", { subscriptionId: asaasSubscriptionId });
      
      try {
        const subscriptionResp = await fetch(
          `${ASAAS_API_URL}/subscriptions/${asaasSubscriptionId}`,
          {
            headers: {
              "access_token": asaasApiKey,
              "Content-Type": "application/json",
            },
          }
        );

        if (subscriptionResp.ok) {
          const subscriptionData = await subscriptionResp.json();
          
          // Status do Asaas: ACTIVE, INACTIVE, EXPIRED
          if (subscriptionData.status === "ACTIVE") {
            // Confirmar se existe pagamento confirmado/recebido para essa assinatura
            let hasConfirmedPayment = false;
            try {
              const paymentsResp = await fetch(
                `${ASAAS_API_URL}/payments?subscription=${asaasSubscriptionId}`,
                {
                  headers: {
                    "access_token": asaasApiKey,
                    "Content-Type": "application/json",
                  },
                }
              );

              if (paymentsResp.ok) {
                const paymentsData = await paymentsResp.json();
                const payments = Array.isArray(paymentsData?.data) ? paymentsData.data : [];

                hasConfirmedPayment = payments.some((p: any) =>
                  ["RECEIVED", "CONFIRMED"].includes(String(p?.status || "").toUpperCase())
                );

                logStep("Payments checked", {
                  subscriptionId: asaasSubscriptionId,
                  paymentsCount: payments.length,
                  hasConfirmedPayment,
                });
              } else {
                logStep("Payments check failed", { status: paymentsResp.status });
              }
            } catch (paymentsError) {
              logStep("Payments check error", { error: String(paymentsError) });
            }

            if (!hasConfirmedPayment) {
              logStep("Subscription ACTIVE but no confirmed payment yet", { subscriptionId: asaasSubscriptionId });
              // Não libera como ativa ainda; segue para fallback (trial / override)
            } else {
              // Calculate subscription end based on cycle
              let subscriptionEnd = asaasSubscriptionEnd;
              if (!subscriptionEnd) {
                const nextDue = new Date(subscriptionData.nextDueDate);
                subscriptionEnd = nextDue.toISOString();
              }

              logStep("Active Asaas subscription found", {
                status: subscriptionData.status,
                plan: asaasPlan,
                subscriptionEnd,
              });

              return new Response(
                JSON.stringify({
                  subscribed: true,
                  status: "active",
                  plan: asaasPlan || "standard",
                  subscription_end: subscriptionEnd,
                  trial_end: null,
                  trial_days_remaining: 0,
                }),
                {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                  status: 200,
                }
              );
            }
          }
        }
      } catch (asaasError) {
        logStep("Error checking Asaas subscription", { error: String(asaasError) });
      }
    }

    // Check trial_end_override (used for both Asaas webhook and manual extension)
    if (trialEndOverride) {
      const overrideDate = new Date(trialEndOverride);
      if (!isNaN(overrideDate.getTime())) {
        const now = new Date();
        const daysRemaining = Math.max(0, Math.ceil((overrideDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        
        if (daysRemaining > 0) {
          // Still has access (subscription or extended trial)
          logStep("Active via trial_end_override", { daysRemaining, overrideDate: trialEndOverride, plan: asaasPlan });
          
          return new Response(
            JSON.stringify({
              subscribed: !!asaasPlan,
              status: asaasPlan ? "active" : "trialing",
              plan: asaasPlan || null,
              subscription_end: trialEndOverride,
              trial_end: !asaasPlan ? trialEndOverride : null,
              trial_days_remaining: !asaasPlan ? daysRemaining : 0,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      }
    }

    // Calculate free trial based on user creation date
    let trialDaysRemaining = 7;
    let isInTrial = true;

    if (userCreatedAt) {
      const createdAt = new Date(userCreatedAt);
      if (!isNaN(createdAt.getTime())) {
        const now = new Date();
        const daysSinceCreation = Math.floor(
          (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        trialDaysRemaining = Math.max(0, 7 - daysSinceCreation);
        isInTrial = trialDaysRemaining > 0;
      }
    }

    logStep("No active subscription - checking trial", { trialDaysRemaining, isInTrial });

    return new Response(
      JSON.stringify({
        subscribed: false,
        status: isInTrial ? "trialing" : "expired",
        plan: null,
        trial_days_remaining: trialDaysRemaining,
        subscription_end: null,
        trial_end: null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
