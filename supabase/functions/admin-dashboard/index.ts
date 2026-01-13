import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-DASHBOARD] ${step}${detailsStr}`);
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

    // Fetch all auth users with their metadata
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      throw authError;
    }

    logStep("Fetched auth users", { count: authUsers.users.length });

    // Fetch all usuarios with empresa info
    const { data: usuarios } = await supabaseAdmin
      .from("usuarios")
      .select(`
        id,
        nome,
        email,
        telefone,
        cpf_cnpj,
        is_test_user,
        created_at,
        empresa_id,
        empresas (
          id,
          nome,
          segmento
        )
      `);

    // Fetch all user roles
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");

    // Build a map of user roles
    const rolesMap: Record<string, string[]> = {};
    userRoles?.forEach(ur => {
      if (!rolesMap[ur.user_id]) {
        rolesMap[ur.user_id] = [];
      }
      rolesMap[ur.user_id].push(ur.role);
    });

    // Check Stripe subscriptions
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    let subscriptionsMap: Record<string, { subscribed: boolean; status: string; endDate: string | null }> = {};

    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      
      // Get all customers and their subscriptions
      const customers = await stripe.customers.list({ limit: 100 });
      
      for (const customer of customers.data) {
        if (customer.email) {
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            limit: 1,
          });

          if (subscriptions.data.length > 0) {
            const sub = subscriptions.data[0];
            subscriptionsMap[customer.email.toLowerCase()] = {
              subscribed: sub.status === 'active' || sub.status === 'trialing',
              status: sub.status,
              endDate: new Date(sub.current_period_end * 1000).toISOString(),
            };
          }
        }
      }
    }

    logStep("Fetched Stripe subscriptions", { count: Object.keys(subscriptionsMap).length });

    // Combine all data
    const enrichedUsers = authUsers.users.map(authUser => {
      const usuario = usuarios?.find(u => u.id === authUser.id);
      const subscription = subscriptionsMap[authUser.email?.toLowerCase() || ""];
      
      // Calculate trial status
      let trialStatus = "expired";
      let trialDaysRemaining = 0;
      
      if (authUser.created_at) {
        const createdAt = new Date(authUser.created_at);
        const now = new Date();
        const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        trialDaysRemaining = Math.max(0, 7 - daysSinceCreation);
        trialStatus = trialDaysRemaining > 0 ? "trialing" : "expired";
      }

      return {
        id: authUser.id,
        email: authUser.email,
        nome: usuario?.nome || authUser.user_metadata?.nome || "Sem nome",
        telefone: usuario?.telefone,
        cpf_cnpj: usuario?.cpf_cnpj,
        is_test_user: usuario?.is_test_user || false,
        created_at: authUser.created_at,
        last_sign_in_at: authUser.last_sign_in_at,
        email_confirmed_at: authUser.email_confirmed_at,
        empresa: usuario?.empresas,
        roles: rolesMap[authUser.id] || [],
        subscription: subscription || null,
        trial: {
          status: trialStatus,
          daysRemaining: trialDaysRemaining,
        },
        // Session/IP info from identities
        identities: authUser.identities?.map(i => ({
          provider: i.provider,
          last_sign_in_at: i.last_sign_in_at,
        })),
        app_metadata: authUser.app_metadata,
      };
    });

    // Sort by most recent first
    enrichedUsers.sort((a, b) => {
      const dateA = new Date(a.last_sign_in_at || a.created_at || 0);
      const dateB = new Date(b.last_sign_in_at || b.created_at || 0);
      return dateB.getTime() - dateA.getTime();
    });

    // Summary stats
    const stats = {
      totalUsers: enrichedUsers.length,
      activeSubscribers: enrichedUsers.filter(u => u.subscription?.subscribed).length,
      inTrial: enrichedUsers.filter(u => !u.subscription?.subscribed && u.trial.status === 'trialing').length,
      expired: enrichedUsers.filter(u => !u.subscription?.subscribed && u.trial.status === 'expired' && !u.is_test_user).length,
      testUsers: enrichedUsers.filter(u => u.is_test_user).length,
      activeToday: enrichedUsers.filter(u => {
        if (!u.last_sign_in_at) return false;
        const lastSign = new Date(u.last_sign_in_at);
        const today = new Date();
        return lastSign.toDateString() === today.toDateString();
      }).length,
      activeLast7Days: enrichedUsers.filter(u => {
        if (!u.last_sign_in_at) return false;
        const lastSign = new Date(u.last_sign_in_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return lastSign >= sevenDaysAgo;
      }).length,
    };

    logStep("Response ready", { userCount: enrichedUsers.length });

    return new Response(
      JSON.stringify({ users: enrichedUsers, stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
