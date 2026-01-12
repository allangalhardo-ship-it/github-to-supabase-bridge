import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found - user is in trial period based on account creation");
      
      // Check if user is still in trial based on account creation date
      let daysSinceCreation = 0;
      let trialDaysRemaining = 7;
      let isInTrial = true;

      if (user.created_at) {
        const createdAt = new Date(user.created_at);
        if (!isNaN(createdAt.getTime())) {
          const now = new Date();
          daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          trialDaysRemaining = Math.max(0, 7 - daysSinceCreation);
          isInTrial = trialDaysRemaining > 0;
        }
      }
      return new Response(JSON.stringify({
        subscribed: false,
        status: isInTrial ? "trialing" : "expired",
        trial_days_remaining: trialDaysRemaining,
        subscription_end: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
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
    const activeSubscription = subscriptions.data.find(
      (sub: { status: string }) => sub.status === "active" || sub.status === "trialing"
    );

    if (activeSubscription) {
      const subscriptionEnd = safeUnixToIso((activeSubscription as any).current_period_end);
      const trialEnd = safeUnixToIso((activeSubscription as any).trial_end);

      let trialDaysRemaining = 0;
      if (activeSubscription.status === "trialing" && trialEnd) {
        const trialEndMs = Date.parse(trialEnd);
        if (Number.isFinite(trialEndMs)) {
          trialDaysRemaining = Math.max(
            0,
            Math.ceil((trialEndMs - Date.now()) / (1000 * 60 * 60 * 24))
          );
        }
      }

      logStep("Active subscription found", {
        subscriptionId: (activeSubscription as any).id,
        status: (activeSubscription as any).status,
        subscriptionEnd,
        trialEnd,
        trialDaysRemaining,
      });

      return new Response(
        JSON.stringify({
          subscribed: ((activeSubscription as any).status === "active"),
          status: (activeSubscription as any).status,
          subscription_end: subscriptionEnd,
          trial_end: trialEnd,
          trial_days_remaining: trialDaysRemaining,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // No active subscription - check if in free trial period (7 days from account creation)
    let daysSinceCreation = 0;
    let trialDaysRemaining = 7;
    let isInTrial = true;

    if (user.created_at) {
      const createdAt = new Date(user.created_at);
      if (!isNaN(createdAt.getTime())) {
        const now = new Date();
        daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        trialDaysRemaining = Math.max(0, 7 - daysSinceCreation);
        isInTrial = trialDaysRemaining > 0;
      }
    }

    logStep("No active subscription", { daysSinceCreation, trialDaysRemaining, isInTrial });

    return new Response(JSON.stringify({
      subscribed: false,
      status: isInTrial ? "trialing" : "expired",
      trial_days_remaining: trialDaysRemaining,
      subscription_end: null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
