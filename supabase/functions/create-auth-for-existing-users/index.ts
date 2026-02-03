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
    const { defaultPassword } = body;

    if (!defaultPassword || defaultPassword.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Get all usuarios
    const { data: usuarios, error: usuariosErr } = await admin
      .from("usuarios")
      .select("id, email, nome");

    if (usuariosErr) {
      return new Response(JSON.stringify({ error: usuariosErr.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const results = {
      created: [] as string[],
      alreadyExists: [] as string[],
      errors: [] as { email: string; error: string }[],
    };

    for (const usuario of usuarios || []) {
      try {
        // Check if auth user already exists
        const { data: existingUsers } = await admin.auth.admin.listUsers();
        const exists = existingUsers?.users?.some(u => u.email === usuario.email);

        if (exists) {
          results.alreadyExists.push(usuario.email);
          continue;
        }

        // Create auth user with the existing usuario id
        const { error: createErr } = await admin.auth.admin.createUser({
          id: usuario.id, // Use the same ID as the usuario
          email: usuario.email,
          password: defaultPassword,
          email_confirm: true,
          user_metadata: {
            nome: usuario.nome,
          },
        });

        if (createErr) {
          // If ID conflict, the auth user might already exist
          if (createErr.message?.includes("already been registered") || 
              createErr.message?.includes("duplicate key")) {
            results.alreadyExists.push(usuario.email);
          } else {
            results.errors.push({ email: usuario.email, error: createErr.message });
          }
        } else {
          results.created.push(usuario.email);
        }
      } catch (e) {
        results.errors.push({ 
          email: usuario.email, 
          error: e instanceof Error ? e.message : "Unknown error" 
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total: usuarios?.length || 0,
        created: results.created.length,
        alreadyExists: results.alreadyExists.length,
        errors: results.errors.length,
      },
      details: results,
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
