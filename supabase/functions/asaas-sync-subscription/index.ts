import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_URL = "https://api.asaas.com/v3";

type ExternalReference = {
  user_id?: string;
  plan?: string;
  billing_cycle?: "MONTHLY" | "YEARLY";
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ASAAS-SYNC-SUBSCRIPTION] ${step}${detailsStr}`);
};

const parseExternalReference = (ref: unknown): ExternalReference | null => {
  if (!ref || typeof ref !== "string") return null;
  try {
    return JSON.parse(ref);
  } catch {
    return null;
  }
};

const hasConfirmedPayment = (paymentsData: any): boolean => {
  const payments = Array.isArray(paymentsData?.data) ? paymentsData.data : [];
  return payments.some((p: any) =>
    ["RECEIVED", "CONFIRMED"].includes(String(p?.status || "").toUpperCase())
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No authorization header provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate JWT & get claims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido ou expirado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email as string | undefined;
    if (!userEmail) throw new Error("User email not available in token");

    logStep("User authenticated", { userId, userEmail });

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) throw new Error("ASAAS_API_KEY not configured");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // 1) Find Asaas customer by email
    const customerResp = await fetch(
      `${ASAAS_API_URL}/customers?email=${encodeURIComponent(userEmail)}`,
      {
        headers: {
          access_token: asaasApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!customerResp.ok) {
      const body = await customerResp.text();
      logStep("Customer search failed", { status: customerResp.status, body });
      throw new Error("Erro ao buscar cliente no Asaas");
    }

    const customerData = await customerResp.json();
    const customerId = customerData?.data?.[0]?.id as string | undefined;
    if (!customerId) {
      logStep("No customer found", { userEmail });
      return new Response(
        JSON.stringify({ found: false, reason: "no_customer" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 2) List subscriptions for that customer
    const subsResp = await fetch(
      `${ASAAS_API_URL}/subscriptions?customer=${encodeURIComponent(customerId)}`,
      {
        headers: {
          access_token: asaasApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!subsResp.ok) {
      const body = await subsResp.text();
      logStep("Subscriptions list failed", { status: subsResp.status, body });
      throw new Error("Erro ao buscar assinaturas no Asaas");
    }

    const subsData = await subsResp.json();
    const subs = Array.isArray(subsData?.data) ? subsData.data : [];

    if (subs.length === 0) {
      logStep("No subscriptions found", { customerId });
      return new Response(
        JSON.stringify({ found: false, reason: "no_subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Prefer ACTIVE subscription, else fallback to first
    const subscription = subs.find((s: any) => String(s?.status).toUpperCase() === "ACTIVE") ?? subs[0];
    const subscriptionId = subscription?.id as string | undefined;

    if (!subscriptionId) {
      logStep("Subscription missing id", { customerId });
      throw new Error("Assinatura inválida retornada pelo Asaas");
    }

    const externalRef = parseExternalReference(subscription?.externalReference);
    if (externalRef?.user_id && externalRef.user_id !== userId) {
      logStep("Subscription user mismatch", { expected: userId, got: externalRef.user_id });
      return new Response(
        JSON.stringify({ found: false, reason: "subscription_user_mismatch" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const plan = (externalRef?.plan === "pro" ? "pro" : "standard") as "standard" | "pro";

    // Save subscription id & plan
    const { error: updateError } = await supabaseAdmin
      .from("usuarios")
      .update({
        asaas_subscription_id: subscriptionId,
        asaas_plan: plan,
      })
      .eq("id", userId);

    if (updateError) {
      logStep("DB update error", { error: updateError });
      throw new Error("Erro ao atualizar usuário no banco");
    }

    // 3) Check payments to confirm it was paid
    let confirmedPayment = false;
    try {
      const paymentsResp = await fetch(
        `${ASAAS_API_URL}/payments?subscription=${encodeURIComponent(subscriptionId)}`,
        {
          headers: {
            access_token: asaasApiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (paymentsResp.ok) {
        const paymentsData = await paymentsResp.json();
        confirmedPayment = hasConfirmedPayment(paymentsData);
      } else {
        logStep("Payments check failed", { status: paymentsResp.status });
      }
    } catch (err) {
      logStep("Payments check error", { error: String(err) });
    }

    // If paid, persist end dates for better UX (same structure used by webhook)
    if (confirmedPayment && subscription?.nextDueDate) {
      const subscriptionEndISO = new Date(subscription.nextDueDate).toISOString();

      const { error: datesError } = await supabaseAdmin
        .from("usuarios")
        .update({
          trial_end_override: subscriptionEndISO,
          asaas_subscription_end: subscriptionEndISO,
        })
        .eq("id", userId);

      if (datesError) {
        logStep("DB dates update error", { error: datesError });
      }
    }

    logStep("Sync completed", { subscriptionId, plan, confirmedPayment });

    return new Response(
      JSON.stringify({
        found: true,
        subscriptionId,
        plan,
        status: subscription?.status ?? null,
        nextDueDate: subscription?.nextDueDate ?? null,
        confirmedPayment,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
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
