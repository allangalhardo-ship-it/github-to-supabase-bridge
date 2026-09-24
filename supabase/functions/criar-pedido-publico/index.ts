import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const round2 = (n: number) => Math.round(n * 100) / 100;

interface ItemInput {
  produto_id?: unknown;
  quantidade?: unknown;
  observacao?: unknown;
  opcionais_ids?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Requisição inválida" }, 400);

    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const itensInput: ItemInput[] = Array.isArray(body.itens) ? body.itens : [];
    const tipoEntrega = body.tipo_entrega === "entrega" ? "entrega" : "retirada";
    const formaPagamento = typeof body.forma_pagamento === "string" ? body.forma_pagamento.trim() : "";
    const nome = typeof body.cliente_nome === "string" ? body.cliente_nome.trim() : "";
    const whatsapp = typeof body.cliente_whatsapp === "string" ? body.cliente_whatsapp.replace(/\D/g, "") : "";

    if (!slug) return json({ error: "Loja não informada" }, 400);
    if (itensInput.length === 0) return json({ error: "Carrinho vazio" }, 400);
    if (itensInput.length > 100) return json({ error: "Carrinho muito grande" }, 400);
    if (!nome || nome.length > 120) return json({ error: "Informe seu nome" }, 400);
    if (whatsapp.length < 10 || whatsapp.length > 13) return json({ error: "WhatsApp inválido" }, 400);
    if (!["pix", "dinheiro", "cartao"].includes(formaPagamento)) {
      return json({ error: "Forma de pagamento inválida" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // ---- Loja ----
    const { data: empresa, error: empErr } = await supabase
      .from("empresas")
      .select("id, entrega_ativa, pedido_minimo")
      .eq("slug", slug)
      .eq("cardapio_ativo", true)
      .maybeSingle();
    if (empErr) throw empErr;
    if (!empresa) return json({ error: "Loja não encontrada ou cardápio desativado" }, 404);

    if (tipoEntrega === "entrega" && !empresa.entrega_ativa) {
      return json({ error: "Esta loja não está fazendo entregas agora" }, 400);
    }

    // ---- Produtos (preço vem do banco, nunca do cliente) ----
    const produtoIds = [...new Set(itensInput.map((i) => String(i.produto_id ?? "")))].filter(Boolean);
    if (produtoIds.length === 0) return json({ error: "Itens inválidos" }, 400);

    const { data: produtos, error: prodErr } = await supabase
      .from("produtos")
      .select("id, nome, preco_venda")
      .eq("empresa_id", empresa.id)
      .eq("ativo", true)
      .in("id", produtoIds);
    if (prodErr) throw prodErr;

    const produtoMap = new Map((produtos ?? []).map((p) => [p.id, p]));

    // ---- Opcionais válidos por produto ----
    const opcionaisIds = [
      ...new Set(
        itensInput.flatMap((i) => (Array.isArray(i.opcionais_ids) ? i.opcionais_ids.map(String) : [])),
      ),
    ].filter(Boolean);

    const opcionalMap = new Map<string, { nome: string; preco_adicional: number; produto_id: string }>();
    if (opcionaisIds.length > 0) {
      const { data: opcionais, error: opErr } = await supabase
        .from("itens_opcionais")
        .select("id, nome, preco_adicional, ativo, grupos_opcionais!inner(produto_id, empresa_id)")
        .in("id", opcionaisIds)
        .eq("ativo", true);
      if (opErr) throw opErr;
      for (const o of opcionais ?? []) {
        const grupo = (o as any).grupos_opcionais;
        if (!grupo || grupo.empresa_id !== empresa.id) continue;
        opcionalMap.set(o.id, {
          nome: o.nome,
          preco_adicional: Number(o.preco_adicional) || 0,
          produto_id: grupo.produto_id,
        });
      }
    }

    // ---- Montagem e soma no servidor ----
    let subtotal = 0;
    const itensJson: unknown[] = [];

    for (const item of itensInput) {
      const produto = produtoMap.get(String(item.produto_id ?? ""));
      if (!produto) return json({ error: "Um dos produtos não está mais disponível" }, 400);

      const quantidade = Number(item.quantidade);
      if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 999) {
        return json({ error: "Quantidade inválida" }, 400);
      }

      const opcionais: { nome: string; preco_adicional: number }[] = [];
      for (const opId of Array.isArray(item.opcionais_ids) ? item.opcionais_ids.map(String) : []) {
        const op = opcionalMap.get(opId);
        if (!op || op.produto_id !== produto.id) {
          return json({ error: "Um dos complementos escolhidos não está mais disponível" }, 400);
        }
        opcionais.push({ nome: op.nome, preco_adicional: op.preco_adicional });
      }

      const precoUnitario = Number(produto.preco_venda) || 0;
      const adicionais = opcionais.reduce((s, o) => s + o.preco_adicional, 0);
      subtotal += (precoUnitario + adicionais) * quantidade;

      const observacao = typeof item.observacao === "string" ? item.observacao.slice(0, 300) : null;
      itensJson.push({
        produto_id: produto.id,
        nome: produto.nome,
        quantidade,
        preco_unitario: precoUnitario,
        observacao: observacao || null,
        opcionais,
      });
    }
    subtotal = round2(subtotal);

    // ---- Taxa de entrega vem do cadastro do bairro ----
    let taxaEntrega = 0;
    let bairroNome: string | null = null;
    let enderecoEntrega: string | null = null;

    if (tipoEntrega === "entrega") {
      const bairroId = typeof body.bairro_id === "string" ? body.bairro_id : "";
      const endereco = typeof body.endereco === "string" ? body.endereco.trim().slice(0, 300) : "";
      const complemento = typeof body.complemento === "string" ? body.complemento.trim().slice(0, 120) : "";
      if (!endereco) return json({ error: "Informe o endereço de entrega" }, 400);
      if (!bairroId) return json({ error: "Escolha o bairro de entrega" }, 400);

      const { data: bairro, error: bairroErr } = await supabase
        .from("bairros_entrega")
        .select("nome, taxa_entrega")
        .eq("id", bairroId)
        .eq("empresa_id", empresa.id)
        .eq("ativo", true)
        .maybeSingle();
      if (bairroErr) throw bairroErr;
      if (!bairro) return json({ error: "Bairro de entrega indisponível" }, 400);

      taxaEntrega = round2(Number(bairro.taxa_entrega) || 0);
      bairroNome = bairro.nome;
      enderecoEntrega = `${endereco}${complemento ? ` - ${complemento}` : ""} (${bairro.nome})`;
    }

    // Pedido mínimo vale apenas para entrega (retirada no balcão é livre)
    if (tipoEntrega === "entrega" && subtotal < (Number(empresa.pedido_minimo) || 0)) {
      return json({ error: "Pedido abaixo do valor mínimo para entrega" }, 400);
    }

    const valorTotal = round2(subtotal + taxaEntrega);

    let trocoPara: number | null = null;
    if (formaPagamento === "dinheiro" && body.troco_para != null) {
      const t = Number(body.troco_para);
      if (Number.isFinite(t) && t > 0) trocoPara = round2(t);
    }

    // ---- Idempotência atômica: UNIQUE (empresa_id, idempotency_key) no banco ----
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const idemKey = typeof body.idempotency_key === "string" && uuidRe.test(body.idempotency_key)
      ? body.idempotency_key.toLowerCase()
      : null;

    if (!idemKey) {
      // Fallback para clientes antigos sem chave (janela de 90s, não atômica)
      const desde = new Date(Date.now() - 90_000).toISOString();
      const { data: duplicado } = await supabase
        .from("pedidos")
        .select("id, numero_pedido")
        .eq("empresa_id", empresa.id)
        .eq("cliente_whatsapp", whatsapp)
        .eq("valor_total", valorTotal)
        .gte("created_at", desde)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (duplicado) {
        return json({ id: duplicado.id, numero_pedido: duplicado.numero_pedido, duplicado: true });
      }
    }

    const { data: pedido, error: insErr } = await supabase
      .from("pedidos")
      .insert({
        empresa_id: empresa.id,
        idempotency_key: idemKey,
        itens: itensJson,
        subtotal,
        taxa_entrega: taxaEntrega,
        valor_total: valorTotal,
        tipo_entrega: tipoEntrega,
        bairro_entrega: bairroNome,
        endereco_entrega: enderecoEntrega,
        forma_pagamento: formaPagamento,
        troco_para: trocoPara,
        cliente_nome: nome,
        cliente_whatsapp: whatsapp,
        observacoes: typeof body.observacoes === "string" ? body.observacoes.trim().slice(0, 500) || null : null,
        origem: "cardapio",
        status: "pendente",
      })
      .select("id, numero_pedido")
      .single();

    if (insErr && (insErr as any).code === "23505" && idemKey) {
      const { data: existente, error: exErr } = await supabase
        .from("pedidos")
        .select("id, numero_pedido")
        .eq("empresa_id", empresa.id)
        .eq("idempotency_key", idemKey)
        .single();
      if (exErr) throw exErr;
      return json({ id: existente.id, numero_pedido: existente.numero_pedido, duplicado: true });
    }
    if (insErr) throw insErr;

    return json({ id: pedido.id, numero_pedido: pedido.numero_pedido });
  } catch (error) {
    console.error("criar-pedido-publico:", error);
    return json({ error: "Não foi possível enviar o pedido. Tente novamente." }, 500);
  }
});
