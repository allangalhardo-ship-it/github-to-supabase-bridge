CREATE UNIQUE INDEX IF NOT EXISTS vendas_encomenda_unico_idx
  ON public.vendas (empresa_id, numero_pedido_externo, produto_id, descricao_produto)
  WHERE origem = 'encomenda';

CREATE UNIQUE INDEX IF NOT EXISTS caixa_movimentos_encomenda_unico_idx
  ON public.caixa_movimentos (empresa_id, referencia, categoria)
  WHERE origem = 'encomenda';

CREATE OR REPLACE FUNCTION public.registrar_venda_encomenda(p_encomenda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enc RECORD;
  v_item RECORD;
  v_saldo NUMERIC;
BEGIN
  SELECT * INTO v_enc FROM public.encomendas WHERE id = p_encomenda_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendas
    WHERE empresa_id = v_enc.empresa_id
      AND origem = 'encomenda'
      AND numero_pedido_externo = p_encomenda_id::text
  ) THEN
    RETURN;
  END IF;

  FOR v_item IN
    SELECT * FROM public.encomenda_itens WHERE encomenda_id = p_encomenda_id
  LOOP
    INSERT INTO public.vendas (
      empresa_id, produto_id, descricao_produto, quantidade, valor_total, subtotal,
      data_venda, origem, tipo_venda, canal, cliente_id, numero_pedido_externo
    ) VALUES (
      v_enc.empresa_id,
      v_item.produto_id,
      v_item.produto_nome,
      v_item.quantidade,
      v_item.quantidade * v_item.preco_unitario,
      v_item.quantidade * v_item.preco_unitario,
      v_enc.data_entrega,
      'encomenda',
      'encomenda',
      'encomenda',
      v_enc.cliente_id,
      p_encomenda_id::text
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  v_saldo := COALESCE(v_enc.valor_total, 0) - COALESCE(v_enc.valor_sinal, 0);

  IF v_saldo > 0 THEN
    INSERT INTO public.caixa_movimentos (
      empresa_id, tipo, categoria, descricao, valor, data_movimento, origem, referencia
    ) VALUES (
      v_enc.empresa_id, 'entrada', 'Encomenda',
      'Encomenda - ' || v_enc.cliente_nome, v_saldo, v_enc.data_entrega, 'encomenda', p_encomenda_id
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF COALESCE(v_enc.valor_sinal, 0) > 0 THEN
    INSERT INTO public.caixa_movimentos (
      empresa_id, tipo, categoria, descricao, valor, data_movimento, origem, referencia
    ) VALUES (
      v_enc.empresa_id, 'entrada', 'Sinal Encomenda',
      'Sinal - ' || v_enc.cliente_nome, v_enc.valor_sinal, v_enc.created_at::date, 'encomenda', p_encomenda_id
    ) ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.estornar_venda_encomenda(p_encomenda_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.vendas
   WHERE origem = 'encomenda' AND numero_pedido_externo = p_encomenda_id::text;

  DELETE FROM public.caixa_movimentos
   WHERE origem = 'encomenda' AND referencia = p_encomenda_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_encomenda_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'entregue' AND COALESCE(OLD.status, '') <> 'entregue' THEN
    PERFORM public.registrar_venda_encomenda(NEW.id);
  ELSIF NEW.status = 'cancelada' AND COALESCE(OLD.status, '') <> 'cancelada' THEN
    PERFORM public.estornar_venda_encomenda(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encomenda_financeiro ON public.encomendas;
CREATE TRIGGER trg_encomenda_financeiro
AFTER UPDATE OF status ON public.encomendas
FOR EACH ROW EXECUTE FUNCTION public.trg_encomenda_financeiro();

REVOKE EXECUTE ON FUNCTION public.registrar_venda_encomenda(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.estornar_venda_encomenda(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_encomenda_financeiro() FROM anon, authenticated;