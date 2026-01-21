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

    // Fetch all user sessions
    const { data: userSessions } = await supabaseAdmin
      .from("user_sessions")
      .select("*")
      .order("started_at", { ascending: false });

    // Fetch recent access logs
    const { data: accessLogs } = await supabaseAdmin
      .from("access_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

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

    // Build sessions map per user
    type SessionType = NonNullable<typeof userSessions>[number];
    const sessionsMap: Record<string, SessionType[]> = {};
    const activeSessionsMap: Record<string, number> = {};
    
    // Considerar "online" apenas se last_activity_at for nos últimos 5 minutos
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    userSessions?.forEach(session => {
      if (!sessionsMap[session.user_id]) {
        sessionsMap[session.user_id] = [];
      }
      sessionsMap[session.user_id]!.push(session);
      
      // Sessão é realmente ativa se is_active E last_activity_at < 5 min
      const lastActivity = new Date(session.last_activity_at);
      const isReallyActive = session.is_active && lastActivity >= fiveMinutesAgo;
      
      if (isReallyActive) {
        activeSessionsMap[session.user_id] = (activeSessionsMap[session.user_id] || 0) + 1;
      }
    });

    // Build access logs map per user
    const accessLogsMap: Record<string, number> = {};
    accessLogs?.forEach(log => {
      accessLogsMap[log.user_id] = (accessLogsMap[log.user_id] || 0) + 1;
    });

    // Helper function to safely parse dates
    const safeParseDate = (dateStr: string | null | undefined): Date | null => {
      if (!dateStr) return null;
      try {
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
      } catch {
        return null;
      }
    };

    // Combine all data
    const enrichedUsers = authUsers.users.map(authUser => {
      const usuario = usuarios?.find(u => u.id === authUser.id);
      const subscription = subscriptionsMap[authUser.email?.toLowerCase() || ""];
      const sessions = sessionsMap[authUser.id] || [];
      const activeSessions = activeSessionsMap[authUser.id] || 0;
      const totalPageViews = accessLogsMap[authUser.id] || 0;
      
      // Calculate trial status
      let trialStatus = "expired";
      let trialDaysRemaining = 0;
      
      const createdAt = safeParseDate(authUser.created_at);
      if (createdAt) {
        const now = new Date();
        const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        trialDaysRemaining = Math.max(0, 7 - daysSinceCreation);
        trialStatus = trialDaysRemaining > 0 ? "trialing" : "expired";
      }

      // Calculate total time logged (sum of session durations)
      let totalTimeMinutes = 0;
      sessions.forEach(s => {
        const start = safeParseDate(s.started_at);
        const end = safeParseDate(s.ended_at) || safeParseDate(s.last_activity_at);
        if (start && end) {
          totalTimeMinutes += Math.round((end.getTime() - start.getTime()) / (1000 * 60));
        }
      });

      // Get unique IPs and devices
      const uniqueIPs = [...new Set(sessions.map(s => s.ip_address).filter(Boolean))];
      const uniqueDevices = [...new Set(sessions.map(s => `${s.device_type} - ${s.browser} - ${s.os}`).filter(d => d !== ' -  - '))];

      // Get last 5 sessions for details
      const recentSessions = sessions.slice(0, 5).map(s => {
        const startDate = safeParseDate(s.started_at);
        const endDate = safeParseDate(s.ended_at) || safeParseDate(s.last_activity_at);
        const durationMinutes = (startDate && endDate) 
          ? Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))
          : 0;
        
        return {
          id: s.id,
          ip: s.ip_address,
          device: s.device_type,
          browser: s.browser,
          os: s.os,
          started_at: s.started_at,
          last_activity: s.last_activity_at,
          ended_at: s.ended_at,
          is_active: s.is_active,
          pages_visited: s.pages_visited,
          duration_minutes: durationMinutes,
        };
      });

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
        // Session tracking data
        session_stats: {
          active_sessions: activeSessions,
          total_sessions: sessions.length,
          total_page_views: totalPageViews,
          total_time_minutes: totalTimeMinutes,
          unique_ips: uniqueIPs,
          unique_devices: uniqueDevices,
        },
        recent_sessions: recentSessions,
        // Session/IP info from identities
        identities: authUser.identities?.map(i => ({
          provider: i.provider,
          last_sign_in_at: i.last_sign_in_at,
        })),
        app_metadata: authUser.app_metadata,
      };
    });

    // Sort by most recent first (with safe date parsing)
    enrichedUsers.sort((a, b) => {
      const dateA = safeParseDate(a.last_sign_in_at) || safeParseDate(a.created_at) || new Date(0);
      const dateB = safeParseDate(b.last_sign_in_at) || safeParseDate(b.created_at) || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    // Summary stats
    const totalActiveSessions = Object.values(activeSessionsMap).reduce((a, b) => a + b, 0);
    const usersWithMultipleSessions = Object.values(activeSessionsMap).filter(count => count > 1).length;
    
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
      // New session stats
      totalActiveSessions,
      usersWithMultipleSessions,
      totalPageViews: accessLogs?.length || 0,
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
