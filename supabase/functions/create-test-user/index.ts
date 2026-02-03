import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    const { email, password, nome, nomeEmpresa } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Create user via admin API (bypasses email confirmation)
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        nome: nome || "Importação",
        nomeEmpresa: nomeEmpresa || "Empresa Importação",
      },
    });

    if (authError) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const user = authData.user;
    console.log("User created:", user.id);

    // Create empresa
    const { data: empresa, error: empresaErr } = await admin
      .from("empresas")
      .insert({ 
        nome: nomeEmpresa || "Empresa Importação",
        segmento: "confeitaria",
      })
      .select("*")
      .single();

    if (empresaErr) {
      console.error("Empresa error:", empresaErr);
      return new Response(JSON.stringify({ error: empresaErr.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("Empresa created:", empresa.id);

    // Create usuario
    const { data: usuario, error: usuarioErr } = await admin
      .from("usuarios")
      .insert({
        id: user.id,
        empresa_id: empresa.id,
        nome: nome || "Importação",
        email: email,
      })
      .select("*")
      .single();

    if (usuarioErr) {
      console.error("Usuario error:", usuarioErr);
      return new Response(JSON.stringify({ error: usuarioErr.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("Usuario created:", usuario.id);

    // Create user role
    await admin.from("user_roles").insert({ user_id: user.id, role: "user" });

    // Create default configuracoes
    await admin.from("configuracoes").insert({ empresa_id: empresa.id });

    // Mark onboarding as complete (skip wizard)
    await admin.from("onboarding_progress").insert({
      user_id: user.id,
      empresa_id: empresa.id,
      current_step: 6,
      completed: true,
    });

    return new Response(JSON.stringify({ 
      success: true,
      user: { id: user.id, email: user.email },
      empresa: { id: empresa.id, nome: empresa.nome },
      usuario: { id: usuario.id, nome: usuario.nome },
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
