ALTER TABLE public.vendas_pedidos
  ADD COLUMN IF NOT EXISTS entrega_por text,
  ADD COLUMN IF NOT EXISTS pagamento_recebido_por text,
  ADD COLUMN IF NOT EXISTS taxa_servico_info numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentivo_plataforma_info numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.salvar_venda_pedido(p_pedido jsonb, p_itens jsonb, p_pedido_id uuid DEFAULT NULL::uuid, p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_emp uuid := get_user_empresa_id();
  v_pid uuid := p_pedido_id;
  v_canal uuid := NULLIF(p_pedido->>'canal_id','')::uuid;
  v_canal_nome text; v_tipo text; v_taxa_pct numeric := 0;
  v_desc numeric := GREATEST(COALESCE((p_pedido->>'desconto')::numeric,0),0);
  v_entrega numeric := GREATEST(COALESCE((p_pedido->>'taxa_entrega')::numeric,0),0);
  v_data date := COALESCE(NULLIF(p_pedido->>'data_venda','')::date, CURRENT_DATE);
  v_cli uuid := NULLIF(p_pedido->>'cliente_id','')::uuid;
  v_soma numeric := 0; v_item jsonb; v_bruto numeric; v_valor numeric; v_com numeric;
  v_keep uuid[] := '{}'; v_old RECORD; v_prod uuid; v_qtd numeric; v_preco numeric; v_found uuid;
  v_origem text;
  v_num text := NULLIF(p_pedido->>'numero_externo','');
  v_plat text := NULLIF(p_pedido->>'plataforma','');
BEGIN
  IF v_emp IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa'; END IF;
  IF jsonb_array_length(COALESCE(p_itens,'[]')) = 0 THEN RAISE EXCEPTION 'Pedido sem itens'; END IF;

  IF v_pid IS NULL AND p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_found FROM vendas_pedidos WHERE empresa_id = v_emp AND idempotency_key = p_idempotency_key;
    IF v_found IS NOT NULL THEN RETURN v_found; END IF;
  END IF;

  IF v_canal IS NOT NULL THEN
    SELECT nome, tipo INTO v_canal_nome, v_tipo FROM canais_venda WHERE id = v_canal AND empresa_id = v_emp;
    IF v_canal_nome IS NULL THEN RAISE EXCEPTION 'Canal inválido'; END IF;
    SELECT COALESCE(sum(percentual),0) INTO v_taxa_pct FROM taxas_canais WHERE canal_id = v_canal;
  END IF;
  IF v_cli IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clientes WHERE id = v_cli AND empresa_id = v_emp) THEN v_cli := NULL; END IF;

  SELECT COALESCE(sum((i->>'quantidade')::numeric * (i->>'preco_unitario')::numeric),0) INTO v_soma FROM jsonb_array_elements(p_itens) i;
  IF v_desc > v_soma THEN v_desc := v_soma; END IF;

  IF v_pid IS NULL THEN
    INSERT INTO vendas_pedidos (empresa_id, canal_id, canal_texto, cliente_id, forma_pagamento, data_venda, origem, numero_externo, desconto, taxa_entrega, idempotency_key,
      entrega_por, pagamento_recebido_por, taxa_servico_info, incentivo_plataforma_info)
    VALUES (v_emp, v_canal, COALESCE(v_canal_nome, v_plat), v_cli, NULLIF(p_pedido->>'forma_pagamento',''), v_data,
            COALESCE(NULLIF(p_pedido->>'origem',''),'manual'), v_num, v_desc, v_entrega, p_idempotency_key,
            NULLIF(p_pedido->>'entrega_por',''), NULLIF(p_pedido->>'pagamento_recebido_por',''),
            GREATEST(COALESCE((p_pedido->>'taxa_servico_info')::numeric,0),0),
            GREATEST(COALESCE((p_pedido->>'incentivo_plataforma_info')::numeric,0),0))
    RETURNING id INTO v_pid;
    v_origem := COALESCE(NULLIF(p_pedido->>'origem',''),'manual');
  ELSE
    SELECT origem INTO v_origem FROM vendas_pedidos WHERE id = v_pid AND empresa_id = v_emp;
    IF v_origem IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF v_origem IN ('encomenda','pedido') THEN RAISE EXCEPTION 'Este pedido deve ser alterado na tela de origem'; END IF;
    UPDATE vendas_pedidos SET canal_id = v_canal, canal_texto = COALESCE(v_canal_nome, canal_texto), cliente_id = v_cli,
      forma_pagamento = NULLIF(p_pedido->>'forma_pagamento',''), data_venda = v_data,
      desconto = v_desc, taxa_entrega = v_entrega,
      entrega_por = COALESCE(NULLIF(p_pedido->>'entrega_por',''), entrega_por),
      pagamento_recebido_por = COALESCE(NULLIF(p_pedido->>'pagamento_recebido_por',''), pagamento_recebido_por)
    WHERE id = v_pid;
    SELECT numero_externo INTO v_num FROM vendas_pedidos WHERE id = v_pid;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_prod := NULLIF(v_item->>'produto_id','')::uuid;
    v_qtd := (v_item->>'quantidade')::numeric;
    v_preco := (v_item->>'preco_unitario')::numeric;
    IF v_qtd IS NULL OR v_qtd <= 0 THEN CONTINUE; END IF;
    v_bruto := round(v_qtd * v_preco, 2);
    v_valor := CASE WHEN v_soma > 0 THEN round(v_bruto - v_desc * v_bruto / v_soma, 2) ELSE v_bruto END;
    v_com := round(v_valor * v_taxa_pct / 100.0, 2);

    v_found := NULL;
    IF NULLIF(v_item->>'id','') IS NOT NULL THEN
      SELECT id INTO v_found FROM vendas WHERE id = (v_item->>'id')::uuid AND pedido_id = v_pid
        AND produto_id IS NOT DISTINCT FROM v_prod AND quantidade = v_qtd;
    END IF;

    IF v_found IS NOT NULL THEN
      UPDATE vendas SET preco_unitario = v_preco, subtotal = v_bruto, valor_total = v_valor,
        comissao_plataforma = v_com, valor_liquido = v_valor - v_com,
        canal = COALESCE(v_canal_nome, canal), cliente_id = v_cli, data_venda = v_data,
        tipo_venda = CASE WHEN v_tipo = 'app_delivery' THEN 'app' ELSE 'direto' END
      WHERE id = v_found;
      v_keep := v_keep || v_found;
    ELSE
      INSERT INTO vendas (empresa_id, pedido_id, produto_id, descricao_produto, quantidade, preco_unitario, subtotal, valor_total,
        comissao_plataforma, valor_liquido, data_venda, canal, cliente_id, origem, tipo_venda, numero_pedido_externo, plataforma)
      VALUES (v_emp, v_pid, v_prod, NULLIF(v_item->>'descricao',''), v_qtd, v_preco, v_bruto, v_valor,
        v_com, v_valor - v_com, v_data, COALESCE(v_canal_nome, v_plat), v_cli,
        CASE WHEN v_origem IN ('planilha') THEN 'importacao' WHEN v_origem = 'foto' THEN 'importacao_foto' ELSE 'manual' END,
        CASE WHEN v_tipo = 'app_delivery' THEN 'app' ELSE 'direto' END, v_num, v_plat)
      RETURNING id INTO v_found;
      v_keep := v_keep || v_found;
    END IF;
  END LOOP;

  DELETE FROM vendas WHERE pedido_id = v_pid AND NOT (id = ANY(v_keep));
  PERFORM recalcular_totais_pedido(v_pid);
  RETURN v_pid;
END; $function$;