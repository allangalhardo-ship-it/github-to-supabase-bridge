// Lovable Cloud function: bootstrap an account profile (empresa + usuario + defaults)
// Creates missing rows for an authenticated user in an idempotent way.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type BootstrapRequest = {
  nome?: string;
  nomeEmpresa?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const user = authData.user;

    const body: BootstrapRequest = await req.json().catch(() => ({}));
    const email = user.email ?? "";
    const nomeFromMeta = (user.user_metadata?.nome as string | undefined) ?? undefined;
    const nomeEmpresaFromMeta = (user.user_metadata?.nomeEmpresa as string | undefined) ?? undefined;

    const nome = (body.nome ?? nomeFromMeta ?? email.split("@")[0] ?? "Usuário").trim();
    const nomeEmpresa = (body.nomeEmpresa ?? nomeEmpresaFromMeta ?? "Minha Empresa").trim();

    // If profile already exists, return it (idempotent)
    const { data: existingUsuario, error: existingErr } = await admin
      .from("usuarios")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (existingErr) {
      return new Response(JSON.stringify({ error: existingErr.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (existingUsuario) {
      return new Response(JSON.stringify({ usuario: existingUsuario }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Create empresa
    const { data: empresa, error: empresaErr } = await admin
      .from("empresas")
      .insert({ nome: nomeEmpresa })
      .select("*")
      .single();

    if (empresaErr) {
      return new Response(JSON.stringify({ error: empresaErr.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Create usuario
    const { data: usuario, error: usuarioErr } = await admin
      .from("usuarios")
      .insert({
        id: user.id,
        empresa_id: empresa.id,
        nome,
        email: email || `${user.id}@user.local`,
      })
      .select("*")
      .single();

    if (usuarioErr) {
      return new Response(JSON.stringify({ error: usuarioErr.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Add default admin role (best-effort)
    try {
      await admin.from("user_roles").insert({ user_id: user.id, role: "admin" });
    } catch (_) {
      // ignore
    }

    // Create default configuracoes (best-effort)
    try {
      await admin.from("configuracoes").insert({ empresa_id: empresa.id });
    } catch (_) {
      // ignore
    }

    return new Response(JSON.stringify({ usuario }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
