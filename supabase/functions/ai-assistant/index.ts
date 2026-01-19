import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
}

// Define available tools
const tools = [
  {
    type: "function",
    function: {
      name: "criar_insumo",
      description: "Cria um novo insumo/ingrediente no sistema. Use quando o usuário pedir para cadastrar um insumo.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome do insumo (ex: Farinha de trigo, Açúcar)" },
          custo_unitario: { type: "number", description: "Custo por unidade de medida em reais (ex: 5.50)" },
          unidade_medida: { type: "string", description: "Unidade de medida: g, kg, ml, L, un" },
          estoque_atual: { type: "number", description: "Quantidade atual em estoque (opcional, padrão: 0)" },
          estoque_minimo: { type: "number", description: "Estoque mínimo para alerta (opcional, padrão: 0)" },
        },
        required: ["nome", "custo_unitario", "unidade_medida"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_produto",
      description: "Cria um novo produto no sistema. Use quando o usuário pedir para cadastrar um produto.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome do produto (ex: Brigadeiro, Bolo de chocolate)" },
          preco_venda: { type: "number", description: "Preço de venda em reais" },
          categoria: { type: "string", description: "Categoria do produto (ex: Doces, Salgados, Bolos)" },
        },
        required: ["nome", "preco_venda"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_produto_com_ficha_tecnica",
      description: "Cria um produto completo com sua ficha técnica (receita/ingredientes). Use quando o usuário fornecer um produto com seus ingredientes.",
      parameters: {
        type: "object",
        properties: {
          nome_produto: { type: "string", description: "Nome do produto" },
          preco_venda: { type: "number", description: "Preço de venda em reais (0 se não informado)" },
          categoria: { type: "string", description: "Categoria do produto" },
          ingredientes: {
            type: "array",
            description: "Lista de ingredientes com quantidades",
            items: {
              type: "object",
              properties: {
                nome_insumo: { type: "string", description: "Nome do insumo" },
                quantidade: { type: "number", description: "Quantidade usada na receita" },
                unidade_medida: { type: "string", description: "Unidade: g, kg, ml, L, un" },
                custo_unitario: { type: "number", description: "Custo por unidade (se conhecido)" },
              },
              required: ["nome_insumo", "quantidade"],
            },
          },
        },
        required: ["nome_produto", "ingredientes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_venda",
      description: "Registra uma venda no sistema. Use quando o usuário informar uma venda realizada.",
      parameters: {
        type: "object",
        properties: {
          nome_produto: { type: "string", description: "Nome do produto vendido" },
          quantidade: { type: "number", description: "Quantidade vendida" },
          valor_total: { type: "number", description: "Valor total da venda em reais" },
          canal: { type: "string", description: "Canal de venda: balcao, ifood, rappi, whatsapp, etc." },
        },
        required: ["nome_produto", "quantidade", "valor_total"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_preco_insumo",
      description: "Atualiza o preço de um insumo existente. Use quando o usuário informar novo preço de um ingrediente.",
      parameters: {
        type: "object",
        properties: {
          nome_insumo: { type: "string", description: "Nome do insumo a atualizar" },
          novo_custo: { type: "number", description: "Novo custo unitário em reais" },
        },
        required: ["nome_insumo", "novo_custo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_estoque",
      description: "Atualiza o estoque de um insumo. Use para entrada ou saída manual de estoque.",
      parameters: {
        type: "object",
        properties: {
          nome_insumo: { type: "string", description: "Nome do insumo" },
          quantidade: { type: "number", description: "Quantidade a adicionar (positivo) ou remover (negativo)" },
          tipo: { type: "string", enum: ["entrada", "saida"], description: "Tipo de movimentação" },
          observacao: { type: "string", description: "Motivo da movimentação" },
        },
        required: ["nome_insumo", "quantidade", "tipo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cadastrar_custo_fixo",
      description: "Cadastra um custo fixo mensal. Use quando o usuário informar despesas fixas como aluguel, luz, etc.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome do custo (ex: Aluguel, Energia, Internet)" },
          valor_mensal: { type: "number", description: "Valor mensal em reais" },
          categoria: { type: "string", description: "Categoria: Infraestrutura, Serviços, Pessoal, Outros" },
        },
        required: ["nome", "valor_mensal"],
      },
    },
  },
];

// Tool execution functions
async function executeTool(
  supabase: any,
  empresaId: string,
  toolName: string,
  args: any
): Promise<{ success: boolean; message: string; data?: any }> {
  console.log(`Executing tool: ${toolName}`, args);

  try {
    switch (toolName) {
      case "criar_insumo": {
        const { data, error } = await supabase.from("insumos").insert({
          empresa_id: empresaId,
          nome: args.nome,
          custo_unitario: args.custo_unitario,
          unidade_medida: args.unidade_medida || "g",
          estoque_atual: args.estoque_atual || 0,
          estoque_minimo: args.estoque_minimo || 0,
        }).select().single();
        
        if (error) throw error;
        return { success: true, message: `✅ Insumo "${args.nome}" cadastrado com sucesso!`, data };
      }

      case "criar_produto": {
        const { data, error } = await supabase.from("produtos").insert({
          empresa_id: empresaId,
          nome: args.nome,
          preco_venda: args.preco_venda || 0,
          categoria: args.categoria || null,
        }).select().single();
        
        if (error) throw error;
        return { success: true, message: `✅ Produto "${args.nome}" cadastrado com sucesso!`, data };
      }

      case "criar_produto_com_ficha_tecnica": {
        // 1. Create or find insumos
        const insumosIds: { [key: string]: string } = {};
        
        for (const ing of args.ingredientes) {
          // Try to find existing insumo
          const { data: existingInsumo } = await supabase
            .from("insumos")
            .select("id")
            .eq("empresa_id", empresaId)
            .ilike("nome", ing.nome_insumo)
            .limit(1)
            .single();

          if (existingInsumo) {
            insumosIds[ing.nome_insumo] = existingInsumo.id;
          } else {
            // Create new insumo
            const { data: newInsumo, error } = await supabase.from("insumos").insert({
              empresa_id: empresaId,
              nome: ing.nome_insumo,
              custo_unitario: ing.custo_unitario || 0,
              unidade_medida: ing.unidade_medida || "g",
              estoque_atual: 0,
              estoque_minimo: 0,
            }).select().single();
            
            if (error) throw error;
            insumosIds[ing.nome_insumo] = newInsumo.id;
          }
        }

        // 2. Create produto
        const { data: produto, error: prodError } = await supabase.from("produtos").insert({
          empresa_id: empresaId,
          nome: args.nome_produto,
          preco_venda: args.preco_venda || 0,
          categoria: args.categoria || null,
        }).select().single();
        
        if (prodError) throw prodError;

        // 3. Create ficha técnica
        const fichaItems = args.ingredientes.map((ing: any) => ({
          produto_id: produto.id,
          insumo_id: insumosIds[ing.nome_insumo],
          quantidade: ing.quantidade,
        }));

        const { error: fichaError } = await supabase.from("fichas_tecnicas").insert(fichaItems);
        if (fichaError) throw fichaError;

        const newInsumos = args.ingredientes.filter((ing: any) => !insumosIds[ing.nome_insumo]);
        return { 
          success: true, 
          message: `✅ Produto "${args.nome_produto}" cadastrado com ${args.ingredientes.length} ingredientes!${newInsumos.length > 0 ? ` (${newInsumos.length} novos insumos criados)` : ''}`,
          data: produto 
        };
      }

      case "registrar_venda": {
        // Find produto by name
        const { data: produto } = await supabase
          .from("produtos")
          .select("id, preco_venda")
          .eq("empresa_id", empresaId)
          .ilike("nome", `%${args.nome_produto}%`)
          .limit(1)
          .single();

        const { data, error } = await supabase.from("vendas").insert({
          empresa_id: empresaId,
          produto_id: produto?.id || null,
          descricao_produto: produto ? null : args.nome_produto,
          quantidade: args.quantidade,
          valor_total: args.valor_total,
          canal: args.canal || "balcao",
          data_venda: new Date().toISOString().split('T')[0],
          tipo_venda: "produto",
        }).select().single();
        
        if (error) throw error;
        return { 
          success: true, 
          message: `✅ Venda registrada: ${args.quantidade}x ${args.nome_produto} = R$ ${args.valor_total.toFixed(2)}`,
          data 
        };
      }

      case "atualizar_preco_insumo": {
        const { data: insumo } = await supabase
          .from("insumos")
          .select("id, nome, custo_unitario")
          .eq("empresa_id", empresaId)
          .ilike("nome", `%${args.nome_insumo}%`)
          .limit(1)
          .single();

        if (!insumo) {
          return { success: false, message: `❌ Insumo "${args.nome_insumo}" não encontrado.` };
        }

        const precoAnterior = insumo.custo_unitario;
        const { error } = await supabase
          .from("insumos")
          .update({ custo_unitario: args.novo_custo })
          .eq("id", insumo.id);

        if (error) throw error;

        // Register price history
        await supabase.from("historico_precos").insert({
          empresa_id: empresaId,
          insumo_id: insumo.id,
          preco_anterior: precoAnterior,
          preco_novo: args.novo_custo,
          origem: "assistente_ia",
          variacao_percentual: precoAnterior > 0 ? ((args.novo_custo - precoAnterior) / precoAnterior) * 100 : null,
        });

        return { 
          success: true, 
          message: `✅ Preço de "${insumo.nome}" atualizado: R$ ${precoAnterior.toFixed(2)} → R$ ${args.novo_custo.toFixed(2)}` 
        };
      }

      case "atualizar_estoque": {
        const { data: insumo } = await supabase
          .from("insumos")
          .select("id, nome, estoque_atual, unidade_medida")
          .eq("empresa_id", empresaId)
          .ilike("nome", `%${args.nome_insumo}%`)
          .limit(1)
          .single();

        if (!insumo) {
          return { success: false, message: `❌ Insumo "${args.nome_insumo}" não encontrado.` };
        }

        const { error } = await supabase.from("estoque_movimentos").insert({
          empresa_id: empresaId,
          insumo_id: insumo.id,
          tipo: args.tipo,
          quantidade: Math.abs(args.quantidade),
          origem: "assistente_ia",
          observacao: args.observacao || "Ajuste via Assistente IA",
        });

        if (error) throw error;

        const novoEstoque = args.tipo === "entrada" 
          ? insumo.estoque_atual + Math.abs(args.quantidade)
          : insumo.estoque_atual - Math.abs(args.quantidade);

        return { 
          success: true, 
          message: `✅ Estoque de "${insumo.nome}" atualizado: ${args.tipo === "entrada" ? "+" : "-"}${Math.abs(args.quantidade)} ${insumo.unidade_medida} (agora: ${novoEstoque.toFixed(2)} ${insumo.unidade_medida})` 
        };
      }

      case "cadastrar_custo_fixo": {
        const { data, error } = await supabase.from("custos_fixos").insert({
          empresa_id: empresaId,
          nome: args.nome,
          valor_mensal: args.valor_mensal,
          categoria: args.categoria || "Outros",
        }).select().single();
        
        if (error) throw error;
        return { 
          success: true, 
          message: `✅ Custo fixo "${args.nome}" cadastrado: R$ ${args.valor_mensal.toFixed(2)}/mês`,
          data 
        };
      }

      default:
        return { success: false, message: `Ferramenta "${toolName}" não reconhecida.` };
    }
  } catch (error) {
    console.error(`Tool error (${toolName}):`, error);
    return { 
      success: false, 
      message: `❌ Erro ao executar ação: ${error instanceof Error ? error.message : "Erro desconhecido"}` 
    };
  }
}

serve(async (req) => {
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
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, executeAction, pendingAction, pendingActions } = await req.json();
    
    const DAILY_LIMIT = 50;
    const today = new Date().toISOString().split('T')[0];
    
    // Helper function to check and update usage
    async function checkAndUpdateUsage(userId: string, empresaId: string): Promise<{ allowed: boolean; remaining: number }> {
      // Get current usage
      const { data: usageData } = await supabase
        .from("ai_usage")
        .select("id, message_count")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();
      
      const currentCount = usageData?.message_count || 0;
      
      if (currentCount >= DAILY_LIMIT) {
        return { allowed: false, remaining: 0 };
      }
      
      // Update or insert usage
      if (usageData) {
        await supabase
          .from("ai_usage")
          .update({ message_count: currentCount + 1 })
          .eq("id", usageData.id);
      } else {
        await supabase
          .from("ai_usage")
          .insert({
            user_id: userId,
            empresa_id: empresaId,
            date: today,
            message_count: 1,
          });
      }
      
      return { allowed: true, remaining: DAILY_LIMIT - currentCount - 1 };
    }
    
    // If executing multiple confirmed actions
    if (executeAction && pendingActions && Array.isArray(pendingActions)) {
      console.log("Executing multiple confirmed actions:", pendingActions.length);
      const { data: usuario } = await supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("id", user.id)
        .single();
      
      if (!usuario?.empresa_id) {
        return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const results = [];
      for (const action of pendingActions) {
        const result = await executeTool(supabase, usuario.empresa_id, action.toolName, action.args);
        results.push(result);
      }
      
      return new Response(JSON.stringify({ 
        actionResults: results,
        executed: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // If executing a single confirmed action
    if (executeAction && pendingAction) {
      console.log("Executing confirmed action:", pendingAction.toolName);
      const { data: usuario } = await supabase
        .from("usuarios")
        .select("empresa_id")
        .eq("id", user.id)
        .single();
      
      if (!usuario?.empresa_id) {
        return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const result = await executeTool(supabase, usuario.empresa_id, pendingAction.toolName, pendingAction.args);
      return new Response(JSON.stringify({ 
        actionResult: result,
        executed: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Mensagens inválidas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    
    // Check usage limit before processing message
    const usageCheck = await checkAndUpdateUsage(user.id, empresaId);
    if (!usageCheck.allowed) {
      return new Response(JSON.stringify({ 
        error: "Limite diário atingido",
        limitReached: true,
        remaining: 0,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log(`Fetching context for empresa: ${empresaId}, remaining: ${usageCheck.remaining}`);

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

    // Calculate metrics
    const totalProdutos = produtos?.length || 0;
    const totalInsumos = insumos?.length || 0;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const vendasRecentes = vendas?.filter(v => new Date(v.data_venda) >= thirtyDaysAgo) || [];
    const faturamentoMensal = vendasRecentes.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    const totalVendasMes = vendasRecentes.length;

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

    const insumosEstoqueBaixo = insumos?.filter(i => i.estoque_atual <= i.estoque_minimo) || [];
    const totalCustosFixos = custosFixos?.reduce((sum, c) => sum + c.valor_mensal, 0) || 0;

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

### Insumos Cadastrados (${insumos?.length || 0})
${insumos?.slice(0, 15).map(i => 
  `- ${i.nome}: R$ ${i.custo_unitario.toFixed(4)}/${i.unidade_medida} | Estoque: ${i.estoque_atual} ${i.unidade_medida}`
).join("\n") || "Nenhum insumo cadastrado"}
`;

    const systemPrompt = `Você é o Assistente de IA do Gastro Gestor, uma plataforma de gestão de custos e precificação para restaurantes, confeitarias e food services.

## SEU PAPEL
- Ajudar o usuário a entender e usar o sistema
- Responder dúvidas sobre precificação, custos, margens e gestão
- Analisar os dados do negócio e dar insights personalizados
- **EXECUTAR AÇÕES no sistema quando o usuário pedir** (cadastros, atualizações, etc.)

## FERRAMENTAS DISPONÍVEIS
Você tem acesso a ferramentas para executar ações reais no sistema:
- criar_insumo: Cadastrar novos ingredientes
- criar_produto: Cadastrar novos produtos
- criar_produto_com_ficha_tecnica: Cadastrar produto COM receita/ingredientes
- registrar_venda: Registrar vendas
- atualizar_preco_insumo: Atualizar preço de ingrediente
- atualizar_estoque: Entrada ou saída de estoque
- cadastrar_custo_fixo: Cadastrar custos fixos mensais

## QUANDO USAR FERRAMENTAS
USE as ferramentas quando o usuário:
- Pedir para cadastrar algo (insumo, produto, venda, custo)
- Enviar uma ficha técnica/receita
- Informar preços novos de ingredientes
- Pedir para registrar uma venda
- Quiser atualizar estoque

## COMO INTERPRETAR FICHAS TÉCNICAS
Quando o usuário enviar algo como:
"Brigadeiro: 100g leite condensado, 20g chocolate em pó, 10g manteiga"
Você deve usar criar_produto_com_ficha_tecnica com os ingredientes extraídos.

## CONHECIMENTO DO SISTEMA
1. **Insumos**: Ingredientes com custo unitário e estoque
2. **Produtos**: Produtos finais com ficha técnica
3. **Ficha Técnica**: Receita = quais insumos e quantidades
4. **Precificação**: Preço = Custo / (1 - Margem - Taxas)
5. **Vendas**: Por canal (balcão, iFood, Rappi, etc.)

## FÓRMULAS
- **CMV** = Custo / Preço × 100
- **Margem** = (Preço - Custo) / Preço × 100
- **Preço Sugerido** = Custo / (1 - MargemDesejada/100)

${userContext}

## INSTRUÇÕES
1. Quando o usuário pedir uma ação, USE A FERRAMENTA apropriada
2. Após executar, confirme o que foi feito
3. Se faltar informação, pergunte antes de executar
4. Seja direto e use emojis
5. Responda em português brasileiro
6. Se não tiver certeza do que fazer, pergunte`;

    console.log("Calling AI with tools...");

    // First call - may return tool calls
    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um momento." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Erro ao processar sua pergunta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result = await response.json();
    let assistantMessage = result.choices?.[0]?.message;

    // Check if AI wants to call tools
    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log("AI requested tool calls:", assistantMessage.tool_calls.length);

      // Build pending actions for confirmation
      const pendingActions = assistantMessage.tool_calls.map((tc: any) => {
        const toolName = tc.function.name;
        const args = JSON.parse(tc.function.arguments);
        
        // Generate human-readable description
        let description = "";
        switch (toolName) {
          case "criar_insumo":
            description = `Cadastrar insumo "${args.nome}" a R$ ${args.custo_unitario?.toFixed(2) || '0.00'}/${args.unidade_medida || 'g'}`;
            break;
          case "criar_produto":
            description = `Cadastrar produto "${args.nome}" por R$ ${args.preco_venda?.toFixed(2) || '0.00'}`;
            break;
          case "criar_produto_com_ficha_tecnica":
            description = `Cadastrar produto "${args.nome_produto}" com ${args.ingredientes?.length || 0} ingredientes`;
            break;
          case "registrar_venda":
            description = `Registrar venda: ${args.quantidade}x ${args.nome_produto} = R$ ${args.valor_total?.toFixed(2) || '0.00'}`;
            break;
          case "atualizar_preco_insumo":
            description = `Atualizar preço de "${args.nome_insumo}" para R$ ${args.novo_custo?.toFixed(2) || '0.00'}`;
            break;
          case "atualizar_estoque":
            description = `${args.tipo === 'entrada' ? 'Adicionar' : 'Remover'} ${Math.abs(args.quantidade)} de "${args.nome_insumo}"`;
            break;
          case "cadastrar_custo_fixo":
            description = `Cadastrar custo fixo "${args.nome}": R$ ${args.valor_mensal?.toFixed(2) || '0.00'}/mês`;
            break;
          default:
            description = `Executar: ${toolName}`;
        }
        
        return {
          id: tc.id,
          toolName,
          args,
          description,
        };
      });

      // Return pending actions for confirmation
      return new Response(JSON.stringify({ 
        pendingActions,
        requiresConfirmation: true,
        assistantPreview: assistantMessage.content || "Entendi! Vou executar as seguintes ações:",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No tool calls - stream regular response
    // Need to make a new streaming request
    const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    return new Response(streamResponse.body, {
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
