-- Trigger para calcular Custo Médio Ponderado (CMP) automaticamente
-- Quando uma entrada de estoque é registrada, atualiza o custo_unitario do insumo
-- usando a fórmula: CMP = (estoque_atual * custo_atual + qtd_entrada * custo_entrada) / (estoque_atual + qtd_entrada)

CREATE OR REPLACE FUNCTION public.calcular_custo_medio_ponderado()
RETURNS TRIGGER AS $$
DECLARE
  v_estoque_atual NUMERIC;
  v_custo_atual NUMERIC;
  v_custo_entrada NUMERIC;
  v_novo_custo NUMERIC;
  v_novo_estoque NUMERIC;
BEGIN
  -- Apenas para entradas de estoque
  IF NEW.tipo != 'entrada' THEN
    RETURN NEW;
  END IF;

  -- Calcular custo unitário da entrada
  IF NEW.custo_total IS NOT NULL AND NEW.custo_total > 0 AND NEW.quantidade > 0 THEN
    v_custo_entrada := NEW.custo_total / NEW.quantidade;
  ELSE
    -- Se não tem custo, não atualiza o CMP
    RETURN NEW;
  END IF;

  -- Buscar estoque e custo atuais do insumo
  SELECT estoque_atual, custo_unitario
  INTO v_estoque_atual, v_custo_atual
  FROM public.insumos
  WHERE id = NEW.insumo_id;

  -- Calcular CMP
  IF v_estoque_atual <= 0 OR v_custo_atual <= 0 THEN
    -- Se não tinha estoque, o custo é simplesmente o da entrada
    v_novo_custo := v_custo_entrada;
  ELSE
    -- Fórmula do Custo Médio Ponderado
    v_novo_custo := (
      (v_estoque_atual * v_custo_atual) + (NEW.quantidade * v_custo_entrada)
    ) / (v_estoque_atual + NEW.quantidade);
  END IF;

  -- Atualizar o custo unitário do insumo com o CMP
  UPDATE public.insumos
  SET custo_unitario = v_novo_custo,
      updated_at = now()
  WHERE id = NEW.insumo_id;

  -- Registrar no histórico de preços
  INSERT INTO public.historico_precos (
    empresa_id, insumo_id, preco_anterior, preco_novo,
    variacao_percentual, origem, observacao
  ) VALUES (
    NEW.empresa_id, NEW.insumo_id, v_custo_atual, v_novo_custo,
    CASE WHEN v_custo_atual > 0 THEN ((v_novo_custo - v_custo_atual) / v_custo_atual) * 100 ELSE NULL END,
    'custo_medio_ponderado',
    'Atualização automática via CMP'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger que dispara após inserção de movimento de estoque
DROP TRIGGER IF EXISTS trg_custo_medio_ponderado ON public.estoque_movimentos;
CREATE TRIGGER trg_custo_medio_ponderado
  AFTER INSERT ON public.estoque_movimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.calcular_custo_medio_ponderado();
