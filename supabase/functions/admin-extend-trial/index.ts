import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-EXTEND-TRIAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("User authenticated", { userId: userData.user.id });

    // Check if user has admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Admin access confirmed");

    // Parse request body
    const { userId, action, days } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Processing request", { userId, action, days });

    if (action === "extend") {
      // Extend trial by X days from now
      const daysToAdd = parseInt(days) || 7;
      const newTrialEnd = new Date();
      newTrialEnd.setDate(newTrialEnd.getDate() + daysToAdd);

      const { error: updateError } = await supabaseAdmin
        .from("usuarios")
        .update({ trial_end_override: newTrialEnd.toISOString() })
        .eq("id", userId);

      if (updateError) {
        logStep("Error updating trial", { error: updateError.message });
        throw updateError;
      }

      logStep("Trial extended", { userId, newTrialEnd: newTrialEnd.toISOString(), days: daysToAdd });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Trial estendido por ${daysToAdd} dias`,
          newTrialEnd: newTrialEnd.toISOString(),
          daysRemaining: daysToAdd
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (action === "reset") {
      // Remove override, back to default calculation
      const { error: updateError } = await supabaseAdmin
        .from("usuarios")
        .update({ trial_end_override: null })
        .eq("id", userId);

      if (updateError) {
        logStep("Error resetting trial", { error: updateError.message });
        throw updateError;
      }

      logStep("Trial reset to default", { userId });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Trial resetado para o padrão (7 dias após criação)"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Ação inválida. Use 'extend' ou 'reset'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
