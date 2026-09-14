-- 1. Registrar quanto foi baixado do estoque pronto em cada venda
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS qtd_acabado_baixada NUMERIC NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.baixar_estoque_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec_ficha RECORD;
  estoque_disponivel NUMERIC;
  qtd_do_acabado NUMERIC;
  qtd_dos_insumos NUMERIC;
  v_qtd_conv NUMERIC;
  v_perda_div NUMERIC;
BEGIN
  IF NEW.produto_id IS NULL THEN RETURN NEW; END IF;

  SELECT estoque_acabado INTO estoque_disponivel
  FROM public.produtos WHERE id = NEW.produto_id;

  IF estoque_disponivel >= NEW.quantidade THEN
    qtd_do_acabado := NEW.quantidade; qtd_dos_insumos := 0;
  ELSIF estoque_disponivel > 0 THEN
    qtd_do_acabado := estoque_disponivel;
    qtd_dos_insumos := NEW.quantidade - estoque_disponivel;
  ELSE
    qtd_do_acabado := 0; qtd_dos_insumos := NEW.quantidade;
  END IF;

  IF qtd_do_acabado > 0 THEN
    UPDATE public.produtos
       SET estoque_acabado = estoque_acabado - qtd_do_acabado
     WHERE id = NEW.produto_id;
  END IF;

  UPDATE public.vendas SET qtd_acabado_baixada = qtd_do_acabado WHERE id = NEW.id;

  IF qtd_dos_insumos > 0 THEN
    FOR rec_ficha IN
      SELECT ft.insumo_id AS ing_id, ft.quantidade AS q, ft.unidade AS unid_ficha,
             ins.unidade_medida AS unid_insumo, COALESCE(ins.fator_perda,0) AS perda
      FROM public.fichas_tecnicas ft
      JOIN public.insumos ins ON ins.id = ft.insumo_id
      WHERE ft.produto_id = NEW.produto_id
    LOOP
      v_qtd_conv := public.converter_unidade(
        rec_ficha.q,
        COALESCE(rec_ficha.unid_ficha, rec_ficha.unid_insumo),
        rec_ficha.unid_insumo
      );
      v_perda_div := CASE WHEN rec_ficha.perda >= 100 THEN 1 ELSE 1 - (rec_ficha.perda/100.0) END;
      PERFORM public.baixar_insumo_recursivo(
        NEW.empresa_id,
        rec_ficha.ing_id,
        (v_qtd_conv * qtd_dos_insumos) / NULLIF(v_perda_div,0),
        NEW.id,
        0
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverter_estoque_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    movimento RECORD;
BEGIN
    IF OLD.produto_id IS NOT NULL THEN
        FOR movimento IN
            SELECT * FROM public.estoque_movimentos
            WHERE referencia = OLD.id AND origem = 'venda'
        LOOP
            INSERT INTO public.estoque_movimentos (
                empresa_id, insumo_id, tipo, quantidade, origem, observacao, referencia
            ) VALUES (
                movimento.empresa_id, movimento.insumo_id, 'entrada', movimento.quantidade,
                'estorno_venda', 'Estorno automático - Venda excluída', OLD.id
            );
        END LOOP;

        -- Devolve a parte atendida pelo estoque pronto (registrada na venda).
        -- Vendas antigas (sem registro) mantêm o comportamento anterior.
        IF COALESCE(OLD.qtd_acabado_baixada, 0) > 0 THEN
            UPDATE public.produtos
               SET estoque_acabado = estoque_acabado + OLD.qtd_acabado_baixada
             WHERE id = OLD.produto_id;
        ELSIF NOT EXISTS (
            SELECT 1 FROM public.estoque_movimentos WHERE referencia = OLD.id AND origem = 'venda'
        ) THEN
            UPDATE public.produtos
               SET estoque_acabado = estoque_acabado + OLD.quantidade
             WHERE id = OLD.produto_id;
        END IF;
    END IF;

    RETURN OLD;
END;
$$;

-- 2. Idempotência: uma venda por item de pedido, um caixa por pedido
CREATE UNIQUE INDEX IF NOT EXISTS vendas_pedido_unico_idx
  ON public.vendas (empresa_id, numero_pedido_externo, produto_id, descricao_produto)
  WHERE origem = 'pedido';

CREATE UNIQUE INDEX IF NOT EXISTS caixa_movimentos_pedido_unico_idx
  ON public.caixa_movimentos (empresa_id, referencia)
  WHERE origem = 'pedido';

-- 3. Pedido entregue gera venda + caixa; pedido cancelado desfaz
CREATE OR REPLACE FUNCTION public.registrar_venda_pedido(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_item JSONB;
  v_data DATE;
  v_qtd NUMERIC;
  v_preco NUMERIC;
  v_adicionais NUMERIC;
  v_produto_id UUID;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendas
    WHERE empresa_id = v_pedido.empresa_id
      AND origem = 'pedido'
      AND numero_pedido_externo = p_pedido_id::text
  ) THEN
    RETURN;
  END IF;

  v_data := COALESCE(v_pedido.data_entrega, (COALESCE(v_pedido.entregue_em, now()))::date);

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_pedido.itens, '[]'::jsonb))
  LOOP
    v_qtd := COALESCE((v_item->>'quantidade')::numeric, 0);
    IF v_qtd <= 0 THEN CONTINUE; END IF;

    v_preco := COALESCE((v_item->>'preco_unitario')::numeric, 0);
    SELECT COALESCE(SUM(COALESCE((op->>'preco_adicional')::numeric, 0)), 0)
      INTO v_adicionais
      FROM jsonb_array_elements(COALESCE(v_item->'opcionais', '[]'::jsonb)) op;

    BEGIN
      v_produto_id := NULLIF(v_item->>'produto_id', '')::uuid;
    EXCEPTION WHEN others THEN
      v_produto_id := NULL;
    END;

    IF v_produto_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.produtos WHERE id = v_produto_id AND empresa_id = v_pedido.empresa_id
    ) THEN
      v_produto_id := NULL;
    END IF;

    INSERT INTO public.vendas (
      empresa_id, produto_id, descricao_produto, quantidade, valor_total, subtotal,
      data_venda, origem, tipo_venda, canal, cliente_id, numero_pedido_externo
    ) VALUES (
      v_pedido.empresa_id,
      v_produto_id,
      COALESCE(v_item->>'nome', 'Item do pedido'),
      v_qtd,
      (v_preco + COALESCE(v_adicionais, 0)) * v_qtd,
      (v_preco + COALESCE(v_adicionais, 0)) * v_qtd,
      v_data,
      'pedido',
      'balcao',
      CASE WHEN v_pedido.tipo_entrega = 'entrega' THEN 'delivery_proprio' ELSE 'balcao' END,
      v_pedido.cliente_id,
      p_pedido_id::text
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.caixa_movimentos (
    empresa_id, tipo, categoria, descricao, valor, data_movimento, origem, referencia
  ) VALUES (
    v_pedido.empresa_id,
    'entrada',
    'Venda',
    'Pedido #' || v_pedido.numero_pedido || COALESCE(' - ' || v_pedido.cliente_nome, ''),
    v_pedido.valor_total,
    v_data,
    'pedido',
    p_pedido_id
  )
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.estornar_venda_pedido(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.vendas
   WHERE origem = 'pedido' AND numero_pedido_externo = p_pedido_id::text;

  DELETE FROM public.caixa_movimentos
   WHERE origem = 'pedido' AND referencia = p_pedido_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_pedido_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'entregue' AND COALESCE(OLD.status, '') <> 'entregue' THEN
    PERFORM public.registrar_venda_pedido(NEW.id);
  ELSIF NEW.status = 'cancelado' AND COALESCE(OLD.status, '') <> 'cancelado' THEN
    PERFORM public.estornar_venda_pedido(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_financeiro ON public.pedidos;
CREATE TRIGGER trg_pedido_financeiro
AFTER UPDATE OF status ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.trg_pedido_financeiro();