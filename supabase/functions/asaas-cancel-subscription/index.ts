import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ASAAS-CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
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

    // Buscar assinatura do usuário no banco
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: usuarioData } = await supabaseAdmin
      .from("usuarios")
      .select("asaas_subscription_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuarioData?.asaas_subscription_id) {
      throw new Error("Nenhuma assinatura encontrada");
    }

    const subscriptionId = usuarioData.asaas_subscription_id;
    logStep("Subscription found", { subscriptionId });

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) {
      throw new Error("ASAAS_API_KEY not configured");
    }

    // Cancelar assinatura no Asaas
    const cancelResp = await fetch(
      `${ASAAS_API_URL}/subscriptions/${subscriptionId}`,
      {
        method: "DELETE",
        headers: {
          "access_token": asaasApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!cancelResp.ok) {
      const errorData = await cancelResp.json();
      logStep("Error canceling subscription", { error: errorData });
      throw new Error(`Erro ao cancelar assinatura: ${JSON.stringify(errorData)}`);
    }

    const cancelData = await cancelResp.json();
    logStep("Subscription canceled in Asaas", { deleted: cancelData.deleted });

    // Atualizar banco de dados
    const { error: updateError } = await supabaseAdmin
      .from("usuarios")
      .update({
        asaas_subscription_id: null,
        asaas_plan: null,
        // Manter trial_end_override para acesso até o fim do período pago
      })
      .eq("id", user.id);

    if (updateError) {
      logStep("Error updating user", { error: updateError });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Assinatura cancelada com sucesso. Você terá acesso até o fim do período pago.",
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
