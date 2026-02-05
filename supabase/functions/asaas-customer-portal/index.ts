import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ASAAS-CUSTOMER-PORTAL] ${step}${detailsStr}`);
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

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) {
      throw new Error("ASAAS_API_KEY not configured");
    }

    // Buscar cliente no Asaas
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
    
    if (!searchCustomerData.data || searchCustomerData.data.length === 0) {
      throw new Error("Cliente não encontrado no Asaas");
    }

    const customerId = searchCustomerData.data[0].id;
    logStep("Customer found", { customerId });

    // Buscar assinaturas do cliente
    const subscriptionsResp = await fetch(
      `${ASAAS_API_URL}/subscriptions?customer=${customerId}`,
      {
        headers: {
          "access_token": asaasApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    const subscriptionsData = await subscriptionsResp.json();
    const subscriptions = subscriptionsData.data || [];

    // Buscar pagamentos pendentes
    const paymentsResp = await fetch(
      `${ASAAS_API_URL}/payments?customer=${customerId}&status=PENDING`,
      {
        headers: {
          "access_token": asaasApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    const paymentsData = await paymentsResp.json();
    const pendingPayments = paymentsData.data || [];

    logStep("Portal data fetched", { 
      subscriptionsCount: subscriptions.length, 
      pendingPaymentsCount: pendingPayments.length 
    });

    return new Response(
      JSON.stringify({
        success: true,
        customerId,
        subscriptions: subscriptions.map((sub: any) => ({
          id: sub.id,
          status: sub.status,
          value: sub.value,
          cycle: sub.cycle,
          nextDueDate: sub.nextDueDate,
          description: sub.description,
        })),
        pendingPayments: pendingPayments.map((payment: any) => ({
          id: payment.id,
          value: payment.value,
          dueDate: payment.dueDate,
          status: payment.status,
          invoiceUrl: payment.invoiceUrl,
          billingType: payment.billingType,
        })),
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
