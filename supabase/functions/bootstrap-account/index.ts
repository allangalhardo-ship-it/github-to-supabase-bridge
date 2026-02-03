// Lovable Cloud function: bootstrap an account profile (empresa + usuario + defaults)
// Creates missing rows for an authenticated user in an idempotent way.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BootstrapRequest = {
  nome?: string;
  nomeEmpresa?: string;
  telefone?: string;
  cpfCnpj?: string;
  segmento?: string;
  userId?: string; // Optional: for cases where token is not available yet
  email?: string;  // Optional: for cases where token is not available yet
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: corsHeaders,
      });
    }

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

    const body: BootstrapRequest = await req.json().catch(() => ({}));
    
    // Try to get user from token first
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    
    let user = null;
    
    if (token) {
      // Try to validate the token
      const { data: authData, error: authErr } = await admin.auth.getUser(token);
      if (!authErr && authData?.user) {
        user = authData.user;
      }
    }
    
    // If no valid token but userId and email provided (for signup flow before email confirmation)
    if (!user && body.userId && body.email) {
      // Verify the user exists in auth
      const { data: authData, error: authErr } = await admin.auth.admin.getUserById(body.userId);
      if (!authErr && authData?.user && authData.user.email === body.email) {
        user = authData.user;
      }
    }
    
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token or user not found" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const email = user.email ?? "";
    
    // Get data from body or user metadata
    const nomeFromMeta = (user.user_metadata?.nome as string | undefined) ?? undefined;
    const nomeEmpresaFromMeta = (user.user_metadata?.nomeEmpresa as string | undefined) ?? undefined;
    const telefoneFromMeta = (user.user_metadata?.telefone as string | undefined) ?? undefined;
    const cpfCnpjFromMeta = (user.user_metadata?.cpfCnpj as string | undefined) ?? undefined;
    const segmentoFromMeta = (user.user_metadata?.segmento as string | undefined) ?? undefined;

    const nome = (body.nome ?? nomeFromMeta ?? email.split("@")[0] ?? "Usuário").trim();
    const nomeEmpresa = (body.nomeEmpresa ?? nomeEmpresaFromMeta ?? "Minha Empresa").trim();
    const telefone = (body.telefone ?? telefoneFromMeta ?? "").trim();
    const cpfCnpj = (body.cpfCnpj ?? cpfCnpjFromMeta ?? "").trim();
    const segmento = (body.segmento ?? segmentoFromMeta ?? "").trim();

    // If profile already exists, return it (idempotent)
    const { data: existingUsuario, error: existingErr } = await admin
      .from("usuarios")
      .select("*, empresas(*)")
      .eq("id", user.id)
      .maybeSingle();

    if (existingErr) {
      return new Response(JSON.stringify({ error: existingErr.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (existingUsuario) {
      return new Response(JSON.stringify({ usuario: existingUsuario }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Create empresa with segmento
    const { data: empresa, error: empresaErr } = await admin
      .from("empresas")
      .insert({ 
        nome: nomeEmpresa,
        segmento: segmento || null,
      })
      .select("*")
      .single();

    if (empresaErr) {
      return new Response(JSON.stringify({ error: empresaErr.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Create usuario with new fields - use upsert to handle race conditions
    const { data: usuario, error: usuarioErr } = await admin
      .from("usuarios")
      .upsert({
        id: user.id,
        empresa_id: empresa.id,
        nome,
        email: email || `${user.id}@user.local`,
        telefone: telefone || null,
        cpf_cnpj: cpfCnpj || null,
      }, { onConflict: 'id', ignoreDuplicates: false })
      .select("*")
      .single();

    if (usuarioErr) {
      // If duplicate key error, try to fetch existing user
      if (usuarioErr.message?.includes('duplicate key')) {
        const { data: retryUsuario } = await admin
          .from("usuarios")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        
        if (retryUsuario) {
          return new Response(JSON.stringify({ usuario: retryUsuario }), {
            status: 200,
            headers: corsHeaders,
          });
        }
      }
      
      return new Response(JSON.stringify({ error: usuarioErr.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Add default user role (best-effort) - NEVER add admin role automatically
    try {
      await admin.from("user_roles").insert({ user_id: user.id, role: "user" });
    } catch (_) {
      // ignore - role may already exist
    }

    // Create default configuracoes (best-effort)
    try {
      await admin.from("configuracoes").insert({ empresa_id: empresa.id });
    } catch (_) {
      // ignore
    }

    return new Response(JSON.stringify({ usuario }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (e) {
    console.error("Bootstrap error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
