import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento de price_id para plano
const PLANS = {
  // Standard - R$39,90/mês
  "price_1SrH5yJJFSKyfswgikoVQaB7": "standard",
  // Pro - R$59,90/mês
  "price_1SrH6AJJFSKyfswgGqVwFLMq": "pro",
  // Plano antigo (manter compatibilidade como standard)
  "price_1SpYGQJJFSKyfswgoBtbkbxN": "standard",
} as const;

type PlanType = "standard" | "pro" | null;

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

const safeUnixToIso = (value: unknown): string | null => {
  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  try {
    const d = new Date(seconds * 1000);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  } catch {
    return null;
  }
};

const getPlanFromPriceId = (priceId: string | undefined): PlanType => {
  if (!priceId) return null;
  return PLANS[priceId as keyof typeof PLANS] || "standard";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

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

    // Get user creation date and trial override from service role client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userCreatedAt = userData?.user?.created_at;

    // Check for trial_end_override in usuarios table
    const { data: usuarioData } = await supabaseAdmin
      .from("usuarios")
      .select("trial_end_override")
      .eq("id", userId)
      .maybeSingle();
    
    const trialEndOverride = usuarioData?.trial_end_override;

    logStep("User authenticated", { userId, email: userEmail });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check for existing customer
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No customer found - checking trial status");

      // Calculate trial based on override or creation date
      let trialDaysRemaining = 7;
      let isInTrial = true;

      if (trialEndOverride) {
        // Use override date
        const overrideDate = new Date(trialEndOverride);
        if (!isNaN(overrideDate.getTime())) {
          const now = new Date();
          trialDaysRemaining = Math.max(0, Math.ceil((overrideDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          isInTrial = trialDaysRemaining > 0;
        }
      } else if (userCreatedAt) {
        // Default: 7 days from creation
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

      return new Response(
        JSON.stringify({
          subscribed: false,
          status: isInTrial ? "trialing" : "expired",
          plan: null, // Sem plano durante trial gratuito
          trial_days_remaining: trialDaysRemaining,
          subscription_end: null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check for active or trialing subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });

    // Find active or trialing subscription
    const activeSubscription = subscriptions.data.find((sub: { status: string }) =>
      sub.status === "active" || sub.status === "trialing"
    );

    if (activeSubscription) {
      const subscriptionEnd = safeUnixToIso((activeSubscription as any).current_period_end);
      const trialEnd = safeUnixToIso((activeSubscription as any).trial_end);

      // Get plan from price_id
      const priceId = (activeSubscription as any).items?.data?.[0]?.price?.id;
      const plan = getPlanFromPriceId(priceId);

      let trialDaysRemaining = 0;
      if ((activeSubscription as any).status === "trialing" && trialEnd) {
        const trialEndMs = Date.parse(trialEnd);
        if (Number.isFinite(trialEndMs)) {
          trialDaysRemaining = Math.max(
            0,
            Math.ceil((trialEndMs - Date.now()) / (1000 * 60 * 60 * 24)),
          );
        }
      }

      logStep("Active subscription found", {
        subscriptionId: (activeSubscription as any).id,
        status: (activeSubscription as any).status,
        plan,
        priceId,
        subscriptionEnd,
        trialEnd,
        trialDaysRemaining,
      });

      return new Response(
        JSON.stringify({
          subscribed:
            (activeSubscription as any).status === "active" ||
            (activeSubscription as any).status === "trialing",
          status: (activeSubscription as any).status,
          plan,
          subscription_end: subscriptionEnd,
          trial_end: trialEnd,
          trial_days_remaining: trialDaysRemaining,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // No active subscription - check if in free trial period
    let trialDaysRemaining = 7;
    let isInTrial = true;

    if (trialEndOverride) {
      // Use override date
      const overrideDate = new Date(trialEndOverride);
      if (!isNaN(overrideDate.getTime())) {
        const now = new Date();
        trialDaysRemaining = Math.max(0, Math.ceil((overrideDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        isInTrial = trialDaysRemaining > 0;
      }
    } else if (userCreatedAt) {
      // Default: 7 days from creation
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

    logStep("No active subscription", { trialDaysRemaining, isInTrial, hasOverride: !!trialEndOverride });

    return new Response(
      JSON.stringify({
        subscribed: false,
        status: isInTrial ? "trialing" : "expired",
        plan: null,
        trial_days_remaining: trialDaysRemaining,
        subscription_end: null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
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
