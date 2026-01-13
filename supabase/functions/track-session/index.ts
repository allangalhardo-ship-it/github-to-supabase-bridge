import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip",
};

// Parse user agent to extract device info
function parseUserAgent(ua: string): { device: string; browser: string; os: string } {
  let device = 'Desktop';
  let browser = 'Unknown';
  let os = 'Unknown';

  // Detect device type
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
    device = /iPad/i.test(ua) ? 'Tablet' : 'Mobile';
  }

  // Detect browser
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Opera|OPR/i.test(ua)) browser = 'Opera';

  // Detect OS
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

  return { device, browser, os };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate user token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const body = await req.json();
    const { action, page_path, session_token } = body;

    // Get IP address from various headers
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("x-real-ip") ||
               req.headers.get("cf-connecting-ip") ||
               "unknown";

    // Get user agent
    const userAgent = req.headers.get("user-agent") || "unknown";
    const { device, browser, os } = parseUserAgent(userAgent);

    if (action === "start_session" || action === "heartbeat") {
      // Check for existing active session for this user with same session token
      const { data: existingSession } = await supabaseAdmin
        .from("user_sessions")
        .select("*")
        .eq("user_id", user.id)
        .eq("session_id", session_token)
        .eq("is_active", true)
        .single();

      if (existingSession) {
        // Update last activity
        await supabaseAdmin
          .from("user_sessions")
          .update({ 
            last_activity_at: new Date().toISOString(),
            pages_visited: existingSession.pages_visited + (action === "heartbeat" ? 0 : 1)
          })
          .eq("id", existingSession.id);

        return new Response(
          JSON.stringify({ session_id: existingSession.id, updated: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark old sessions as inactive (older than 30 min without activity)
      await supabaseAdmin
        .from("user_sessions")
        .update({ 
          is_active: false, 
          ended_at: new Date().toISOString() 
        })
        .eq("user_id", user.id)
        .eq("is_active", true)
        .lt("last_activity_at", new Date(Date.now() - 30 * 60 * 1000).toISOString());

      // Create new session
      const { data: newSession, error: sessionError } = await supabaseAdmin
        .from("user_sessions")
        .insert({
          user_id: user.id,
          session_id: session_token,
          ip_address: ip,
          user_agent: userAgent,
          device_type: device,
          browser: browser,
          os: os,
          started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
          is_active: true,
          pages_visited: 1
        })
        .select()
        .single();

      if (sessionError) {
        console.error("Error creating session:", sessionError);
        return new Response(
          JSON.stringify({ error: "Failed to create session" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ session_id: newSession.id, created: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "page_view") {
      // Find active session
      const { data: activeSession } = await supabaseAdmin
        .from("user_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("session_id", session_token)
        .eq("is_active", true)
        .single();

      if (activeSession) {
        // Update session activity
        await supabaseAdmin
          .from("user_sessions")
          .update({ 
            last_activity_at: new Date().toISOString(),
            pages_visited: (await supabaseAdmin
              .from("user_sessions")
              .select("pages_visited")
              .eq("id", activeSession.id)
              .single()).data?.pages_visited + 1 || 1
          })
          .eq("id", activeSession.id);

        // Log page view
        await supabaseAdmin
          .from("access_logs")
          .insert({
            user_id: user.id,
            session_id: activeSession.id,
            action: "page_view",
            page_path: page_path,
            ip_address: ip
          });
      }

      return new Response(
        JSON.stringify({ logged: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "end_session") {
      await supabaseAdmin
        .from("user_sessions")
        .update({ 
          is_active: false, 
          ended_at: new Date().toISOString() 
        })
        .eq("user_id", user.id)
        .eq("session_id", session_token)
        .eq("is_active", true);

      return new Response(
        JSON.stringify({ ended: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});