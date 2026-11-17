ALTER TABLE public.canais_venda
  ADD COLUMN IF NOT EXISTS mensalidade numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_repasse_dias integer NOT NULL DEFAULT 0;

ALTER TABLE public.vendas_pedidos
  ADD COLUMN IF NOT EXISTS taxa_prevista numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_real numeric,
  ADD COLUMN IF NOT EXISTS data_repasse_prevista date;

UPDATE public.vendas_pedidos SET taxa_prevista = taxa_canal WHERE taxa_prevista = 0 AND taxa_canal <> 0;

-- Consolida taxas percentuais em uma linha "Comissão" por canal (mesma soma)
WITH s AS (SELECT canal_id, sum(percentual) p, min(created_at) c FROM public.taxas_canais GROUP BY canal_id)
, d AS (DELETE FROM public.taxas_canais RETURNING 1)
INSERT INTO public.taxas_canais (canal_id, nome, percentual, created_at)
SELECT canal_id, 'Comissão', p, c FROM s;

CREATE OR REPLACE FUNCTION public.taxas_do_canal(p_canal_id uuid)
RETURNS TABLE(comissao numeric, online numeric, mensalidade numeric, prazo integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    COALESCE((SELECT sum(percentual) FROM taxas_canais WHERE canal_id = c.id AND nome <> 'Pagamento online'),0),
    COALESCE((SELECT sum(percentual) FROM taxas_canais WHERE canal_id = c.id AND nome = 'Pagamento online'),0),
    c.mensalidade, c.prazo_repasse_dias
  FROM canais_venda c WHERE c.id = p_canal_id;
$$;

CREATE OR REPLACE FUNCTION public.recalcular_totais_pedido(p_pedido_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_n int; v_tx numeric;
BEGIN
  IF p_pedido_id IS NULL THEN RETURN; END IF;
  SELECT count(*), COALESCE(sum(COALESCE(v.valor_total,0) - CASE WHEN v.valor_liquido > 0 THEN v.valor_liquido ELSE v.valor_total END),0)
    INTO v_n, v_tx FROM vendas v WHERE v.pedido_id = p_pedido_id;
  UPDATE vendas_pedidos p SET
    qtd_itens   = v_n,
    taxa_canal  = v_tx,
    taxa_prevista = CASE WHEN p.taxa_real IS NULL THEN v_tx ELSE p.taxa_prevista END,
    valor_bruto = COALESCE((SELECT sum(v.valor_total) FROM vendas v WHERE v.pedido_id = p_pedido_id), 0) + p.taxa_entrega,
    valor_liquido = COALESCE((SELECT sum(CASE WHEN v.valor_liquido > 0 THEN v.valor_liquido ELSE v.valor_total END) FROM vendas v WHERE v.pedido_id = p_pedido_id), 0) + p.taxa_entrega
  WHERE p.id = p_pedido_id;
END; $function$;

-- Grava a taxa real vinda do relatório financeiro e redistribui nos itens
CREATE OR REPLACE FUNCTION public.atualizar_taxa_real_pedido(p_pedido_id uuid, p_taxa_real numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_emp uuid := get_user_empresa_id(); v_soma numeric; v_tx numeric := GREATEST(COALESCE(p_taxa_real,0),0);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vendas_pedidos WHERE id = p_pedido_id AND empresa_id = v_emp) THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  SELECT COALESCE(sum(valor_total),0) INTO v_soma FROM vendas WHERE pedido_id = p_pedido_id;
  UPDATE vendas_pedidos SET taxa_real = v_tx WHERE id = p_pedido_id;
  UPDATE vendas SET comissao_plataforma = CASE WHEN v_soma > 0 THEN round(v_tx * valor_total / v_soma, 2) ELSE 0 END,
                    valor_liquido = valor_total - CASE WHEN v_soma > 0 THEN round(v_tx * valor_total / v_soma, 2) ELSE 0 END
   WHERE pedido_id = p_pedido_id;
  PERFORM recalcular_totais_pedido(p_pedido_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.salvar_venda_pedido(p_pedido jsonb, p_itens jsonb, p_pedido_id uuid DEFAULT NULL::uuid, p_idempotency_key uuid DEFAULT NULL::uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_emp uuid := get_user_empresa_id();
  v_pid uuid := p_pedido_id;
  v_canal uuid := NULLIF(p_pedido->>'canal_id','')::uuid;
  v_canal_nome text; v_tipo text; v_taxa_pct numeric := 0; v_online numeric := 0; v_prazo int := 0;
  v_desc numeric := GREATEST(COALESCE((p_pedido->>'desconto')::numeric,0),0);
  v_entrega numeric := GREATEST(COALESCE((p_pedido->>'taxa_entrega')::numeric,0),0);
  v_data date := COALESCE(NULLIF(p_pedido->>'data_venda','')::date, CURRENT_DATE);
  v_cli uuid := NULLIF(p_pedido->>'cliente_id','')::uuid;
  v_soma numeric := 0; v_item jsonb; v_bruto numeric; v_valor numeric; v_com numeric;
  v_keep uuid[] := '{}'; v_prod uuid; v_qtd numeric; v_preco numeric; v_found uuid;
  v_origem text;
  v_num text := NULLIF(p_pedido->>'numero_externo','');
  v_plat text := NULLIF(p_pedido->>'plataforma','');
  v_receb text := NULLIF(p_pedido->>'pagamento_recebido_por','');
  v_real numeric := NULLIF(p_pedido->>'taxa_real','')::numeric;
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
    SELECT comissao, online, prazo INTO v_taxa_pct, v_online, v_prazo FROM taxas_do_canal(v_canal);
  END IF;
  IF v_pid IS NOT NULL AND v_receb IS NULL THEN
    SELECT pagamento_recebido_por INTO v_receb FROM vendas_pedidos WHERE id = v_pid;
  END IF;
  IF v_receb = 'plataforma' THEN v_taxa_pct := v_taxa_pct + v_online; END IF;
  IF v_cli IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clientes WHERE id = v_cli AND empresa_id = v_emp) THEN v_cli := NULL; END IF;

  SELECT COALESCE(sum((i->>'quantidade')::numeric * (i->>'preco_unitario')::numeric),0) INTO v_soma FROM jsonb_array_elements(p_itens) i;
  IF v_desc > v_soma THEN v_desc := v_soma; END IF;

  IF v_pid IS NULL THEN
    INSERT INTO vendas_pedidos (empresa_id, canal_id, canal_texto, cliente_id, forma_pagamento, data_venda, origem, numero_externo, desconto, taxa_entrega, idempotency_key,
      entrega_por, pagamento_recebido_por, taxa_servico_info, incentivo_plataforma_info, data_repasse_prevista)
    VALUES (v_emp, v_canal, COALESCE(v_canal_nome, v_plat), v_cli, NULLIF(p_pedido->>'forma_pagamento',''), v_data,
            COALESCE(NULLIF(p_pedido->>'origem',''),'manual'), v_num, v_desc, v_entrega, p_idempotency_key,
            NULLIF(p_pedido->>'entrega_por',''), v_receb,
            GREATEST(COALESCE((p_pedido->>'taxa_servico_info')::numeric,0),0),
            GREATEST(COALESCE((p_pedido->>'incentivo_plataforma_info')::numeric,0),0),
            CASE WHEN v_canal IS NOT NULL AND v_tipo = 'app_delivery' THEN v_data + COALESCE(v_prazo,0) END)
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
      pagamento_recebido_por = v_receb,
      data_repasse_prevista = CASE WHEN v_tipo = 'app_delivery' THEN COALESCE(data_repasse_prevista, v_data + COALESCE(v_prazo,0)) ELSE NULL END
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
  IF v_real IS NOT NULL THEN
    UPDATE vendas_pedidos SET taxa_real = NULL WHERE id = v_pid;
    PERFORM recalcular_totais_pedido(v_pid);
    PERFORM atualizar_taxa_real_pedido(v_pid, v_real);
  ELSIF (SELECT taxa_real FROM vendas_pedidos WHERE id = v_pid) IS NOT NULL THEN
    PERFORM atualizar_taxa_real_pedido(v_pid, (SELECT taxa_real FROM vendas_pedidos WHERE id = v_pid));
  END IF;
  RETURN v_pid;
END; $function$;

-- Linhas de caixa derivadas dos pedidos (venda, repasse, desconto no repasse, mensalidade)
CREATE OR REPLACE FUNCTION public.get_caixa_pedidos(p_empresa_id uuid)
RETURNS TABLE(pedido_id uuid, canal_id uuid, canal_nome text, data_caixa date, tipo text, valor numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH p AS (
    SELECT vp.*, COALESCE(c.nome, vp.canal_texto) AS cnome
    FROM vendas_pedidos vp LEFT JOIN canais_venda c ON c.id = vp.canal_id
    WHERE vp.empresa_id = p_empresa_id
      AND (p_empresa_id = get_user_empresa_id() OR auth.uid() IS NULL)
  ), linhas AS (
    SELECT id, canal_id, cnome, COALESCE(data_repasse_prevista, data_venda), 'repasse', valor_liquido
      FROM p WHERE pagamento_recebido_por = 'plataforma'
    UNION ALL
    SELECT id, canal_id, cnome, data_venda, 'venda', valor_bruto
      FROM p WHERE pagamento_recebido_por = 'loja' AND taxa_canal > 0
    UNION ALL
    SELECT id, canal_id, cnome, COALESCE(data_repasse_prevista, data_venda), 'desconto_repasse', -taxa_canal
      FROM p WHERE pagamento_recebido_por = 'loja' AND taxa_canal > 0
    UNION ALL
    SELECT id, canal_id, cnome, data_venda, 'venda', valor_liquido
      FROM p WHERE NOT (COALESCE(pagamento_recebido_por,'') = 'plataforma' OR (pagamento_recebido_por = 'loja' AND taxa_canal > 0))
  ), mens AS (
    SELECT c.id AS canal_id, c.nome, date_trunc('month', vp.data_venda)::date AS mes, c.mensalidade,
      max(CASE WHEN vp.pagamento_recebido_por = 'plataforma' THEN COALESCE(vp.data_repasse_prevista, vp.data_venda) END) AS dt_rep,
      max(vp.data_venda) AS dt_ult
    FROM canais_venda c JOIN vendas_pedidos vp ON vp.canal_id = c.id
    WHERE c.empresa_id = p_empresa_id AND c.mensalidade > 0
      AND (p_empresa_id = get_user_empresa_id() OR auth.uid() IS NULL)
    GROUP BY c.id, c.nome, 3, c.mensalidade
  )
  SELECT * FROM linhas
  UNION ALL
  SELECT NULL::uuid, canal_id, nome, COALESCE(dt_rep, dt_ult), 'mensalidade', -mensalidade FROM mens;
$$;

CREATE OR REPLACE FUNCTION public.get_saldo_caixa(p_empresa_id uuid)
 RETURNS TABLE(total_entradas numeric, total_saidas numeric, saldo numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH movimentos AS (
    SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS entradas,
           COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS saidas
    FROM caixa_movimentos WHERE empresa_id = p_empresa_id
  ),
  ped AS (
    SELECT COALESCE(SUM(CASE WHEN valor > 0 THEN valor END),0) AS ent,
           COALESCE(SUM(CASE WHEN valor < 0 THEN -valor END),0) AS sai
    FROM get_caixa_pedidos(p_empresa_id)
    WHERE tipo = 'venda' OR data_caixa <= CURRENT_DATE
  ),
  notas_total AS (
    SELECT COALESCE(SUM(valor_total), 0) AS total FROM xml_notas WHERE empresa_id = p_empresa_id
  )
  SELECT (m.entradas + v.ent)::numeric, (m.saidas + v.sai + n.total)::numeric,
         (m.entradas + v.ent - m.saidas - v.sai - n.total)::numeric
  FROM movimentos m, ped v, notas_total n;
$function$;

REVOKE EXECUTE ON FUNCTION public.taxas_do_canal(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_caixa_pedidos(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.atualizar_taxa_real_pedido(uuid, numeric) FROM anon;