CREATE INDEX IF NOT EXISTS idx_encomendas_canal_id ON public.encomendas(canal_id);

-- 1) Sinal: um único lançamento no Caixa por encomenda (novas encomendas, com canal)
CREATE OR REPLACE FUNCTION public.sync_sinal_encomenda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM caixa_movimentos WHERE referencia = OLD.id AND origem IN ('encomenda_sinal','encomenda_sinal_devolucao');
    RETURN OLD;
  END IF;
  IF NEW.canal_id IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.valor_sinal,0) > 0 AND NEW.status <> 'orcamento' THEN
    UPDATE caixa_movimentos SET valor = NEW.valor_sinal,
      data_movimento = COALESCE(NEW.sinal_data, NEW.created_at::date),
      descricao = 'Sinal da encomenda de ' || NEW.cliente_nome
                  || COALESCE(' (' || NEW.sinal_forma_pagamento || ')', '')
     WHERE referencia = NEW.id AND origem = 'encomenda_sinal';
    IF NOT FOUND THEN
      INSERT INTO caixa_movimentos (empresa_id, tipo, categoria, descricao, valor, data_movimento, origem, referencia)
      VALUES (NEW.empresa_id, 'entrada', 'Sinal Encomenda',
        'Sinal da encomenda de ' || NEW.cliente_nome || COALESCE(' (' || NEW.sinal_forma_pagamento || ')', ''),
        NEW.valor_sinal, COALESCE(NEW.sinal_data, NEW.created_at::date), 'encomenda_sinal', NEW.id);
    END IF;
  ELSE
    DELETE FROM caixa_movimentos WHERE referencia = NEW.id AND origem = 'encomenda_sinal';
  END IF;
  -- Devolução do sinal no cancelamento
  IF NEW.status = 'cancelada' AND NEW.sinal_devolvido IS TRUE AND COALESCE(NEW.valor_sinal,0) > 0 THEN
    IF NOT EXISTS (SELECT 1 FROM caixa_movimentos WHERE referencia = NEW.id AND origem = 'encomenda_sinal_devolucao') THEN
      INSERT INTO caixa_movimentos (empresa_id, tipo, categoria, descricao, valor, data_movimento, origem, referencia)
      VALUES (NEW.empresa_id, 'saida', 'Sinal Encomenda', 'Devolução do sinal da encomenda de ' || NEW.cliente_nome,
        NEW.valor_sinal, CURRENT_DATE, 'encomenda_sinal_devolucao', NEW.id);
    END IF;
  ELSE
    DELETE FROM caixa_movimentos WHERE referencia = NEW.id AND origem = 'encomenda_sinal_devolucao';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_sinal_encomenda ON public.encomendas;
CREATE TRIGGER trg_sync_sinal_encomenda AFTER INSERT OR UPDATE OR DELETE ON public.encomendas
FOR EACH ROW EXECUTE FUNCTION public.sync_sinal_encomenda();

-- 2) Desfaz só a venda (mantém sinal) — usado em cancelar e reabrir
CREATE OR REPLACE FUNCTION public.desfazer_venda_encomenda(p_encomenda_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_pid uuid;
BEGIN
  FOR v_pid IN SELECT id FROM vendas_pedidos WHERE origem = 'encomenda' AND numero_externo = p_encomenda_id::text LOOP
    DELETE FROM vendas WHERE pedido_id = v_pid;
    DELETE FROM vendas_pedidos WHERE id = v_pid;
  END LOOP;
  DELETE FROM vendas WHERE origem = 'encomenda' AND numero_pedido_externo = p_encomenda_id::text;
  DELETE FROM caixa_movimentos WHERE origem = 'encomenda' AND referencia = p_encomenda_id;
  UPDATE encomendas SET pedido_id = NULL WHERE id = p_encomenda_id AND pedido_id IS NOT NULL;
END $$;

-- 3) Registrar venda: novas encomendas (com canal) viram pedido pela mesma regra das Vendas
CREATE OR REPLACE FUNCTION public.registrar_venda_encomenda(p_encomenda_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_enc RECORD; v_item RECORD; v_saldo NUMERIC; v_itens jsonb; v_pid uuid;
BEGIN
  SELECT * INTO v_enc FROM encomendas WHERE id = p_encomenda_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_enc.canal_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM vendas_pedidos WHERE origem = 'encomenda' AND numero_externo = p_encomenda_id::text) THEN RETURN; END IF;
    SELECT jsonb_agg(jsonb_build_object('produto_id', produto_id, 'descricao', produto_nome,
             'quantidade', quantidade, 'preco_unitario', preco_unitario))
      INTO v_itens FROM encomenda_itens WHERE encomenda_id = p_encomenda_id AND quantidade > 0;
    IF v_itens IS NULL THEN RETURN; END IF;
    v_pid := salvar_venda_pedido(
      jsonb_build_object('canal_id', v_enc.canal_id, 'cliente_id', v_enc.cliente_id,
        'forma_pagamento', v_enc.forma_pagamento, 'data_venda', v_enc.data_entrega,
        'origem', 'encomenda', 'numero_externo', p_encomenda_id::text, 'desconto', COALESCE(v_enc.desconto,0)),
      v_itens, NULL, p_encomenda_id);
    UPDATE vendas SET origem = 'encomenda' WHERE pedido_id = v_pid;
    UPDATE encomendas SET pedido_id = v_pid WHERE id = p_encomenda_id;
    RETURN;
  END IF;

  -- Encomendas antigas (sem canal): comportamento anterior
  IF EXISTS (SELECT 1 FROM vendas WHERE empresa_id = v_enc.empresa_id AND origem = 'encomenda'
             AND numero_pedido_externo = p_encomenda_id::text) THEN RETURN; END IF;
  FOR v_item IN SELECT * FROM encomenda_itens WHERE encomenda_id = p_encomenda_id LOOP
    INSERT INTO vendas (empresa_id, produto_id, descricao_produto, quantidade, valor_total, subtotal,
      data_venda, origem, tipo_venda, canal, cliente_id, numero_pedido_externo)
    VALUES (v_enc.empresa_id, v_item.produto_id, v_item.produto_nome, v_item.quantidade,
      v_item.quantidade * v_item.preco_unitario, v_item.quantidade * v_item.preco_unitario,
      v_enc.data_entrega, 'encomenda', 'encomenda', 'encomenda', v_enc.cliente_id, p_encomenda_id::text)
    ON CONFLICT DO NOTHING;
  END LOOP;
  v_saldo := COALESCE(v_enc.valor_total, 0) - COALESCE(v_enc.valor_sinal, 0);
  IF v_saldo > 0 THEN
    INSERT INTO caixa_movimentos (empresa_id, tipo, categoria, descricao, valor, data_movimento, origem, referencia)
    VALUES (v_enc.empresa_id, 'entrada', 'Encomenda', 'Encomenda - ' || v_enc.cliente_nome, v_saldo, v_enc.data_entrega, 'encomenda', p_encomenda_id);
  END IF;
  IF COALESCE(v_enc.valor_sinal, 0) > 0 THEN
    INSERT INTO caixa_movimentos (empresa_id, tipo, categoria, descricao, valor, data_movimento, origem, referencia)
    VALUES (v_enc.empresa_id, 'entrada', 'Sinal Encomenda', 'Sinal - ' || v_enc.cliente_nome, v_enc.valor_sinal, v_enc.created_at::date, 'encomenda', p_encomenda_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.estornar_venda_encomenda(p_encomenda_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM desfazer_venda_encomenda(p_encomenda_id);
END $$;

CREATE OR REPLACE FUNCTION public.trg_encomenda_financeiro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'entregue' AND COALESCE(OLD.status, '') <> 'entregue' THEN
    PERFORM registrar_venda_encomenda(NEW.id);
  ELSIF NEW.status = 'cancelada' AND COALESCE(OLD.status, '') <> 'cancelada' THEN
    PERFORM estornar_venda_encomenda(NEW.id);
  ELSIF OLD.status = 'entregue' AND NEW.status <> 'entregue' THEN
    PERFORM desfazer_venda_encomenda(NEW.id);
  END IF;
  RETURN NEW;
END $$;

-- 4) Reabrir encomenda entregue
CREATE OR REPLACE FUNCTION public.reabrir_encomenda(p_encomenda_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM encomendas WHERE id = p_encomenda_id AND empresa_id = get_user_empresa_id() AND status = 'entregue') THEN
    RAISE EXCEPTION 'Encomenda não encontrada ou não está entregue';
  END IF;
  UPDATE encomendas SET status = 'pronta' WHERE id = p_encomenda_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.reabrir_encomenda(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reabrir_encomenda(uuid) TO authenticated;

-- 5) Caixa: na entrega entra o valor do pedido menos o sinal já recebido
CREATE OR REPLACE FUNCTION public.get_caixa_pedidos(p_empresa_id uuid)
 RETURNS TABLE(pedido_id uuid, canal_id uuid, canal_nome text, data_caixa date, tipo text, valor numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH pedidos AS (
 SELECT vp.*, COALESCE(c.nome, vp.canal_texto) AS nome_canal,
 CASE WHEN vp.pagamento_recebido_por='plataforma' THEN 'plataforma'
 WHEN c.tipo='app_delivery' AND vp.pagamento_recebido_por='loja' THEN 'loja_app'
 ELSE 'normal' END AS modo,
 COALESCE((SELECT e.valor_sinal FROM public.encomendas e
            WHERE vp.origem='encomenda' AND e.id::text=vp.numero_externo AND e.canal_id IS NOT NULL),0) AS sinal
 FROM public.vendas_pedidos vp LEFT JOIN public.canais_venda c ON c.id=vp.canal_id
 WHERE vp.empresa_id=p_empresa_id AND (p_empresa_id=public.get_user_empresa_id() OR auth.uid() IS NULL)
), linhas AS (
 SELECT id AS pedido_id, canal_id, nome_canal, COALESCE(data_repasse_prevista,data_venda) AS data_caixa, 'repasse'::text AS tipo, valor_liquido AS valor FROM pedidos WHERE modo='plataforma'
 UNION ALL SELECT id,canal_id,nome_canal,data_venda,'venda',valor_bruto-sinal FROM pedidos WHERE modo='loja_app'
 UNION ALL SELECT id,canal_id,nome_canal,COALESCE(data_repasse_prevista,data_venda),'desconto_repasse',-taxa_canal FROM pedidos WHERE modo='loja_app' AND taxa_canal>0
 UNION ALL SELECT id,canal_id,nome_canal,data_venda,'venda',(CASE WHEN valor_liquido>0 THEN valor_liquido ELSE valor_bruto END)-sinal FROM pedidos WHERE modo='normal'
), meses AS (
 SELECT c.id AS canal_id,c.nome,c.mensalidade,date_trunc('month',p.data_venda)::date AS mes,
 max(CASE WHEN p.modo='plataforma' THEN COALESCE(p.data_repasse_prevista,p.data_venda) END) AS data_repasse,
 COALESCE(sum(CASE WHEN p.modo='plataforma' THEN p.valor_liquido ELSE 0 END),0)-COALESCE(sum(CASE WHEN p.modo='loja_app' THEN p.taxa_canal ELSE 0 END),0) AS disponivel,
 max(p.data_venda) AS ultima_venda
 FROM public.canais_venda c JOIN pedidos p ON p.canal_id=c.id
 WHERE c.empresa_id=p_empresa_id AND c.mensalidade>0
 GROUP BY c.id,c.nome,c.mensalidade,date_trunc('month',p.data_venda)::date
), cobranca AS (
 SELECT *,CASE WHEN data_repasse IS NULL THEN 0 ELSE LEAST(mensalidade,GREATEST(disponivel,0)) END AS abatimento FROM meses
)
SELECT * FROM linhas
UNION ALL SELECT NULL::uuid,canal_id,nome,data_repasse,'mensalidade',-abatimento FROM cobranca WHERE abatimento>0
UNION ALL SELECT NULL::uuid,canal_id,nome,LEAST(ultima_venda,(mes+interval '1 month - 1 day')::date),'mensalidade_saida',-(mensalidade-abatimento) FROM cobranca WHERE mensalidade>abatimento;
$function$;