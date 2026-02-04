import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Helper to get random date in past N days
function randomDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString().split('T')[0];
}

// Helper to get random date in current month
function randomDateCurrentMonth(): string {
  const today = new Date();
  const currentDay = today.getDate();
  const randomDay = Math.floor(Math.random() * currentDay) + 1;
  const date = new Date(today.getFullYear(), today.getMonth(), randomDay);
  return date.toISOString().split('T')[0];
}

// Helper to get random item from array
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to get random int between min and max
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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
    const empresaId = body.empresa_id || "857a636b-df64-4ce5-b875-ea23d41f86b7";

    console.log("Populating demo data for empresa:", empresaId);

    // 1. Get existing products
    const { data: produtos, error: prodErr } = await admin
      .from("produtos")
      .select("id, nome, preco_venda, categoria")
      .eq("empresa_id", empresaId)
      .gt("preco_venda", 0);

    if (prodErr || !produtos?.length) {
      return new Response(JSON.stringify({ error: "No products found", details: prodErr }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log(`Found ${produtos.length} products`);

    // 2. Get existing insumos
    const { data: insumos } = await admin
      .from("insumos")
      .select("id, nome, custo_unitario, unidade_medida")
      .eq("empresa_id", empresaId)
      .gt("custo_unitario", 0)
      .limit(30);

    // 3. Create clients (insert directly, not upsert)
    const clientesNomes = [
      { nome: "Maria Silva", whatsapp: "11999887766", email: "maria.silva@email.com" },
      { nome: "João Santos", whatsapp: "11988776655", email: "joao.santos@gmail.com" },
      { nome: "Ana Paula Oliveira", whatsapp: "11977665544", email: "anapaula@email.com" },
      { nome: "Carlos Eduardo", whatsapp: "11966554433", email: "carlos.edu@hotmail.com" },
      { nome: "Fernanda Costa", whatsapp: "11955443322", email: "fernanda.costa@email.com" },
      { nome: "Pedro Henrique", whatsapp: "11944332211", email: "pedro.h@gmail.com" },
      { nome: "Juliana Martins", whatsapp: "11933221100", email: "ju.martins@email.com" },
      { nome: "Ricardo Almeida", whatsapp: "11922110099", email: "ricardo.alm@email.com" },
      { nome: "Camila Rodrigues", whatsapp: "11911009988", email: "camila.r@gmail.com" },
      { nome: "Lucas Ferreira", whatsapp: "11900998877", email: "lucas.f@email.com" },
      { nome: "Beatriz Lima", whatsapp: "11898877665", email: "bia.lima@hotmail.com" },
      { nome: "Gustavo Pereira", whatsapp: "11887766554", email: "gustavo.p@gmail.com" },
    ];

    const clientesData = clientesNomes.map(c => ({
      ...c,
      empresa_id: empresaId,
      observacoes: randomItem(["Cliente frequente", "Prefere entrega", "Faz encomendas grandes", "Cliente novo", null]),
      preferencias: randomItem(["Sem açúcar", "Extra chocolate", "Frutas frescas", null]),
    }));

    // Check if clients already exist
    const { data: existingClientes } = await admin
      .from("clientes")
      .select("id")
      .eq("empresa_id", empresaId);

    if (!existingClientes?.length) {
      const { error: insertClienteErr } = await admin
        .from("clientes")
        .insert(clientesData);
      
      if (insertClienteErr) {
        console.error("Error inserting clientes:", insertClienteErr);
      }
    }

    const { data: clientes, error: clienteErr } = await admin
      .from("clientes")
      .upsert(clientesData, { onConflict: "empresa_id,email", ignoreDuplicates: true })
      .select("id, nome");

    // Fetch all clients for the empresa
    const { data: allClientes } = await admin
      .from("clientes")
      .select("id, nome")
      .eq("empresa_id", empresaId);

    console.log(`Created/found ${allClientes?.length || 0} clients`);

    // 4. Generate sales for last 90 days
    const canais = ["balcao", "ifood", "whatsapp", "instagram", "rappi"];
    const vendasData: any[] = [];
    
    // Higher volume products (best sellers)
    const topProdutos = produtos.filter(p => 
      p.categoria === "Copo da Felicidade" || 
      p.categoria === "Pequenos Encantos" ||
      p.categoria === "Favoritos da Casa" ||
      p.categoria === "Brownie's"
    );
    
    const otherProdutos = produtos.filter(p => !topProdutos.includes(p));

    // Check if we need to focus on current month
    const focusCurrentMonth = body.focus_current_month === true;
    
    // Generate 200-300 sales over 90 days OR 100-150 for current month
    const numVendas = focusCurrentMonth ? randomInt(100, 150) : randomInt(200, 300);
    
    for (let i = 0; i < numVendas; i++) {
      // 70% chance of top product, 30% other
      const produto = Math.random() < 0.7 && topProdutos.length > 0 
        ? randomItem(topProdutos) 
        : randomItem(produtos);
      
      const quantidade = randomInt(1, 4);
      const canal = randomItem(canais);
      const dataVenda = focusCurrentMonth ? randomDateCurrentMonth() : randomDate(90);
      const cliente = allClientes?.length ? randomItem(allClientes) : null;
      
      // Weekend boost (more sales on weekends)
      const dayOfWeek = new Date(dataVenda).getDay();
      if ((dayOfWeek === 0 || dayOfWeek === 6) && Math.random() < 0.3) {
        // Extra sale on weekend
        vendasData.push({
          empresa_id: empresaId,
          produto_id: produto.id,
          quantidade: randomInt(1, 3),
          valor_total: produto.preco_venda * randomInt(1, 3),
          data_venda: dataVenda,
          canal: randomItem(canais),
          origem: "manual",
          tipo_venda: "direto",
          cliente_id: cliente?.id || null,
        });
      }
      
      vendasData.push({
        empresa_id: empresaId,
        produto_id: produto.id,
        quantidade,
        valor_total: produto.preco_venda * quantidade,
        data_venda: dataVenda,
        canal,
        origem: Math.random() < 0.3 ? "importacao" : "manual",
        tipo_venda: Math.random() < 0.2 ? "encomenda" : "direto",
        cliente_id: cliente?.id || null,
      });
    }

    const { error: vendasErr } = await admin.from("vendas").insert(vendasData);
    if (vendasErr) {
      console.error("Error inserting vendas:", vendasErr);
    }
    console.log(`Created ${vendasData.length} sales`);

    // 5. Generate productions for last 60 days (or current month)
    const producoesData: any[] = [];
    const numProducoes = focusCurrentMonth ? randomInt(20, 40) : randomInt(40, 70);
    
    for (let i = 0; i < numProducoes; i++) {
      const produto = randomItem(produtos);
      const baseDate = focusCurrentMonth ? randomDateCurrentMonth() : randomDate(60);
      const createdAt = baseDate + "T" + String(randomInt(6, 18)).padStart(2, '0') + ":00:00Z";
      const shelfLife = randomInt(3, 14);
      const dataVencimento = new Date(createdAt);
      dataVencimento.setDate(dataVencimento.getDate() + shelfLife);
      
      producoesData.push({
        empresa_id: empresaId,
        produto_id: produto.id,
        quantidade: randomInt(5, 30),
        shelf_life_dias: shelfLife,
        data_vencimento: dataVencimento.toISOString().split('T')[0],
        dias_alerta_vencimento: 3,
        observacao: Math.random() < 0.2 ? randomItem(["Lote especial", "Para encomenda", "Estoque", null]) : null,
        created_at: createdAt,
      });
    }

    const { error: prodErr2 } = await admin.from("producoes").insert(producoesData);
    if (prodErr2) {
      console.error("Error inserting producoes:", prodErr2);
    }
    console.log(`Created ${producoesData.length} productions`);

    // 6. Generate stock movements (purchases) for last 90 days
    if (insumos?.length) {
      const movimentosData: any[] = [];
      const numCompras = randomInt(80, 120);
      
      for (let i = 0; i < numCompras; i++) {
        const insumo = randomItem(insumos);
        const quantidade = randomInt(5, 50);
        const custoTotal = insumo.custo_unitario * quantidade;
        
        movimentosData.push({
          empresa_id: empresaId,
          insumo_id: insumo.id,
          quantidade,
          tipo: "entrada",
          origem: Math.random() < 0.6 ? "compra" : "manual",
          custo_total: custoTotal,
          observacao: Math.random() < 0.2 ? randomItem(["Fornecedor A", "Atacadão", "Makro", "Assaí"]) : null,
          created_at: randomDate(90) + "T10:00:00Z",
        });
      }

      // Add some stock exits (losses, adjustments)
      const numSaidas = randomInt(10, 25);
      for (let i = 0; i < numSaidas; i++) {
        const insumo = randomItem(insumos);
        movimentosData.push({
          empresa_id: empresaId,
          insumo_id: insumo.id,
          quantidade: -randomInt(1, 10),
          tipo: "saida",
          origem: randomItem(["perda", "vencimento", "avaria", "ajuste"]),
          observacao: randomItem(["Produto vencido", "Avaria no transporte", "Ajuste de inventário", null]),
          created_at: randomDate(60) + "T14:00:00Z",
        });
      }

      const { error: movErr } = await admin.from("estoque_movimentos").insert(movimentosData);
      if (movErr) {
        console.error("Error inserting movimentos:", movErr);
      }
      console.log(`Created ${movimentosData.length} stock movements`);
    }

    // 7. Generate cash movements for last 90 days
    const caixaData: any[] = [];
    
    // Fixed costs entries
    const { data: custosFixos } = await admin
      .from("custos_fixos")
      .select("id, nome, valor_mensal")
      .eq("empresa_id", empresaId);

    // Monthly fixed costs for last 3 months
    for (let month = 0; month < 3; month++) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - month);
      const dateStr = monthDate.toISOString().split('T')[0];
      
      if (custosFixos?.length) {
        for (const custo of custosFixos) {
          caixaData.push({
            empresa_id: empresaId,
            tipo: "saida",
            categoria: "custo_fixo",
            descricao: custo.nome,
            valor: -Math.abs(custo.valor_mensal),
            data_movimento: dateStr,
            origem: "automatico",
            referencia: custo.id,
          });
        }
      }
    }

    // Random cash entries/exits
    const numCaixaMovimentos = randomInt(30, 50);
    const categoriasSaida = ["fornecedor", "manutencao", "material", "transporte", "outros"];
    const categoriasEntrada = ["venda_avulsa", "antecipacao", "outros"];

    for (let i = 0; i < numCaixaMovimentos; i++) {
      const isEntrada = Math.random() < 0.3;
      caixaData.push({
        empresa_id: empresaId,
        tipo: isEntrada ? "entrada" : "saida",
        categoria: isEntrada ? randomItem(categoriasEntrada) : randomItem(categoriasSaida),
        descricao: isEntrada 
          ? randomItem(["Venda no local", "Pagamento antecipado", "Entrada avulsa"])
          : randomItem(["Compra de insumos", "Manutenção equipamento", "Material de limpeza", "Combustível", "Embalagens extras"]),
        valor: isEntrada ? randomInt(50, 500) : -randomInt(30, 400),
        data_movimento: randomDate(90),
        origem: "manual",
      });
    }

    const { error: caixaErr } = await admin.from("caixa_movimentos").insert(caixaData);
    if (caixaErr) {
      console.error("Error inserting caixa:", caixaErr);
    }
    console.log(`Created ${caixaData.length} cash movements`);

    // 8. Update insumos stock levels
    if (insumos?.length) {
      for (const insumo of insumos.slice(0, 20)) {
        await admin
          .from("insumos")
          .update({ 
            estoque_atual: randomInt(10, 200),
            estoque_minimo: randomInt(5, 30),
          })
          .eq("id", insumo.id);
      }
      console.log("Updated stock levels for 20 insumos");
    }

    return new Response(JSON.stringify({
      success: true,
      summary: {
        empresa_id: empresaId,
        clientes_created: allClientes?.length || 0,
        vendas_created: vendasData.length,
        producoes_created: producoesData.length,
        movimentos_created: insumos?.length ? "100+" : 0,
        caixa_created: caixaData.length,
      }
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
