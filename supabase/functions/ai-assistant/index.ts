import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token for RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's empresa_id
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("empresa_id, nome")
      .eq("id", user.id)
      .single();

    if (!usuario?.empresa_id) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const empresaId = usuario.empresa_id;
    console.log(`Fetching context for empresa: ${empresaId}`);

    // Fetch user context data in parallel
    const [
      { data: produtos },
      { data: insumos },
      { data: vendas },
      { data: configuracoes },
      { data: custosFixos },
      { data: taxasApps },
    ] = await Promise.all([
      supabase
        .from("produtos")
        .select(`
          id, nome, preco_venda, categoria, ativo,
          fichas_tecnicas(quantidade, insumos:insumo_id(nome, custo_unitario, unidade_medida))
        `)
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .limit(50),
      supabase
        .from("insumos")
        .select("id, nome, custo_unitario, unidade_medida, estoque_atual, estoque_minimo")
        .eq("empresa_id", empresaId)
        .eq("is_intermediario", false)
        .limit(50),
      supabase
        .from("vendas")
        .select("id, data_venda, valor_total, quantidade, canal, produto_id")
        .eq("empresa_id", empresaId)
        .order("data_venda", { ascending: false })
        .limit(100),
      supabase
        .from("configuracoes")
        .select("*")
        .eq("empresa_id", empresaId)
        .single(),
      supabase
        .from("custos_fixos")
        .select("nome, valor_mensal, categoria")
        .eq("empresa_id", empresaId),
      supabase
        .from("taxas_apps")
        .select("nome_app, taxa_percentual, ativo")
        .eq("empresa_id", empresaId)
        .eq("ativo", true),
    ]);

    // Calculate some key metrics
    const totalProdutos = produtos?.length || 0;
    const totalInsumos = insumos?.length || 0;
    
    // Calculate sales metrics for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const vendasRecentes = vendas?.filter(v => new Date(v.data_venda) >= thirtyDaysAgo) || [];
    const faturamentoMensal = vendasRecentes.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    const totalVendasMes = vendasRecentes.length;

    // Calculate cost per product
    const produtosComCusto = produtos?.map(p => {
      const fichas = p.fichas_tecnicas as any[] || [];
      const custoInsumos = fichas.reduce((sum, f) => {
        const insumo = f.insumos;
        return sum + (f.quantidade * (insumo?.custo_unitario || 0));
      }, 0);
      const margem = p.preco_venda > 0 ? ((p.preco_venda - custoInsumos) / p.preco_venda) * 100 : 0;
      return {
        nome: p.nome,
        preco: p.preco_venda,
        custo: custoInsumos,
        margem: margem.toFixed(1),
        categoria: p.categoria,
      };
    }) || [];

    // Insumos com estoque baixo
    const insumosEstoqueBaixo = insumos?.filter(i => i.estoque_atual <= i.estoque_minimo) || [];

    // Total custos fixos
    const totalCustosFixos = custosFixos?.reduce((sum, c) => sum + c.valor_mensal, 0) || 0;

    // Build context
    const userContext = `
## DADOS DO NEGÓCIO DO USUÁRIO (${usuario.nome})

### Resumo Geral
- Total de produtos ativos: ${totalProdutos}
- Total de insumos cadastrados: ${totalInsumos}
- Vendas nos últimos 30 dias: ${totalVendasMes} vendas
- Faturamento últimos 30 dias: R$ ${faturamentoMensal.toFixed(2)}
- Custos fixos mensais: R$ ${totalCustosFixos.toFixed(2)}

### Configurações
- CMV alvo: ${configuracoes?.cmv_alvo || 30}%
- Margem desejada padrão: ${configuracoes?.margem_desejada_padrao || 50}%
- Imposto médio sobre vendas: ${configuracoes?.imposto_medio_sobre_vendas || 0}%

### Canais de Venda (Apps Delivery)
${taxasApps?.map(a => `- ${a.nome_app}: ${a.taxa_percentual}% de taxa`).join("\n") || "Nenhum app configurado"}

### Produtos (${produtosComCusto.length} ativos)
${produtosComCusto.slice(0, 20).map(p => 
  `- ${p.nome}: Preço R$ ${p.preco.toFixed(2)} | Custo R$ ${p.custo.toFixed(2)} | Margem ${p.margem}%`
).join("\n")}
${produtosComCusto.length > 20 ? `... e mais ${produtosComCusto.length - 20} produtos` : ""}

### Alertas
${insumosEstoqueBaixo.length > 0 
  ? `⚠️ ${insumosEstoqueBaixo.length} insumos com estoque baixo: ${insumosEstoqueBaixo.map(i => i.nome).join(", ")}`
  : "✅ Nenhum alerta de estoque"}

### Insumos Principais (primeiros 15)
${insumos?.slice(0, 15).map(i => 
  `- ${i.nome}: R$ ${i.custo_unitario.toFixed(4)}/${i.unidade_medida} | Estoque: ${i.estoque_atual} ${i.unidade_medida}`
).join("\n") || "Nenhum insumo cadastrado"}
`;

    const systemPrompt = `Você é o Assistente do iFood Profit Buddy, um sistema de gestão de custos e precificação para restaurantes, confeitarias e food services.

## SEU PAPEL
- Ajudar o usuário a entender e usar o sistema
- Responder dúvidas sobre precificação, custos, margens e gestão
- Analisar os dados do negócio do usuário e dar insights personalizados
- Sugerir melhorias baseadas nos dados reais

## CONHECIMENTO DO SISTEMA
O sistema permite:
1. **Insumos**: Cadastrar ingredientes com custo unitário e controle de estoque
2. **Produtos**: Cadastrar produtos finais com ficha técnica (receita)
3. **Ficha Técnica**: Vincular insumos aos produtos com quantidades
4. **Precificação**: Calcular preço ideal baseado em margem, CMV alvo e taxas de delivery
5. **Vendas**: Registrar vendas manuais ou importar de apps (iFood, Rappi, etc.)
6. **Compras**: Importar notas fiscais XML ou foto para atualizar custos
7. **Relatórios**: Visualizar rentabilidade por produto e canal
8. **Custos Fixos**: Cadastrar despesas fixas mensais

## FÓRMULAS IMPORTANTES
- **CMV (Custo Mercadoria Vendida)** = Custo dos Insumos / Preço de Venda × 100
- **Margem de Contribuição** = (Preço - Custo - Taxas) / Preço × 100
- **Preço Sugerido** = Custo / (1 - Margem Desejada/100 - Taxa App/100)

## DICAS DE MERCADO ALIMENTÍCIO
- CMV ideal: 25-35% (confeitaria pode ser menor, restaurante pode ser maior)
- Considerar sazonalidade de ingredientes
- Delivery tem taxa que impacta margem
- Embalagens são custo importante no delivery

${userContext}

## INSTRUÇÕES
1. Sempre use os dados reais do usuário quando relevante
2. Seja direto e prático nas respostas
3. Use emojis para tornar a leitura mais agradável
4. Quando der sugestões de preço, mostre os cálculos
5. Se não souber algo específico do sistema, oriente a explorar o menu
6. Responda sempre em português brasileiro
7. Seja amigável e encorajador`;

    console.log("Calling Lovable AI gateway...");

    // Call Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Contate o suporte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erro ao processar sua pergunta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response back to client");

    // Stream the response
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("AI Assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
