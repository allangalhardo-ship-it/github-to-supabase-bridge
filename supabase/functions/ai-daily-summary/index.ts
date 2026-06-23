import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: usuario } = await supabase.from("usuarios").select("empresa_id").eq("id", user.id).single();
    if (!usuario?.empresa_id) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const empresaId = usuario.empresa_id;

    // Helper: data/hora no fuso de Brasília (UTC-3)
    const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const brtDateStr = (d: Date) => d.toISOString().slice(0, 10);
    const horaBRT = nowBRT.getUTCHours();
    const saudacao = horaBRT < 12 ? "Bom dia" : horaBRT < 18 ? "Boa tarde" : "Boa noite";

    // Verificar quota + cache
    const today = brtDateStr(nowBRT);
    const cacheKey = `daily_summary_${empresaId}_${today}`;

    // Tenta cache primeiro
    const { data: cached } = await supabase
      .from("ai_cache")
      .select("response, expires_at")
      .eq("empresa_id", empresaId)
      .eq("feature", "daily_summary")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached?.response) {
      return new Response(JSON.stringify({ ...cached.response, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar plano
    const { data: empresa } = await supabase
      .from("empresas")
      .select("plano_assinatura")
      .eq("id", empresaId)
      .maybeSingle();
    const plan = empresa?.plano_assinatura === "pro" ? "pro" : "standard";

    // Quota check
    const { data: quotaCheck, error: quotaError } = await supabase.rpc("check_and_increment_ai_quota", {
      p_empresa_id: empresaId,
      p_feature: "daily_summary",
      p_plan: plan,
    });

    if (quotaError) console.error("quota error:", quotaError);
    const quotaRow = Array.isArray(quotaCheck) ? quotaCheck[0] : quotaCheck;
    if (quotaRow && !quotaRow.allowed) {
      return new Response(JSON.stringify({ error: "quota_excedida", quota: quotaRow }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Coletar dados (fuso BRT) ===
    const ontemBRT = new Date(nowBRT); ontemBRT.setUTCDate(ontemBRT.getUTCDate() - 1);
    const seteDiasBRT = new Date(nowBRT); seteDiasBRT.setUTCDate(seteDiasBRT.getUTCDate() - 7);
    const hojeStr = today;
    const ontemStr = brtDateStr(ontemBRT);
    const seteDiasStr = brtDateStr(seteDiasBRT);

    const [vendasHojeRes, vendasOntemRes, vendas7dRes, insumosRes] = await Promise.all([
      supabase.from("vendas").select("valor_total, quantidade, canal, descricao_produto, produto_id, produtos(nome)").eq("empresa_id", empresaId).eq("data_venda", hojeStr),
      supabase.from("vendas").select("valor_total").eq("empresa_id", empresaId).eq("data_venda", ontemStr),
      supabase.from("vendas").select("valor_total, data_venda").eq("empresa_id", empresaId).gte("data_venda", seteDiasStr),
      supabase.from("insumos").select("nome, estoque_atual, estoque_minimo, unidade_medida").eq("empresa_id", empresaId).eq("ativo", true),
    ]);

    const vendasHoje = vendasHojeRes.data || [];
    const vendasOntem = vendasOntemRes.data || [];
    const vendas7d = vendas7dRes.data || [];
    const insumos = insumosRes.data || [];

    const receitaHoje = vendasHoje.reduce((s, v) => s + Number(v.valor_total || 0), 0);
    const receitaOntem = vendasOntem.reduce((s, v) => s + Number(v.valor_total || 0), 0);
    const qtdVendasHoje = vendasHoje.length;
    const ticketMedio = qtdVendasHoje > 0 ? receitaHoje / qtdVendasHoje : 0;

    // Top produto hoje
    const produtoMap = new Map<string, { nome: string; qtd: number; receita: number }>();
    for (const v of vendasHoje) {
      const nome = (v as any).produtos?.nome || v.descricao_produto || "Sem nome";
      const key = nome;
      const cur = produtoMap.get(key) || { nome, qtd: 0, receita: 0 };
      cur.qtd += Number(v.quantidade || 0);
      cur.receita += Number(v.valor_total || 0);
      produtoMap.set(key, cur);
    }
    const topProdutos = [...produtoMap.values()].sort((a, b) => b.receita - a.receita).slice(0, 3);

    // Canais
    const canalMap = new Map<string, number>();
    for (const v of vendasHoje) {
      const c = v.canal || "balcao";
      canalMap.set(c, (canalMap.get(c) || 0) + Number(v.valor_total || 0));
    }
    const topCanais = [...canalMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Média últimos 7 dias
    const receita7d = vendas7d.reduce((s, v) => s + Number(v.valor_total || 0), 0);
    const mediaDiaria = receita7d / 7;

    // Estoque baixo
    const estoqueBaixo = insumos
      .filter((i: any) => i.estoque_minimo > 0 && Number(i.estoque_atual) <= Number(i.estoque_minimo))
      .slice(0, 5)
      .map((i: any) => `${i.nome} (${Number(i.estoque_atual).toFixed(1)}${i.unidade_medida})`);

    const variacaoOntem = receitaOntem > 0 ? ((receitaHoje - receitaOntem) / receitaOntem) * 100 : null;
    const variacaoMedia = mediaDiaria > 0 ? ((receitaHoje - mediaDiaria) / mediaDiaria) * 100 : null;

    // Se ainda não vendeu nada hoje, resumo curto baseado em ontem
    const contextoNegocio = `
Você é um consultor de gestão para donos de pequenos negócios de alimentação. Fale em português brasileiro, tom direto e amigável (como uma conversa de WhatsApp). Use no MÁXIMO 4 frases curtas. Não use markdown. Foque em 1-2 insights práticos e 1 ação recomendada.

DADOS DE HOJE (${hojeStr}):
- Receita: R$ ${receitaHoje.toFixed(2)} (${qtdVendasHoje} vendas, ticket médio R$ ${ticketMedio.toFixed(2)})
- Ontem: R$ ${receitaOntem.toFixed(2)}${variacaoOntem !== null ? ` (variação: ${variacaoOntem >= 0 ? "+" : ""}${variacaoOntem.toFixed(0)}%)` : ""}
- Média últimos 7 dias: R$ ${mediaDiaria.toFixed(2)}/dia${variacaoMedia !== null ? ` (hoje está ${variacaoMedia >= 0 ? "+" : ""}${variacaoMedia.toFixed(0)}% da média)` : ""}
- Top produtos hoje: ${topProdutos.length ? topProdutos.map(p => `${p.nome} (${p.qtd}un, R$${p.receita.toFixed(0)})`).join(", ") : "nenhum"}
- Canais: ${topCanais.length ? topCanais.map(([c, v]) => `${c}: R$${v.toFixed(0)}`).join(", ") : "—"}
- Estoque crítico: ${estoqueBaixo.length ? estoqueBaixo.join(", ") : "nenhum item abaixo do mínimo"}

Comece com "${saudacao}!" (horário atual em Brasília: ${horaBRT}h). Se a receita estiver acima da média, comemore. Se abaixo, sugira ação. Se houver estoque crítico, alerte.
`.trim();

    // Chamar Lovable AI
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: contextoNegocio }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "credits_exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const resumo = aiData.choices?.[0]?.message?.content?.trim() || "Não foi possível gerar o resumo no momento.";
    const tokensUsed = aiData.usage?.total_tokens || 0;

    const payload = {
      resumo,
      metricas: {
        receitaHoje,
        receitaOntem,
        qtdVendasHoje,
        ticketMedio,
        mediaDiaria,
        variacaoOntem,
        variacaoMedia,
        topProdutos,
        estoqueBaixo,
      },
      geradoEm: new Date().toISOString(),
    };

    // Cache até o fim do dia (24h)
    await supabase.from("ai_cache").upsert({
      empresa_id: empresaId,
      feature: "daily_summary",
      cache_key: cacheKey,
      response: payload,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "empresa_id,feature,cache_key" });

    // Registrar tokens
    if (tokensUsed > 0) {
      await supabase.from("ai_usage").update({ tokens_used: tokensUsed })
        .eq("empresa_id", empresaId).eq("feature", "daily_summary").eq("date", today);
    }

    return new Response(JSON.stringify({ ...payload, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-daily-summary error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
