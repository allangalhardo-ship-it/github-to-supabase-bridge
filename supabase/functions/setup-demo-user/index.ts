// Edge Function: setup-demo-user
// Cria/reseta usuário demo (demo@gastrogestor.com.br) clonando catálogo da empresa
// "Docesarin" (Guilherme) e populando movimentos fictícios para demonstração.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SOURCE_EMPRESA_ID = "90257e2a-fabe-493e-b47e-ced30990dc3a"; // Docesarin
const DEMO_EMAIL = "demo@gastrogestor.com.br";
const DEMO_PASSWORD = "GastroDemo@2026";
const DEMO_EMPRESA_NOME = "Doces da Marta (Demo)";

function rndInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function daysAgo(d: number) {
  const dt = new Date(); dt.setDate(dt.getDate() - d);
  return dt.toISOString().split("T")[0];
}
function daysAhead(d: number) {
  const dt = new Date(); dt.setDate(dt.getDate() + d);
  return dt.toISOString().split("T")[0];
}

const CANAIS_NOMES = ["Balcão", "iFood", "WhatsApp", "99Food"];
const NOMES_CLIENTES = [
  "Maria Oliveira", "Ana Paula Souza", "Juliana Costa", "Patrícia Lima",
  "Camila Rodrigues", "Fernanda Almeida", "Beatriz Santos", "Larissa Ferreira",
  "Roberta Martins", "Carla Mendes", "Vanessa Carvalho", "Tatiane Ribeiro",
  "Bruna Araújo", "Letícia Barbosa", "Renata Pereira",
];
const BAIRROS = [
  { nome: "Centro", taxa: 5 },
  { nome: "Jardim das Flores", taxa: 7 },
  { nome: "Vila Nova", taxa: 8 },
  { nome: "Bairro Alto", taxa: 10 },
  { nome: "Boa Vista", taxa: 6 },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const action = body.action || "setup"; // 'setup' | 'reset'

    // ====================== ENSURE AUTH USER ======================
    const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let demoAuthUser = usersList?.users.find((u) => u.email === DEMO_EMAIL);

    if (!demoAuthUser) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { nome: "Demo GastroGestor" },
      });
      if (createErr) throw new Error(`createUser: ${createErr.message}`);
      demoAuthUser = created.user!;
      console.log("Auth user criado:", demoAuthUser.id);
    } else {
      // Garante senha conhecida
      await admin.auth.admin.updateUserById(demoAuthUser.id, { password: DEMO_PASSWORD });
    }

    const demoUserId = demoAuthUser!.id;

    // ====================== ENSURE EMPRESA + USUARIOS ROW ======================
    let { data: usuarioRow } = await admin.from("usuarios").select("*").eq("id", demoUserId).maybeSingle();
    let demoEmpresaId: string;

    if (!usuarioRow) {
      const { data: emp, error: empErr } = await admin
        .from("empresas")
        .insert({
          nome: DEMO_EMPRESA_NOME,
          segmento: "Confeitaria",
          slug: `doces-da-marta-demo-${Date.now()}`,
          cardapio_descricao: "Cardápio demonstrativo do GastroGestor",
          horario_funcionamento: "Seg-Sáb 08h-19h",
        })
        .select()
        .single();
      if (empErr) throw new Error(`empresa: ${empErr.message}`);
      demoEmpresaId = emp.id;

      const { error: usrErr } = await admin.from("usuarios").insert({
        id: demoUserId,
        empresa_id: demoEmpresaId,
        nome: "Dona Marta (Demo)",
        email: DEMO_EMAIL,
        telefone: "(11) 99999-0000",
        is_test_user: true,
        trial_end_override: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      });
      if (usrErr) throw new Error(`usuarios: ${usrErr.message}`);
    } else {
      demoEmpresaId = usuarioRow.empresa_id;
    }

    console.log("Demo empresa_id:", demoEmpresaId);

    // ====================== RESET MODE: limpa movimentos ======================
    if (action === "reset" || action === "setup") {
      // Limpa apenas movimentos (não toca em produtos/insumos clonados)
      await admin.from("encomenda_itens").delete().in(
        "encomenda_id",
        (await admin.from("encomendas").select("id").eq("empresa_id", demoEmpresaId)).data?.map((e: any) => e.id) || [""]
      );
      await admin.from("encomendas").delete().eq("empresa_id", demoEmpresaId);
      await admin.from("estoque_movimentos").delete().eq("empresa_id", demoEmpresaId);
      await admin.from("vendas").delete().eq("empresa_id", demoEmpresaId);
      await admin.from("caixa_movimentos").delete().eq("empresa_id", demoEmpresaId);
      await admin.from("clientes").delete().eq("empresa_id", demoEmpresaId);
    }

    // ====================== CLONE CATÁLOGO (se ainda não clonado) ======================
    const { count: produtosExistentes } = await admin
      .from("produtos").select("*", { count: "exact", head: true })
      .eq("empresa_id", demoEmpresaId);

    if (!produtosExistentes || produtosExistentes === 0) {
      console.log("Clonando catálogo da empresa source...");

      // 1) Insumos
      const { data: srcInsumos } = await admin.from("insumos").select("*").eq("empresa_id", SOURCE_EMPRESA_ID);
      const insumoIdMap: Record<string, string> = {};
      if (srcInsumos?.length) {
        const novos = srcInsumos.map((i: any) => {
          const { id, empresa_id, created_at, updated_at, ...rest } = i;
          return {
            ...rest,
            empresa_id: demoEmpresaId,
            estoque_atual: Math.max(rest.estoque_atual ?? 0, rndInt(50, 500)), // garante estoque alto pra demo
          };
        });
        // Insert one-by-one to capture id mapping
        for (let idx = 0; idx < srcInsumos.length; idx++) {
          const { data, error } = await admin.from("insumos").insert(novos[idx]).select("id").single();
          if (error) { console.error("insumo err", error); continue; }
          insumoIdMap[srcInsumos[idx].id] = data!.id;
        }
        console.log(`Insumos clonados: ${Object.keys(insumoIdMap).length}`);
      }

      // 2) Produtos
      const { data: srcProdutos } = await admin.from("produtos").select("*").eq("empresa_id", SOURCE_EMPRESA_ID);
      const produtoIdMap: Record<string, string> = {};
      if (srcProdutos?.length) {
        for (const p of srcProdutos) {
          const { id, empresa_id, created_at, updated_at, ...rest } = p;
          const novo = { ...rest, empresa_id: demoEmpresaId, estoque_acabado: 0 };
          const { data, error } = await admin.from("produtos").insert(novo).select("id").single();
          if (error) { console.error("produto err", error); continue; }
          produtoIdMap[id] = data!.id;
        }
        console.log(`Produtos clonados: ${Object.keys(produtoIdMap).length}`);
      }

      // 3) Fichas técnicas
      const { data: srcFichas } = await admin
        .from("fichas_tecnicas").select("*")
        .in("produto_id", Object.keys(produtoIdMap));
      if (srcFichas?.length) {
        const novasFichas = srcFichas
          .filter((f: any) => produtoIdMap[f.produto_id] && insumoIdMap[f.insumo_id])
          .map((f: any) => ({
            produto_id: produtoIdMap[f.produto_id],
            insumo_id: insumoIdMap[f.insumo_id],
            quantidade: f.quantidade,
          }));
        if (novasFichas.length) {
          const { error } = await admin.from("fichas_tecnicas").insert(novasFichas);
          if (error) console.error("fichas err", error);
          else console.log(`Fichas clonadas: ${novasFichas.length}`);
        }
      }

      // 4) Canais de venda
      const { data: srcCanais } = await admin.from("canais_venda").select("*").eq("empresa_id", SOURCE_EMPRESA_ID);
      if (srcCanais?.length) {
        const novos = srcCanais.map((c: any) => {
          const { id, empresa_id, created_at, updated_at, ...rest } = c;
          return { ...rest, empresa_id: demoEmpresaId };
        });
        await admin.from("canais_venda").insert(novos);
      }

      // 5) Preços canais
      const { data: srcPrecos } = await admin.from("precos_canais").select("*").eq("empresa_id", SOURCE_EMPRESA_ID);
      if (srcPrecos?.length) {
        const novos = srcPrecos
          .filter((p: any) => produtoIdMap[p.produto_id])
          .map((p: any) => {
            const { id, empresa_id, created_at, updated_at, produto_id, ...rest } = p;
            return { ...rest, empresa_id: demoEmpresaId, produto_id: produtoIdMap[produto_id] };
          });
        if (novos.length) await admin.from("precos_canais").insert(novos);
      }

      // 6) Custos fixos
      const { data: srcCustos } = await admin.from("custos_fixos").select("*").eq("empresa_id", SOURCE_EMPRESA_ID);
      if (srcCustos?.length) {
        const novos = srcCustos.map((c: any) => {
          const { id, empresa_id, created_at, updated_at, ...rest } = c;
          return { ...rest, empresa_id: demoEmpresaId };
        });
        await admin.from("custos_fixos").insert(novos);
      }

      // 7) Configurações
      const { data: srcConfig } = await admin.from("configuracoes").select("*").eq("empresa_id", SOURCE_EMPRESA_ID).maybeSingle();
      if (srcConfig) {
        const { id, empresa_id, created_at, updated_at, ...rest } = srcConfig;
        await admin.from("configuracoes").insert({ ...rest, empresa_id: demoEmpresaId });
      }

      // 8) Bairros entrega
      const bairrosInsert = BAIRROS.map((b, i) => ({
        empresa_id: demoEmpresaId, nome: b.nome, taxa_entrega: b.taxa, ordem: i, ativo: true,
      }));
      await admin.from("bairros_entrega").insert(bairrosInsert);
    }

    // ====================== GERAR MOVIMENTOS FICTÍCIOS ======================
    // Recarrega produtos da demo
    const { data: demoProdutos } = await admin
      .from("produtos").select("id, nome, preco_venda")
      .eq("empresa_id", demoEmpresaId).gt("preco_venda", 0);

    if (!demoProdutos?.length) {
      return new Response(JSON.stringify({ error: "Sem produtos na demo após clone" }), { status: 500, headers: corsHeaders });
    }

    // Canais de venda da demo (precos_canais.canal guarda o id do canal)
    const { data: demoCanais } = await admin
      .from("canais_venda").select("id, nome, taxas_canais(percentual)")
      .eq("empresa_id", demoEmpresaId);
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const canalInfo = (key: "balcao" | "ifood" | "99" | "whatsapp") =>
      demoCanais?.find((c: any) => norm(c.nome).startsWith(key));

    // Mix de canais: Balcão 45%, iFood 20%, 99Food 15%, WhatsApp 20%
    const CANAIS_MIX = [
      { key: "balcao" as const, db: "balcao", peso: 0.45, isApp: false },
      { key: "ifood" as const, db: "Ifood", peso: 0.20, isApp: true },
      { key: "99" as const, db: "99Food", peso: 0.15, isApp: true },
      { key: "whatsapp" as const, db: "WhatsApp", peso: 0.20, isApp: false },
    ].map((c) => {
      const info: any = canalInfo(c.key);
      const taxa = (info?.taxas_canais || []).reduce((s: number, t: any) => s + Number(t.percentual || 0), 0);
      return { ...c, canalId: info?.id as string | undefined, taxa: taxa / 100 };
    });
    const pickCanal = () => {
      let r = Math.random();
      for (const c of CANAIS_MIX) { if ((r -= c.peso) <= 0) return c; }
      return CANAIS_MIX[0];
    };

    const { data: demoPrecos } = await admin
      .from("precos_canais").select("produto_id, canal, preco")
      .eq("empresa_id", demoEmpresaId);
    const precoMap: Record<string, Record<string, number>> = {};
    demoPrecos?.forEach((p: any) => {
      if (!precoMap[p.produto_id]) precoMap[p.produto_id] = {};
      precoMap[p.produto_id][p.canal] = Number(p.preco);
    });
    const precoDe = (prod: any, canal: typeof CANAIS_MIX[number]) => {
      const p = canal.canalId ? precoMap[prod.id]?.[canal.canalId] : undefined;
      return p && p > 0 ? p : Number(prod.preco_venda);
    };

    // Volumes-alvo mensais fixos (vídeoaulas)
    const METAS_MENSAIS: Record<string, number> = {
      "Brownie Classico de Chocolate": 150,
      "Brownie Fatia Jasmine": 30,
      "Brownie Fatia Kinder": 25,
      "Brownie Fatia Morango": 25,
      "Petisqueira Brownie": 15,
      "Travessa Morango c/ Brownie (650g)": 8,
      "Copo da Felicidade - Jasmine 200ml": 20,
      "Copo da Felicidade Jasmine - 300ml": 40,
      "Copo da Felicidade Aurora - 200ml": 20,
      "Copo da Felicidade Aurora - 300ml": 15,
      "Copo da Felicidade Branca de Neve (300ml)": 15,
      "Copo da Felicidade Christie (300ml)": 15,
      "Copo da Felicidade Fiona - 200ml": 15,
      "Copo da Felicidade Fiona - 300ml": 15,
      "Copo da Felicidade Mérida (300ml)": 15,
      "Copo da Felicidade Rapunzel - 200ml": 15,
      "Copo da Felicidade Rapunzel (300ml)": 15,
    };
    const metasNorm: Record<string, number> = {};
    Object.entries(METAS_MENSAIS).forEach(([n, v]) => { metasNorm[norm(n)] = v; });

    // 1) Clientes
    const clientesPayload = NOMES_CLIENTES.map((nome) => ({
      empresa_id: demoEmpresaId,
      nome,
      whatsapp: `(11) 9${rndInt(1000, 9999)}-${rndInt(1000, 9999)}`,
      email: nome.toLowerCase().replace(/ /g, ".") + "@email.com",
      endereco_bairro: pick(BAIRROS).nome,
      endereco_cidade: "São Paulo",
      endereco_estado: "SP",
    }));
    const { data: clientesInseridos } = await admin.from("clientes").insert(clientesPayload).select("id");
    const clienteIds = clientesInseridos?.map((c: any) => c.id) || [];

    // 2) Vendas (90 dias) com volumes fixos por produto
    const DIAS = 90;
    // Peso por dia: fim de semana com boost de 25%
    const pesosDias = Array.from({ length: DIAS }, (_, d) => {
      const dow = new Date(Date.now() - d * 86400000).getDay();
      return dow === 0 || dow === 6 ? 1.25 : 1;
    });
    const somaPesos = pesosDias.reduce((a, b) => a + b, 0);
    const sorteiaDia = () => {
      let r = Math.random() * somaPesos;
      for (let d = 0; d < DIAS; d++) { if ((r -= pesosDias[d]) <= 0) return d; }
      return 0;
    };

    // Agrupa unidades por produto+dia+canal => uma linha de venda
    const agrupado: Record<string, { prod: any; dia: number; canal: typeof CANAIS_MIX[number]; qtd: number }> = {};
    const addUnidade = (prod: any, dia: number, canal: typeof CANAIS_MIX[number], qtd = 1) => {
      const k = `${prod.id}|${dia}|${canal.db}`;
      if (!agrupado[k]) agrupado[k] = { prod, dia, canal, qtd: 0 };
      agrupado[k].qtd += qtd;
    };

    for (const prod of demoProdutos) {
      const meta = metasNorm[norm(prod.nome)];
      if (meta) {
        // Total em 90 dias = meta mensal × 3, variação natural de ±10%
        const total = Math.round(meta * 3 * (0.9 + Math.random() * 0.2));
        for (let u = 0; u < total; u++) addUnidade(prod, sorteiaDia(), pickCanal());
      } else if (!/^teste$/i.test(prod.nome.trim())) {
        // Demais produtos: poucas vendas aleatórias, sem prioridade
        const vendasAleatorias = rndInt(3, 9);
        for (let v = 0; v < vendasAleatorias; v++) addUnidade(prod, rndInt(0, DIAS - 1), pickCanal(), rndInt(1, 2));
      }
    }

    const vendasPayload: any[] = [];
    const entradasCaixa: Record<string, { dia: number; canal: typeof CANAIS_MIX[number]; bruto: number; taxa: number }> = {};
    for (const { prod, dia, canal, qtd } of Object.values(agrupado)) {
      const preco = precoDe(prod, canal);
      const subtotal = Math.round(preco * qtd * 100) / 100;
      const comissao = Math.round(subtotal * canal.taxa * 100) / 100;
      vendasPayload.push({
        empresa_id: demoEmpresaId,
        produto_id: prod.id,
        quantidade: qtd,
        subtotal,
        valor_total: subtotal,
        canal: canal.db,
        tipo_venda: canal.isApp ? "app" : "direto",
        origem: "manual",
        data_venda: daysAgo(dia),
        comissao_plataforma: comissao,
        valor_liquido: subtotal - comissao,
        cliente_id: !canal.isApp && Math.random() < 0.3 && clienteIds.length ? pick(clienteIds) : null,
      });
      const ck = `${dia}|${canal.db}`;
      if (!entradasCaixa[ck]) entradasCaixa[ck] = { dia, canal, bruto: 0, taxa: 0 };
      entradasCaixa[ck].bruto += subtotal;
      entradasCaixa[ck].taxa += comissao;
    }
    for (let i = 0; i < vendasPayload.length; i += 100) {
      const { error } = await admin.from("vendas").insert(vendasPayload.slice(i, i + 100));
      if (error) console.error("vendas lote err", error);
    }
    console.log(`Vendas inseridas: ${vendasPayload.length}`);

    // 3) Caixa: entradas diárias por canal (proporcionais às vendas) + custos fixos mensais
    const nomeCanal: Record<string, string> = { balcao: "Balcão", Ifood: "iFood", "99Food": "99Food", WhatsApp: "WhatsApp" };
    const caixaPayload: any[] = [];
    for (const e of Object.values(entradasCaixa)) {
      const data = daysAgo(e.dia);
      caixaPayload.push({
        empresa_id: demoEmpresaId, tipo: "entrada", categoria: "venda",
        descricao: `Vendas ${nomeCanal[e.canal.db]}`, valor: Math.round(e.bruto * 100) / 100,
        data_movimento: data, origem: "manual",
      });
      if (e.taxa > 0) {
        caixaPayload.push({
          empresa_id: demoEmpresaId, tipo: "saida", categoria: "taxa_plataforma",
          descricao: `Taxa ${nomeCanal[e.canal.db]}`, valor: Math.round(e.taxa * 100) / 100,
          data_movimento: data, origem: "manual",
        });
      }
    }
    const { data: demoCustosFixos } = await admin
      .from("custos_fixos").select("nome, valor_mensal, categoria").eq("empresa_id", demoEmpresaId);
    for (let mes = 0; mes < 3; mes++) {
      const mesData = new Date(); mesData.setMonth(mesData.getMonth() - mes); mesData.setDate(5);
      if (mesData > new Date()) continue;
      const dataStr = mesData.toISOString().split("T")[0];
      for (const cf of demoCustosFixos || []) {
        caixaPayload.push({
          empresa_id: demoEmpresaId, tipo: "saida", categoria: cf.categoria || "custo_fixo",
          descricao: cf.nome, valor: Number(cf.valor_mensal), data_movimento: dataStr, origem: "manual",
        });
      }
    }
    for (let i = 0; i < caixaPayload.length; i += 200) {
      const { error } = await admin.from("caixa_movimentos").insert(caixaPayload.slice(i, i + 200));
      if (error) console.error("caixa lote err", error);
    }

    // 4) Encomendas futuras (3-4)
    const encomendasPayload: any[] = [];
    for (let i = 0; i < 4; i++) {
      const cli = NOMES_CLIENTES[i];
      const prod = pick(demoProdutos);
      const qtd = rndInt(10, 30);
      const total = Number(prod.preco_venda) * qtd;
      encomendasPayload.push({
        empresa_id: demoEmpresaId,
        cliente_nome: cli,
        cliente_whatsapp: `(11) 9${rndInt(1000, 9999)}-${rndInt(1000, 9999)}`,
        data_entrega: daysAhead(rndInt(3, 20)),
        hora_entrega: `${rndInt(9, 18)}:00`,
        local_entrega: `${pick(BAIRROS).nome}, São Paulo`,
        status: i === 0 ? "confirmada" : "pendente",
        valor_total: total,
        valor_sinal: total * 0.3,
        forma_pagamento: "pix",
        observacoes: "Encomenda demo",
        _items: [{ produto_id: prod.id, produto_nome: prod.nome, quantidade: qtd, preco_unitario: Number(prod.preco_venda) }],
      });
    }
    for (const enc of encomendasPayload) {
      const { _items, ...encData } = enc;
      const { data: encIns } = await admin.from("encomendas").insert(encData).select("id").single();
      if (encIns) {
        await admin.from("encomenda_itens").insert(
          _items.map((it: any) => ({ ...it, encomenda_id: encIns.id }))
        );
      }
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      demo_email: DEMO_EMAIL,
      demo_password: DEMO_PASSWORD,
      empresa_id: demoEmpresaId,
      user_id: demoUserId,
      stats: {
        vendas: vendasPayload.length,
        caixa_movimentos: caixaPayload.length,
        encomendas: encomendasPayload.length,
        clientes: clienteIds.length,
      },
    }), { headers: corsHeaders });
  } catch (e) {
    console.error("setup-demo-user error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
