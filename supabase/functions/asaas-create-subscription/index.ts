import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento de planos para valores
const PLAN_VALUES = {
  standard: { monthly: 39.90, annual: 399.00 },
  pro: { monthly: 59.90, annual: 599.00 },
} as const;

type PlanType = keyof typeof PLAN_VALUES;
type BillingCycle = "MONTHLY" | "YEARLY";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ASAAS-CREATE-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Usar ambiente sandbox para testes, produção para live
const ASAAS_API_URL = "https://api.asaas.com/v3";
// Para testes use: const ASAAS_API_URL = "https://sandbox.asaas.com/api/v3";

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

    // Parse request body
    const body = await req.json();
    const plan: PlanType = body.plan === "pro" ? "pro" : "standard";
    const billingCycle: BillingCycle = body.billingCycle === "YEARLY" ? "YEARLY" : "MONTHLY";
    const cpfCnpj = body.cpfCnpj;
    const name = body.name || user.email.split("@")[0];
    const paymentMethod = body.paymentMethod || "PIX"; // PIX, BOLETO, CREDIT_CARD

    if (!cpfCnpj) {
      throw new Error("CPF/CNPJ é obrigatório para pagamentos");
    }

    logStep("Plan selected", { plan, billingCycle, paymentMethod });

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) {
      throw new Error("ASAAS_API_KEY not configured");
    }

    // 1. Buscar ou criar cliente no Asaas
    logStep("Searching for existing customer");
    const searchCustomerResp = await fetch(
      `${ASAAS_API_URL}/customers?email=${encodeURIComponent(user.email)}`,
      {
        headers: {
          "access_token": asaasApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    const searchCustomerData = await searchCustomerResp.json();
    let customerId: string;

    if (searchCustomerData.data && searchCustomerData.data.length > 0) {
      customerId = searchCustomerData.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      // Criar novo cliente
      logStep("Creating new customer");
      const createCustomerResp = await fetch(`${ASAAS_API_URL}/customers`, {
        method: "POST",
        headers: {
          "access_token": asaasApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name,
          email: user.email,
          cpfCnpj: cpfCnpj.replace(/\D/g, ""),
          notificationDisabled: false,
          externalReference: user.id,
        }),
      });

      if (!createCustomerResp.ok) {
        const errorData = await createCustomerResp.json();
        logStep("Error creating customer", { error: errorData });
        throw new Error(`Erro ao criar cliente: ${JSON.stringify(errorData)}`);
      }

      const customerData = await createCustomerResp.json();
      customerId = customerData.id;
      logStep("Customer created", { customerId });
    }

    // 2. Criar assinatura
    const value = billingCycle === "YEARLY" 
      ? PLAN_VALUES[plan].annual 
      : PLAN_VALUES[plan].monthly;

    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1); // Cobrança começa amanhã
    const dueDateStr = nextDueDate.toISOString().split("T")[0];

    logStep("Creating subscription", { customerId, value, billingCycle, paymentMethod });

    const subscriptionResp = await fetch(`${ASAAS_API_URL}/subscriptions`, {
      method: "POST",
      headers: {
        "access_token": asaasApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: paymentMethod,
        cycle: billingCycle,
        value: value,
        nextDueDate: dueDateStr,
        description: `GastroGestor ${plan.charAt(0).toUpperCase() + plan.slice(1)} - ${billingCycle === "YEARLY" ? "Anual" : "Mensal"}`,
        externalReference: JSON.stringify({
          user_id: user.id,
          plan: plan,
          billing_cycle: billingCycle,
        }),
      }),
    });

    if (!subscriptionResp.ok) {
      const errorData = await subscriptionResp.json();
      logStep("Error creating subscription", { error: errorData });
      throw new Error(`Erro ao criar assinatura: ${JSON.stringify(errorData)}`);
    }

    const subscriptionData = await subscriptionResp.json();
    logStep("Subscription created", { subscriptionId: subscriptionData.id });

    // 3. Buscar o primeiro pagamento para obter o link do Pix
    logStep("Fetching first payment");
    
    // Aguardar um pouco para o Asaas processar
    await new Promise(resolve => setTimeout(resolve, 1000));

    const paymentsResp = await fetch(
      `${ASAAS_API_URL}/payments?subscription=${subscriptionData.id}`,
      {
        headers: {
          "access_token": asaasApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    const paymentsData = await paymentsResp.json();
    let pixQrCode = null;
    let pixCopyPaste = null;
    let boletoUrl = null;
    let paymentId = null;
    let invoiceUrl = null;

    if (paymentsData.data && paymentsData.data.length > 0) {
      paymentId = paymentsData.data[0].id;
      invoiceUrl = paymentsData.data[0].invoiceUrl;
      
      if (paymentMethod === "PIX") {
        // Buscar QR Code do Pix
        const pixResp = await fetch(`${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`, {
          headers: {
            "access_token": asaasApiKey,
            "Content-Type": "application/json",
          },
        });

        if (pixResp.ok) {
          const pixData = await pixResp.json();
          pixQrCode = pixData.encodedImage;
          pixCopyPaste = pixData.payload;
          logStep("PIX QR Code obtained", { paymentId });
        }
      } else if (paymentMethod === "BOLETO") {
        // Para boleto, usar a URL da fatura
        boletoUrl = invoiceUrl;
        logStep("Boleto URL obtained", { paymentId, boletoUrl });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: subscriptionData.id,
        paymentId: paymentId,
        pixQrCode: pixQrCode,
        pixCopyPaste: pixCopyPaste,
        boletoUrl: boletoUrl,
        invoiceUrl: invoiceUrl,
        value: value,
        plan: plan,
        billingCycle: billingCycle,
        paymentMethod: paymentMethod,
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
