import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ASAAS-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const body = await req.json();
    logStep("Webhook event", { event: body.event, paymentId: body.payment?.id });

    // Inicializar Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Eventos de pagamento do Asaas
    switch (body.event) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED": {
        logStep("Payment confirmed/received", {
          paymentId: body.payment?.id,
          value: body.payment?.value,
          billingType: body.payment?.billingType,
        });

        // Extrair informações do externalReference
        if (body.payment?.subscription) {
          const ASAAS_API_URL = "https://api.asaas.com/v3";
          const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
          
          if (asaasApiKey) {
            // Buscar detalhes da assinatura para pegar o externalReference
            const subscriptionResp = await fetch(
              `${ASAAS_API_URL}/subscriptions/${body.payment.subscription}`,
              {
                headers: {
                  "access_token": asaasApiKey,
                  "Content-Type": "application/json",
                },
              }
            );

            if (subscriptionResp.ok) {
              const subscriptionData = await subscriptionResp.json();
              
              if (subscriptionData.externalReference) {
                try {
                  const externalRef = JSON.parse(subscriptionData.externalReference);
                  const userId = externalRef.user_id;
                  const plan = externalRef.plan;
                  
                  logStep("Processing subscription activation", { userId, plan });

                  // Calcular data de expiração baseada no ciclo
                  const billingCycle = externalRef.billing_cycle;
                  const subscriptionEnd = new Date();
                  if (billingCycle === "YEARLY") {
                    subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
                  } else {
                    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
                  }

                  // Atualizar trial_end_override como flag de assinatura ativa
                  // (podemos criar uma tabela dedicada se precisar no futuro)
                  const { error: updateError } = await supabaseAdmin
                    .from("usuarios")
                    .update({
                      trial_end_override: subscriptionEnd.toISOString(),
                    })
                    .eq("id", userId);

                  if (updateError) {
                    logStep("Error updating user subscription", { error: updateError });
                  } else {
                    logStep("User subscription activated", { userId, plan, subscriptionEnd: subscriptionEnd.toISOString() });
                  }
                } catch (parseError) {
                  logStep("Error parsing externalReference", { error: String(parseError) });
                }
              }
            }
          }
        }
        break;
      }

      case "PAYMENT_OVERDUE": {
        logStep("Payment overdue", {
          paymentId: body.payment?.id,
          dueDate: body.payment?.dueDate,
        });
        // Podemos enviar notificação para o usuário
        break;
      }

      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED": {
        logStep("Payment deleted/refunded", {
          paymentId: body.payment?.id,
        });
        break;
      }

      default:
        logStep("Unhandled event type", { event: body.event });
    }

    return new Response(JSON.stringify({ received: true, event: body.event }), {
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
