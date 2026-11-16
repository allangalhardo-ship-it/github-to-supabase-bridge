
-- 1) Cabeçalho do pedido de venda
CREATE TABLE public.vendas_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  canal_id uuid REFERENCES public.canais_venda(id) ON DELETE SET NULL,
  canal_texto text,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  forma_pagamento text,
  data_venda date NOT NULL DEFAULT CURRENT_DATE,
  origem text NOT NULL DEFAULT 'manual',
  numero_externo text,
  desconto numeric NOT NULL DEFAULT 0,
  taxa_entrega numeric NOT NULL DEFAULT 0,
  taxa_canal numeric NOT NULL DEFAULT 0,
  valor_bruto numeric NOT NULL DEFAULT 0,
  valor_liquido numeric NOT NULL DEFAULT 0,
  qtd_itens integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo',
  idempotency_key uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas_pedidos TO authenticated;
GRANT ALL ON public.vendas_pedidos TO service_role;
ALTER TABLE public.vendas_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresa vê seus pedidos de venda" ON public.vendas_pedidos FOR SELECT TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Empresa cria seus pedidos de venda" ON public.vendas_pedidos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Empresa edita seus pedidos de venda" ON public.vendas_pedidos FOR UPDATE TO authenticated USING (empresa_id = public.get_user_empresa_id()) WITH CHECK (empresa_id = public.get_user_empresa_id());
CREATE POLICY "Empresa apaga seus pedidos de venda" ON public.vendas_pedidos FOR DELETE TO authenticated USING (empresa_id = public.get_user_empresa_id());
CREATE INDEX idx_vendas_pedidos_empresa_data ON public.vendas_pedidos(empresa_id, data_venda DESC);
CREATE INDEX idx_vendas_pedidos_numero ON public.vendas_pedidos(empresa_id, origem, numero_externo) WHERE numero_externo IS NOT NULL;
CREATE UNIQUE INDEX vendas_pedidos_idem_idx ON public.vendas_pedidos(empresa_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TRIGGER tr_update_vendas_pedidos_updated_at BEFORE UPDATE ON public.vendas_pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Itens ligados ao pedido
ALTER TABLE public.vendas ADD COLUMN pedido_id uuid REFERENCES public.vendas_pedidos(id) ON DELETE CASCADE;
ALTER TABLE public.vendas ADD COLUMN preco_unitario numeric;
CREATE INDEX idx_vendas_pedido_id ON public.vendas(pedido_id);

-- 3) Normalização e resolução de canal
CREATE OR REPLACE FUNCTION public.normalizar_nome_canal(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN n IN ('99','99food','99foods') THEN '99food'
    WHEN n IN ('ifood','i-food') THEN 'ifood'
    WHEN n IN ('balcao','loja','presencial') THEN 'balcao'
    WHEN n IN ('whatsapp','whats','zap','wpp') THEN 'whatsapp'
    ELSE n END
  FROM (SELECT lower(translate(replace(coalesce(p,''),' ',''),
    'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇáàãâäéèêëíìîïóòõôöúùûüç',
    'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')) AS n) t;
$$;

CREATE OR REPLACE FUNCTION public.resolver_canal_id(p_empresa_id uuid, p_texto text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_texto IS NULL OR trim(p_texto) = '' THEN RETURN NULL; END IF;
  IF p_texto ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v_id FROM canais_venda WHERE id = p_texto::uuid AND empresa_id = p_empresa_id;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;
  SELECT id INTO v_id FROM canais_venda
   WHERE empresa_id = p_empresa_id
     AND normalizar_nome_canal(nome) = normalizar_nome_canal(p_texto)
   ORDER BY ativo DESC, created_at ASC LIMIT 1;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.origem_pedido_de_venda(p_origem text, p_plataforma text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN p_plataforma ILIKE '99%' THEN '99food'
    WHEN p_origem = 'importacao' THEN 'planilha'
    WHEN p_origem = 'importacao_foto' THEN 'foto'
    WHEN p_origem IS NULL THEN 'manual'
    ELSE p_origem END;
$$;

-- 4) Recalcula os totais do pedido a partir dos itens
CREATE OR REPLACE FUNCTION public.recalcular_totais_pedido(p_pedido_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_n int;
BEGIN
  IF p_pedido_id IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_n FROM vendas WHERE pedido_id = p_pedido_id;
  UPDATE vendas_pedidos p SET
    qtd_itens   = v_n,
    taxa_canal  = COALESCE((SELECT sum(COALESCE(v.valor_total,0) - CASE WHEN v.valor_liquido > 0 THEN v.valor_liquido ELSE v.valor_total END) FROM vendas v WHERE v.pedido_id = p_pedido_id), 0),
    valor_bruto = COALESCE((SELECT sum(v.valor_total) FROM vendas v WHERE v.pedido_id = p_pedido_id), 0) + p.taxa_entrega,
    valor_liquido = COALESCE((SELECT sum(CASE WHEN v.valor_liquido > 0 THEN v.valor_liquido ELSE v.valor_total END) FROM vendas v WHERE v.pedido_id = p_pedido_id), 0) + p.taxa_entrega
  WHERE p.id = p_pedido_id;
END; $$;

-- 5) Rede de segurança: item gravado sem pedido ganha um pedido automaticamente
CREATE OR REPLACE FUNCTION public.trg_vendas_garantir_pedido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_pid uuid; v_canal uuid; v_origem text; v_nome text;
BEGIN
  v_canal := resolver_canal_id(NEW.empresa_id, NEW.canal);
  IF v_canal IS NOT NULL THEN
    SELECT nome INTO v_nome FROM canais_venda WHERE id = v_canal;
  END IF;
  IF NEW.pedido_id IS NULL THEN
    v_origem := origem_pedido_de_venda(NEW.origem, NEW.plataforma);
    IF NEW.numero_pedido_externo IS NOT NULL AND NEW.numero_pedido_externo <> '' THEN
      SELECT id INTO v_pid FROM vendas_pedidos
       WHERE empresa_id = NEW.empresa_id AND origem = v_origem
         AND numero_externo = NEW.numero_pedido_externo
         AND (v_origem IN ('encomenda','pedido') OR data_venda = NEW.data_venda)
       LIMIT 1;
    END IF;
    IF v_pid IS NULL THEN
      INSERT INTO vendas_pedidos (empresa_id, canal_id, canal_texto, cliente_id, data_venda, origem, numero_externo)
      VALUES (NEW.empresa_id, v_canal, NEW.canal, NEW.cliente_id, NEW.data_venda, v_origem, NULLIF(NEW.numero_pedido_externo,''))
      RETURNING id INTO v_pid;
    END IF;
    NEW.pedido_id := v_pid;
  END IF;
  -- Nome do canal sempre igual ao cadastro (evita variações "Ifood"/"iFood")
  IF v_nome IS NOT NULL THEN NEW.canal := v_nome; END IF;
  IF NEW.preco_unitario IS NULL AND COALESCE(NEW.quantidade,0) > 0 THEN
    NEW.preco_unitario := round(COALESCE(NEW.subtotal, NEW.valor_total) / NEW.quantidade, 4);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER tr_vendas_garantir_pedido BEFORE INSERT ON public.vendas FOR EACH ROW EXECUTE FUNCTION public.trg_vendas_garantir_pedido();

CREATE OR REPLACE FUNCTION public.trg_vendas_totais_pedido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN PERFORM recalcular_totais_pedido(NEW.pedido_id); END IF;
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.pedido_id IS DISTINCT FROM COALESCE(CASE WHEN TG_OP='UPDATE' THEN NEW.pedido_id END, NULL) THEN
    PERFORM recalcular_totais_pedido(OLD.pedido_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    -- pedido sem itens (exclusão item a item) some junto
    DELETE FROM vendas_pedidos p WHERE p.id = OLD.pedido_id AND NOT EXISTS (SELECT 1 FROM vendas WHERE pedido_id = OLD.pedido_id) AND p.taxa_entrega = 0;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER tr_vendas_totais_pedido AFTER INSERT OR UPDATE OF valor_total, valor_liquido, pedido_id OR DELETE ON public.vendas FOR EACH ROW EXECUTE FUNCTION public.trg_vendas_totais_pedido();

-- 6) Salvar (criar/editar) pedido inteiro de uma vez
CREATE OR REPLACE FUNCTION public.salvar_venda_pedido(p_pedido jsonb, p_itens jsonb, p_pedido_id uuid DEFAULT NULL, p_idempotency_key uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    INSERT INTO vendas_pedidos (empresa_id, canal_id, canal_texto, cliente_id, forma_pagamento, data_venda, origem, numero_externo, desconto, taxa_entrega, idempotency_key)
    VALUES (v_emp, v_canal, v_canal_nome, v_cli, NULLIF(p_pedido->>'forma_pagamento',''), v_data,
            COALESCE(NULLIF(p_pedido->>'origem',''),'manual'), NULLIF(p_pedido->>'numero_externo',''), v_desc, v_entrega, p_idempotency_key)
    RETURNING id INTO v_pid;
    v_origem := COALESCE(NULLIF(p_pedido->>'origem',''),'manual');
  ELSE
    SELECT origem INTO v_origem FROM vendas_pedidos WHERE id = v_pid AND empresa_id = v_emp;
    IF v_origem IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
    IF v_origem IN ('encomenda','pedido') THEN RAISE EXCEPTION 'Este pedido deve ser alterado na tela de origem'; END IF;
    UPDATE vendas_pedidos SET canal_id = v_canal, canal_texto = v_canal_nome, cliente_id = v_cli,
      forma_pagamento = NULLIF(p_pedido->>'forma_pagamento',''), data_venda = v_data,
      desconto = v_desc, taxa_entrega = v_entrega
    WHERE id = v_pid;
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
      -- Mesmo produto e quantidade: só atualiza valores (sem mexer no estoque)
      UPDATE vendas SET preco_unitario = v_preco, subtotal = v_bruto, valor_total = v_valor,
        comissao_plataforma = v_com, valor_liquido = v_valor - v_com,
        canal = COALESCE(v_canal_nome, canal), cliente_id = v_cli, data_venda = v_data,
        tipo_venda = CASE WHEN v_tipo = 'app_delivery' THEN 'app' ELSE 'direto' END
      WHERE id = v_found;
      v_keep := v_keep || v_found;
    ELSE
      INSERT INTO vendas (empresa_id, pedido_id, produto_id, descricao_produto, quantidade, preco_unitario, subtotal, valor_total,
        comissao_plataforma, valor_liquido, data_venda, canal, cliente_id, origem, tipo_venda)
      VALUES (v_emp, v_pid, v_prod, NULLIF(v_item->>'descricao',''), v_qtd, v_preco, v_bruto, v_valor,
        v_com, v_valor - v_com, v_data, v_canal_nome, v_cli,
        CASE WHEN v_origem IN ('planilha') THEN 'importacao' WHEN v_origem = 'foto' THEN 'importacao_foto' ELSE 'manual' END,
        CASE WHEN v_tipo = 'app_delivery' THEN 'app' ELSE 'direto' END)
      RETURNING id INTO v_found;
      v_keep := v_keep || v_found;
    END IF;
  END LOOP;

  -- Itens removidos ou com quantidade alterada: apagar devolve o estoque (gatilho existente)
  DELETE FROM vendas WHERE pedido_id = v_pid AND NOT (id = ANY(v_keep));
  PERFORM recalcular_totais_pedido(v_pid);
  RETURN v_pid;
END; $$;

CREATE OR REPLACE FUNCTION public.cancelar_venda_pedido(p_pedido_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_origem text;
BEGIN
  SELECT origem INTO v_origem FROM vendas_pedidos WHERE id = p_pedido_id AND empresa_id = get_user_empresa_id();
  IF v_origem IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_origem IN ('encomenda','pedido') THEN RAISE EXCEPTION 'Este pedido deve ser cancelado na tela de origem'; END IF;
  DELETE FROM vendas WHERE pedido_id = p_pedido_id;
  DELETE FROM vendas_pedidos WHERE id = p_pedido_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.salvar_venda_pedido(jsonb, jsonb, uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancelar_venda_pedido(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.salvar_venda_pedido(jsonb, jsonb, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_venda_pedido(uuid) TO authenticated;

-- 7) Estornos de encomenda/pedido do cardápio apagam também o cabeçalho
CREATE OR REPLACE FUNCTION public.estornar_venda_encomenda(p_encomenda_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.vendas WHERE origem = 'encomenda' AND numero_pedido_externo = p_encomenda_id::text;
  DELETE FROM public.vendas_pedidos WHERE origem = 'encomenda' AND numero_externo = p_encomenda_id::text;
  DELETE FROM public.caixa_movimentos WHERE origem = 'encomenda' AND referencia = p_encomenda_id;
END; $$;
CREATE OR REPLACE FUNCTION public.estornar_venda_pedido(p_pedido_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.vendas WHERE origem = 'pedido' AND numero_pedido_externo = p_pedido_id::text;
  DELETE FROM public.vendas_pedidos WHERE origem = 'pedido' AND numero_externo = p_pedido_id::text;
  DELETE FROM public.caixa_movimentos WHERE origem = 'pedido' AND referencia = p_pedido_id;
END; $$;

-- 8) Saldo do caixa inclui a taxa de entrega cobrada no pedido
CREATE OR REPLACE FUNCTION public.get_saldo_caixa(p_empresa_id uuid)
 RETURNS TABLE(total_entradas numeric, total_saidas numeric, saldo numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH movimentos AS (
    SELECT COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS entradas,
           COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS saidas
    FROM caixa_movimentos WHERE empresa_id = p_empresa_id
  ),
  vendas_total AS (
    SELECT COALESCE(SUM(CASE WHEN valor_liquido > 0 THEN valor_liquido ELSE valor_total END), 0)
         + COALESCE((SELECT SUM(taxa_entrega) FROM vendas_pedidos WHERE empresa_id = p_empresa_id), 0) AS total
    FROM vendas WHERE empresa_id = p_empresa_id
  ),
  notas_total AS (
    SELECT COALESCE(SUM(valor_total), 0) AS total FROM xml_notas WHERE empresa_id = p_empresa_id
  )
  SELECT (m.entradas + v.total)::numeric, (m.saidas + n.total)::numeric, (m.entradas + v.total - m.saidas - n.total)::numeric
  FROM movimentos m, vendas_total v, notas_total n;
$function$;

-- 9) Painel: devolve pedido e canal do cadastro
DROP FUNCTION IF EXISTS public.get_dashboard_vendas(uuid, date, date);
CREATE FUNCTION public.get_dashboard_vendas(p_empresa_id uuid, p_data_inicio date, p_data_fim date)
 RETURNS TABLE(id uuid, data_venda date, valor_total numeric, quantidade numeric, canal text, produto_id uuid, produto_nome text, produto_preco_venda numeric, custo_insumos numeric, custo_snapshot numeric, pedido_id uuid, canal_id uuid)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT v.id, v.data_venda::date, v.valor_total, v.quantidade,
    COALESCE(c.nome, v.canal) AS canal,
    v.produto_id, p.nome, p.preco_venda,
    COALESCE(public.calcular_custo_ficha(p.id), 0), v.custo_snapshot,
    v.pedido_id, vp.canal_id
  FROM vendas v
  LEFT JOIN produtos p ON p.id = v.produto_id
  LEFT JOIN vendas_pedidos vp ON vp.id = v.pedido_id
  LEFT JOIN canais_venda c ON c.id = vp.canal_id
  WHERE v.empresa_id = p_empresa_id AND v.data_venda >= p_data_inicio AND v.data_venda <= p_data_fim
  ORDER BY v.data_venda DESC;
$function$;
