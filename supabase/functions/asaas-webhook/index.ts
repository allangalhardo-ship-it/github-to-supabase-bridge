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

// Usar ambiente sandbox para testes, produção para live
const ASAAS_API_URL = "https://api.asaas.com/v3";
// Para testes use: const ASAAS_API_URL = "https://sandbox.asaas.com/api/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    // Validar token de autenticação do Asaas (opcional, mas recomendado)
    const asaasAccessToken = req.headers.get("asaas-access-token");
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    
    if (expectedToken && asaasAccessToken !== expectedToken) {
      logStep("Invalid webhook token", { received: asaasAccessToken ? "present" : "missing" });
      // Não bloquear se token não estiver configurado, apenas logar
      if (asaasAccessToken) {
        logStep("Warning: Token mismatch, proceeding anyway");
      }
    }

    const body = await req.json();
    logStep("Webhook event", { event: body.event, paymentId: body.payment?.id });

    // Inicializar Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");

    // Helper function to get subscription details
    const getSubscriptionDetails = async (subscriptionId: string) => {
      if (!asaasApiKey) return null;
      
      const subscriptionResp = await fetch(
        `${ASAAS_API_URL}/subscriptions/${subscriptionId}`,
        {
          headers: {
            "access_token": asaasApiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (subscriptionResp.ok) {
        return await subscriptionResp.json();
      }
      return null;
    };

    // Helper function to parse external reference
    const parseExternalReference = (ref: string) => {
      try {
        return JSON.parse(ref);
      } catch {
        return null;
      }
    };

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
          const subscriptionData = await getSubscriptionDetails(body.payment.subscription);
          
          if (subscriptionData?.externalReference) {
            const externalRef = parseExternalReference(subscriptionData.externalReference);
            
            if (externalRef?.user_id) {
              const userId = externalRef.user_id;
              const plan = externalRef.plan;
              const billingCycle = externalRef.billing_cycle;
              
              logStep("Processing subscription activation", { userId, plan, billingCycle });

              // Usar nextDueDate do Asaas se disponível, senão calcular
              let subscriptionEnd: Date;
              if (subscriptionData.nextDueDate) {
                subscriptionEnd = new Date(subscriptionData.nextDueDate);
                logStep("Using Asaas nextDueDate", { nextDueDate: subscriptionData.nextDueDate });
              } else {
                // Fallback: calcular baseado no ciclo
                subscriptionEnd = new Date();
                if (billingCycle === "YEARLY") {
                  subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
                } else {
                  subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
                }
                logStep("Calculated subscriptionEnd", { subscriptionEnd: subscriptionEnd.toISOString() });
              }

              // Atualizar dados de assinatura no usuário
              const { error: updateError } = await supabaseAdmin
                .from("usuarios")
                .update({
                  trial_end_override: subscriptionEnd.toISOString(),
                  asaas_subscription_id: body.payment.subscription,
                  asaas_plan: plan,
                  asaas_subscription_end: subscriptionEnd.toISOString(),
                })
                .eq("id", userId);

              if (updateError) {
                logStep("Error updating user subscription", { error: updateError });
              } else {
                logStep("User subscription activated", { 
                  userId, 
                  plan, 
                  subscriptionEnd: subscriptionEnd.toISOString() 
                });
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
        // Pode enviar notificação para o usuário
        break;
      }

      case "PAYMENT_DELETED":
      case "PAYMENT_REFUNDED": {
        logStep("Payment deleted/refunded", {
          paymentId: body.payment?.id,
        });
        break;
      }

      case "SUBSCRIPTION_CREATED": {
        logStep("Subscription created", {
          subscriptionId: body.subscription?.id,
          externalReference: body.subscription?.externalReference,
        });

        // Pré-registrar dados da assinatura quando criada
        if (body.subscription?.externalReference) {
          const externalRef = parseExternalReference(body.subscription.externalReference);
          
          if (externalRef?.user_id) {
            const userId = externalRef.user_id;
            const plan = externalRef.plan;
            const billingCycle = externalRef.billing_cycle;
            
            logStep("Pre-registering subscription", { userId, plan, billingCycle });

            // Calcular data de expiração provisória (será atualizada quando pagamento confirmar)
            let subscriptionEnd: Date;
            if (body.subscription.nextDueDate) {
              subscriptionEnd = new Date(body.subscription.nextDueDate);
            } else {
              subscriptionEnd = new Date();
              if (billingCycle === "YEARLY") {
                subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
              } else {
                subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
              }
            }

            // Pré-registrar a assinatura (status pendente até confirmar pagamento)
            const { error: updateError } = await supabaseAdmin
              .from("usuarios")
              .update({
                asaas_subscription_id: body.subscription.id,
                asaas_plan: plan,
                // Não define trial_end_override ainda - só após pagamento confirmado
              })
              .eq("id", userId);

            if (updateError) {
              logStep("Error pre-registering subscription", { error: updateError });
            } else {
              logStep("Subscription pre-registered", { userId, plan, subscriptionId: body.subscription.id });
            }
          }
        }
        break;
      }

      case "SUBSCRIPTION_UPDATED": {
        logStep("Subscription updated", {
          subscriptionId: body.subscription?.id,
          status: body.subscription?.status,
        });
        break;
      }

      case "SUBSCRIPTION_DELETED":
      case "SUBSCRIPTION_INACTIVATED": {
        logStep("Subscription deleted/inactivated", {
          subscriptionId: body.subscription?.id,
        });

        // Buscar usuário pela subscription_id e remover acesso
        if (body.subscription?.id) {
          const { data: usuario } = await supabaseAdmin
            .from("usuarios")
            .select("id")
            .eq("asaas_subscription_id", body.subscription.id)
            .maybeSingle();

          if (usuario) {
            const { error: updateError } = await supabaseAdmin
              .from("usuarios")
              .update({
                asaas_subscription_id: null,
                asaas_plan: null,
                asaas_subscription_end: null,
                trial_end_override: null,
              })
              .eq("id", usuario.id);

            if (updateError) {
              logStep("Error removing user subscription", { error: updateError });
            } else {
              logStep("User subscription removed", { userId: usuario.id });
            }
          }
        }
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
