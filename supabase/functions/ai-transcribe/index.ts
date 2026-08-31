// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_AI_BASE = "https://ai.gateway.lovable.dev/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "Missing LOVABLE_API_KEY" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await sb.auth.getUser();
    if (!userData?.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json();
    const audioBase64: string | undefined = body.audio_base64;
    const mime: string = body.mime || "audio/wav";
    if (!audioBase64) return json({ error: "audio_base64 obrigatório" }, 400);

    const binary = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    if (binary.length < 2048) {
      return json({ error: "Gravação muito curta. Tente falar de novo." }, 400);
    }
    const ext = mime.includes("mp3")
      ? "mp3"
      : mime.includes("mp4")
      ? "mp4"
      : mime.includes("webm")
      ? "webm"
      : "wav";

    const form = new FormData();
    form.append("file", new Blob([binary], { type: mime }), `recording.${ext}`);
    form.append("model", "openai/gpt-4o-mini-transcribe");

    const resp = await fetch(`${LOVABLE_AI_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { "Lovable-API-Key": LOVABLE_API_KEY },
      body: form,
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      if (resp.status === 402) return json({ error: "credits_exhausted" }, 402);
      return json({ error: `Falha na transcrição: ${resp.status} ${txt}` }, resp.status);
    }

    const data = await resp.json();
    const texto: string = (data.text || "").trim();
    if (!texto) {
      return json({ error: "Não consegui entender o áudio. Fale mais perto do microfone." }, 400);
    }

    return json({ texto });
  } catch (e: any) {
    return json({ error: e?.message || "Erro inesperado" }, 500);
  }
});
