import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { convertToModelMessages, streamText, type UIMessage } from "npm:ai@7";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function brtNow() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
}
function brtDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function brl(n: number) {
  return `R$ ${(n || 0).toFixed(2).replace(".", ",")}`;
}

async function buildBusinessSnapshot(supabase: any, empresaId: string): Promise<string> {
  const hoje = brtNow();
  const hojeStr = brtDateStr(hoje);
  const inicio30 = brtDateStr(new Date(hoje.getTime() - 30 * 86400000));
  const inicio7 = brtDateStr(new Date(hoje.getTime() - 7 * 86400000));

  const [
    empresaRes,
    vendas30Res,
    vendas7Res,
    topProdRes,
    custosFixosRes,
    insumosLowRes,
    alertasRes,
    produtosRes,
    configRes,
    canaisRes,
    taxasRes,
    precosCanaisRes,
  ] = await Promise.all([
    supabase.from("empresas").select("nome, segmento, plano_assinatura").eq("id", empresaId).maybeSingle(),
    supabase.rpc("get_dashboard_vendas", { p_empresa_id: empresaId, p_data_inicio: inicio30, p_data_fim: hojeStr }),
    supabase.rpc("get_dashboard_vendas", { p_empresa_id: empresaId, p_data_inicio: inicio7, p_data_fim: hojeStr }),
    supabase.rpc("get_top_produtos", { p_empresa_id: empresaId, p_data_inicio: inicio30, p_data_fim: hojeStr, p_limit: 8 }),
    supabase.from("custos_fixos").select("nome, valor_mensal, categoria").eq("empresa_id", empresaId),
    supabase.rpc("get_insumos_estoque_baixo", { p_empresa_id: empresaId }),
    supabase.from("alertas_custo").select("*, insumos:insumo_id(nome), produtos:produto_id(nome)").eq("empresa_id", empresaId).eq("status", "ativo").order("variacao_pct", { ascending: false }).limit(10),
    supabase.from("produtos").select("id, nome, preco_venda, categoria, ativo").eq("empresa_id", empresaId).eq("ativo", true),
    supabase.from("configuracoes").select("margem_desejada_padrao, imposto_medio_sobre_vendas, cmv_alvo").eq("empresa_id", empresaId).maybeSingle(),
    supabase.from("canais_venda").select("id, nome, tipo, ativo").eq("empresa_id", empresaId).eq("ativo", true),
    supabase.from("taxas_canais").select("canal_id, percentual"),
    supabase.from("precos_canais").select("produto_id, canal, preco").eq("empresa_id", empresaId),
  ]);

  const empresa = empresaRes.data;
  const vendas30 = vendas30Res.data || [];
  const vendas7 = vendas7Res.data || [];
  const topProd = topProdRes.data || [];
  const custosFixos = custosFixosRes.data || [];
  const insumosLow = insumosLowRes.data || [];
  const alertas = alertasRes.data || [];
  const produtos = produtosRes.data || [];
  const config = configRes.data;

  const receita30 = vendas30.reduce((s: number, v: any) => s + Number(v.valor_total || 0), 0);
  const receita7 = vendas7.reduce((s: number, v: any) => s + Number(v.valor_total || 0), 0);
  const custoTotal30 = vendas30.reduce((s: number, v: any) => s + Number(v.custo_insumos || 0) * Number(v.quantidade || 1), 0);
  const qtdVendas30 = vendas30.length;
  const ticketMedio = qtdVendas30 ? receita30 / qtdVendas30 : 0;
  const cmvPct = receita30 > 0 ? (custoTotal30 / receita30) * 100 : 0;

  // Vendas por canal
  const canalMap = new Map<string, number>();
  for (const v of vendas30) {
    const c = v.canal || "balcao";
    canalMap.set(c, (canalMap.get(c) || 0) + Number(v.valor_total || 0));
  }
  const canais = [...canalMap.entries()].sort((a, b) => b[1] - a[1]);

  const custosFixosMensal = custosFixos.reduce((s: number, c: any) => s + Number(c.valor_mensal || 0), 0);

  const lucroBruto30 = receita30 - custoTotal30;
  const lucroLiquidoEst = lucroBruto30 - custosFixosMensal;

  const lines: string[] = [];
  lines.push(`# Contexto do negócio: ${empresa?.nome || "Empresa"}`);
  if (empresa?.segmento) lines.push(`Segmento: ${empresa.segmento}`);
  lines.push(`Plano: ${empresa?.plano_assinatura || "standard"}`);
  lines.push(`Data atual (BRT): ${hojeStr}`);
  lines.push("");
  lines.push("## Indicadores — últimos 30 dias");
  lines.push(`- Receita: ${brl(receita30)} (${qtdVendas30} vendas, ticket médio ${brl(ticketMedio)})`);
  lines.push(`- Custo de insumos (CMV): ${brl(custoTotal30)} (${cmvPct.toFixed(1)}%)`);
  lines.push(`- Lucro bruto: ${brl(lucroBruto30)}`);
  lines.push(`- Custos fixos mensais: ${brl(custosFixosMensal)} (${custosFixos.length} itens cadastrados)`);
  if (custosFixos.length > 0) {
    custosFixos.forEach((c: any) => lines.push(`    • ${c.nome}${c.categoria ? ` [${c.categoria}]` : ""}: ${brl(Number(c.valor_mensal || 0))}`));
  }
  lines.push(`- Lucro líquido estimado: ${brl(lucroLiquidoEst)}`);
  lines.push(`- Receita últimos 7 dias: ${brl(receita7)}`);
  if (config?.margem_desejada_padrao) lines.push(`- Margem desejada configurada: ${config.margem_desejada_padrao}%`);
  if (config?.imposto_medio_sobre_vendas) lines.push(`- Imposto médio sobre vendas: ${config.imposto_medio_sobre_vendas}%`);

  lines.push("");
  lines.push("## Vendas por canal (30 dias)");
  if (canais.length === 0) lines.push("Nenhuma venda registrada.");
  else canais.forEach(([c, v]) => lines.push(`- ${c}: ${brl(v)}`));

  lines.push("");
  lines.push("## Top produtos por lucro (30 dias)");
  if (topProd.length === 0) lines.push("Sem dados.");
  else topProd.forEach((p: any) => {
    const margem = p.receita > 0 ? ((p.lucro / p.receita) * 100).toFixed(1) : "0";
    lines.push(`- ${p.nome}: receita ${brl(Number(p.receita))}, lucro ${brl(Number(p.lucro))} (margem ${margem}%), ${Number(p.quantidade).toFixed(0)}un`);
  });

  lines.push("");
  lines.push(`## Catálogo ativo: ${produtos.length} produtos`);
  if (produtos.length > 0 && produtos.length <= 20) {
    produtos.slice(0, 20).forEach((p: any) => {
      lines.push(`- ${p.nome} (${p.categoria || "sem categoria"}): ${brl(Number(p.preco_venda))}`);
    });
  }

  lines.push("");
  lines.push("## Alertas de custo ativos");
  if (alertas.length === 0) lines.push("Nenhum alerta.");
  else alertas.forEach((a: any) => {
    lines.push(`- ${a.insumos?.nome || "insumo"} subiu ${Number(a.variacao_pct).toFixed(1)}% — afetou ${a.produtos?.nome || "produto"} (margem caiu para ${Number(a.margem_depois || 0).toFixed(1)}%, meta ${a.margem_meta}%, pior canal: ${a.canal_pior})`);
  });

  lines.push("");
  lines.push("## Estoque abaixo do mínimo");
  if (insumosLow.length === 0) lines.push("Nenhum item crítico.");
  else insumosLow.slice(0, 15).forEach((i: any) => {
    lines.push(`- ${i.nome}: ${Number(i.estoque_atual).toFixed(2)}${i.unidade_medida} (mínimo ${Number(i.estoque_minimo).toFixed(2)}${i.unidade_medida})`);
  });

  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { data: usuario } = await supabase.from("usuarios").select("empresa_id, nome").eq("id", userId).single();
    if (!usuario?.empresa_id) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const empresaId = usuario.empresa_id;

    const body = await req.json();
    const { threadId, messages } = body as { threadId: string; messages: UIMessage[] };
    if (!threadId || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verifica que a thread pertence ao usuário
    const { data: thread, error: threadErr } = await supabase
      .from("ai_chat_threads")
      .select("id, user_id, empresa_id, message_count, title")
      .eq("id", threadId)
      .maybeSingle();

    if (threadErr || !thread || thread.user_id !== userId || thread.empresa_id !== empresaId) {
      return new Response(JSON.stringify({ error: "Thread inválida" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Quota
    const { data: empresa } = await supabase.from("empresas").select("plano_assinatura").eq("id", empresaId).maybeSingle();
    const plan = empresa?.plano_assinatura === "pro" ? "pro" : "standard";
    const { data: quotaCheck } = await supabase.rpc("check_and_increment_ai_quota", {
      p_empresa_id: empresaId,
      p_feature: "chat",
      p_plan: plan,
    });
    const quotaRow = Array.isArray(quotaCheck) ? quotaCheck[0] : quotaCheck;
    if (quotaRow && !quotaRow.allowed) {
      return new Response(JSON.stringify({ error: "quota_excedida", quota: quotaRow }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persistir a última mensagem do usuário
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      const textContent = (lastUserMsg.parts || [])
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("");
      await supabase.from("ai_chat_messages").insert({
        thread_id: threadId,
        role: "user",
        content: textContent,
        parts: lastUserMsg.parts as any,
        ai_msg_id: lastUserMsg.id,
      });

      // Se for a primeira mensagem da thread, gerar título a partir dela
      if ((thread.message_count || 0) === 0) {
        const autoTitle = textContent.slice(0, 60).trim() + (textContent.length > 60 ? "…" : "");
        await supabase.from("ai_chat_threads").update({
          title: autoTitle || "Nova conversa",
          message_count: 1,
          last_message_at: new Date().toISOString(),
        }).eq("id", threadId);
      } else {
        await supabase.from("ai_chat_threads").update({
          message_count: (thread.message_count || 0) + 1,
          last_message_at: new Date().toISOString(),
        }).eq("id", threadId);
      }
    }

    // Snapshot de negócio
    const snapshot = await buildBusinessSnapshot(supabase, empresaId);

    const systemPrompt = `Você é o **Consultor Financeiro IA** do GastroGestor, um assistente de gestão para donos de pequenos negócios de alimentação (confeitarias, marmitarias, hamburguerias, food trucks).

Sua persona:
- Fale em português brasileiro, tom direto, acolhedor e descontraído (como uma conversa de WhatsApp com um amigo contador).
- Use "você" e o nome do dono quando souber.
- Seja específico com NÚMEROS reais do negócio (use os dados do contexto abaixo).
- Quando o usuário fizer uma pergunta vaga, traga 1-2 insights concretos + 1 ação recomendada.
- Use markdown leve (negrito, listas curtas) mas nunca títulos H1/H2 dentro de respostas — só bullets e bold.
- Nunca invente dados que não estão no contexto. Se faltar informação, diga o que está faltando e oriente o usuário a cadastrar.
- Evite jargão financeiro técnico. "Margem de contribuição" vira "o quanto sobra por produto vendido", etc.
- Respostas longas só quando o usuário pedir análise profunda. Para perguntas simples, seja sucinto (2-4 frases).
- Nunca cite tabelas, IDs, ou nomes técnicos do sistema.

Hoje é ${brtNow().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.
${usuario.nome ? `Você está conversando com: ${usuario.nome}.` : ""}

---

${snapshot}

---

Responda com base nos dados acima. Se o usuário perguntar algo que requer dados não listados (ex: "vendas de março de 2023"), diga que pode consultar dos últimos 30 dias e sugira que ele veja o relatório completo no menu Relatórios.`;

    const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
    const model = gateway("google/gemini-3-flash-preview");

    const result = streamText({
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
    });

    const response = result.toUIMessageStreamResponse({
      originalMessages: messages,
      onFinish: async ({ messages: finalMessages }) => {
        try {
          const lastAssistant = [...finalMessages].reverse().find((m) => m.role === "assistant");
          if (lastAssistant) {
            const textContent = (lastAssistant.parts || [])
              .filter((p: any) => p.type === "text")
              .map((p: any) => p.text)
              .join("");
            await supabase.from("ai_chat_messages").insert({
              thread_id: threadId,
              role: "assistant",
              content: textContent,
              parts: lastAssistant.parts as any,
              ai_msg_id: lastAssistant.id,
            });
            await supabase.from("ai_chat_threads").update({
              message_count: (thread.message_count || 0) + 2,
              last_message_at: new Date().toISOString(),
            }).eq("id", threadId);
          }
        } catch (e) {
          console.error("Erro ao salvar mensagem assistant:", e);
        }
      },
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error("ai-chat error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
