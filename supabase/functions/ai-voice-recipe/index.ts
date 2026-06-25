// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_AI_BASE = "https://ai.gateway.lovable.dev/v1";

interface InsumoLite {
  id: string;
  nome: string;
  unidade_medida: string;
}

interface ItemExtraido {
  nome_falado: string;
  quantidade: number | null;
  unidade: string | null;
}

interface ExtractedRecipe {
  produto_nome: string | null;
  itens: ItemExtraido[];
}

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string) {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

function similarity(a: string, b: string) {
  const A = bigrams(normalize(a));
  const B = bigrams(normalize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return (2 * inter) / (A.size + B.size);
}

function matchInsumo(nome: string, insumos: InsumoLite[]) {
  let best: { insumo: InsumoLite; score: number } | null = null;
  for (const i of insumos) {
    const score = similarity(nome, i.nome);
    if (!best || score > best.score) best = { insumo: i, score };
  }
  if (!best || best.score < 0.45) return null;
  return best;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await sb.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const audioBase64: string | undefined = body.audio_base64;
    const mime: string = body.mime || "audio/wav";
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "audio_base64 obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Transcrição via Lovable AI STT
    const binary = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    const ext = mime.includes("mp3") ? "mp3" : mime.includes("mp4") ? "mp4" : mime.includes("webm") ? "webm" : "wav";
    const audioBlob = new Blob([binary], { type: mime });

    const sttForm = new FormData();
    sttForm.append("file", audioBlob, `recording.${ext}`);
    sttForm.append("model", "openai/gpt-4o-mini-transcribe");

    const sttResp = await fetch(`${LOVABLE_AI_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { "Lovable-API-Key": LOVABLE_API_KEY },
      body: sttForm,
    });

    if (!sttResp.ok) {
      const txt = await sttResp.text().catch(() => "");
      return new Response(JSON.stringify({ error: `Falha na transcrição: ${sttResp.status} ${txt}` }), {
        status: sttResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sttJson = await sttResp.json();
    const transcricao: string = sttJson.text || "";

    if (!transcricao.trim()) {
      return new Response(JSON.stringify({ error: "Não consegui entender o áudio. Tente gravar de novo falando mais perto do microfone." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Extração estruturada via Gemini chat
    const extractPrompt = `Você é um extrator de receitas culinárias em português brasileiro.

A pessoa ditou uma receita. Extraia o nome do produto/receita e a lista de insumos (ingredientes) com quantidade e unidade.

REGRAS:
- "quantidade" deve ser número (não texto). Ex: "duzentos gramas" => 200.
- "unidade" deve ser uma destas: g, kg, mg, ml, l, un
- "1 colher de sopa" ≈ 15 g/ml, "1 colher de chá" ≈ 5 g/ml, "1 xícara" ≈ 240 ml — converta.
- "1 ovo", "3 ovos", "1 lata" => unidade "un".
- Se não souber a quantidade, devolva null em quantidade e unidade.
- Mantenha o "nome_falado" exatamente como o usuário falou (sem quantidade).

Áudio transcrito: """${transcricao}"""

Responda APENAS com JSON no formato:
{"produto_nome": "...", "itens": [{"nome_falado": "...", "quantidade": 200, "unidade": "g"}]}`;

    const chatResp = await fetch(`${LOVABLE_AI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: extractPrompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!chatResp.ok) {
      const txt = await chatResp.text().catch(() => "");
      return new Response(JSON.stringify({ error: `Falha na extração: ${chatResp.status} ${txt}`, transcricao }), {
        status: chatResp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const chatJson = await chatResp.json();
    const raw = chatJson?.choices?.[0]?.message?.content || "{}";
    let extracted: ExtractedRecipe = { produto_nome: null, itens: [] };
    try {
      extracted = JSON.parse(raw);
    } catch {
      // tenta extrair JSON do texto
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) extracted = JSON.parse(m[0]);
    }

    // 3) Buscar insumos da empresa do usuário e casar
    const { data: usuario } = await sb
      .from("usuarios")
      .select("empresa_id")
      .eq("id", userData.user.id)
      .single();

    const { data: insumos = [] } = await sb
      .from("insumos")
      .select("id, nome, unidade_medida")
      .eq("empresa_id", usuario?.empresa_id)
      .order("nome");

    const itensCasados = (extracted.itens || []).map((it) => {
      const match = matchInsumo(it.nome_falado || "", insumos as InsumoLite[]);
      return {
        nome_falado: it.nome_falado,
        quantidade: it.quantidade,
        unidade: it.unidade,
        insumo_id: match?.insumo.id ?? null,
        insumo_nome: match?.insumo.nome ?? null,
        insumo_unidade: match?.insumo.unidade_medida ?? null,
        confianca: match ? Number(match.score.toFixed(2)) : 0,
      };
    });

    return new Response(
      JSON.stringify({
        transcricao,
        produto_nome: extracted.produto_nome,
        itens: itensCasados,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("ai-voice-recipe error", err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
