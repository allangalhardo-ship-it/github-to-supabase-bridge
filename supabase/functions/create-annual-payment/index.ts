import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Planos anuais (pagamento único) - desconto de 2 meses
const ANNUAL_PRICES = {
  standard: "price_1SrfKQJJFSKyfswgCbXUo3kh", // R$399,00 (10x R$39,90)
  pro: "price_1SrfKjJJFSKyfswgClsQwiRe", // R$599,00 (10x R$59,90)
} as const;

type PlanType = keyof typeof ANNUAL_PRICES;

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-ANNUAL-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Parse request body
    let plan: PlanType = "standard";
    try {
      const body = await req.json();
      if (body.plan && (body.plan === "standard" || body.plan === "pro")) {
        plan = body.plan;
      }
    } catch {
      // No body or invalid JSON - use default plan
    }

    logStep("Plan selected", { plan });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    const origin = req.headers.get("origin") || "https://lovable.dev";

    // Get price_id based on plan
    const priceId = ANNUAL_PRICES[plan];
    logStep("Using price", { plan, priceId });

    // Create one-time payment session with Pix + Card
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/pagamento-sucesso?annual=true&plan=${plan}`,
      cancel_url: `${origin}/assinatura?checkout=canceled`,
      billing_address_collection: "required",
      locale: "pt-BR",
      // Cartão e boleto (Pix requer ativação manual no Stripe Dashboard)
      payment_method_types: ["card", "boleto"],
      metadata: {
        user_id: user.id,
        plan: plan,
        type: "annual",
      },
    });

    logStep("Payment session created", { sessionId: session.id, plan });

    return new Response(JSON.stringify({ url: session.url }), {
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
