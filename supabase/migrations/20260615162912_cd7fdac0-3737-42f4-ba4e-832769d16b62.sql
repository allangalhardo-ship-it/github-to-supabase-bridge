
-- =====================================================================
-- FASE 1 — Fundação Precificação & Ficha Técnica (v2 — fix loop alias)
-- =====================================================================

-- 1) Novas colunas
ALTER TABLE public.fichas_tecnicas ADD COLUMN IF NOT EXISTS unidade TEXT;
ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS fator_perda NUMERIC NOT NULL DEFAULT 0
    CHECK (fator_perda >= 0 AND fator_perda < 100);
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS custo_snapshot NUMERIC;

COMMENT ON COLUMN public.fichas_tecnicas.unidade
  IS 'Unidade da quantidade na ficha (g, kg, ml, L, un...). Se NULL, assume a mesma unidade do insumo.';
COMMENT ON COLUMN public.insumos.fator_perda
  IS 'Percentual de perda/quebra (0-99). Custo efetivo = custo / (1 - fator_perda/100).';
COMMENT ON COLUMN public.vendas.custo_snapshot
  IS 'Custo total da ficha técnica congelado no momento da venda. Mantém histórico de CMV imune a reajustes futuros.';

-- 2) Conversão de unidades
CREATE OR REPLACE FUNCTION public.converter_unidade(
  p_qtd NUMERIC, p_de TEXT, p_para TEXT
) RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE
SET search_path = public AS $$
DECLARE
  v_de   TEXT := lower(trim(coalesce(p_de,'')));
  v_para TEXT := lower(trim(coalesce(p_para,'')));
BEGIN
  IF p_qtd IS NULL THEN RETURN 0; END IF;
  IF v_de = '' OR v_para = '' THEN RETURN p_qtd; END IF;
  IF v_de   IN ('l','lt','litro','litros')             THEN v_de   := 'l';  END IF;
  IF v_para IN ('l','lt','litro','litros')             THEN v_para := 'l';  END IF;
  IF v_de   IN ('un','unid','unidade','und','pç','pc') THEN v_de   := 'un'; END IF;
  IF v_para IN ('un','unid','unidade','und','pç','pc') THEN v_para := 'un'; END IF;
  IF v_de = v_para THEN RETURN p_qtd; END IF;
  IF v_de='g'  AND v_para='kg' THEN RETURN p_qtd / 1000.0; END IF;
  IF v_de='kg' AND v_para='g'  THEN RETURN p_qtd * 1000.0; END IF;
  IF v_de='mg' AND v_para='g'  THEN RETURN p_qtd / 1000.0; END IF;
  IF v_de='g'  AND v_para='mg' THEN RETURN p_qtd * 1000.0; END IF;
  IF v_de='mg' AND v_para='kg' THEN RETURN p_qtd / 1000000.0; END IF;
  IF v_de='kg' AND v_para='mg' THEN RETURN p_qtd * 1000000.0; END IF;
  IF v_de='ml' AND v_para='l'  THEN RETURN p_qtd / 1000.0; END IF;
  IF v_de='l'  AND v_para='ml' THEN RETURN p_qtd * 1000.0; END IF;
  RAISE EXCEPTION 'Conversão de unidade incompatível: % -> %', p_de, p_para;
END;
$$;

-- 3) Recalcular custo de UM insumo intermediário
CREATE OR REPLACE FUNCTION public.recalcular_custo_intermediario(
  p_insumo_id UUID, p_depth INT DEFAULT 0
) RETURNS NUMERIC LANGUAGE plpgsql
SET search_path = public AS $$
DECLARE
  v_is_int  BOOLEAN;
  v_rend    NUMERIC;
  v_custo   NUMERIC := 0;
  rec_comp  RECORD;
  v_custo_comp NUMERIC;
  v_perda_div  NUMERIC;
BEGIN
  IF p_depth > 10 THEN
    RAISE EXCEPTION 'Profundidade máxima de sub-receitas atingida. Insumo %', p_insumo_id;
  END IF;

  SELECT is_intermediario, COALESCE(NULLIF(rendimento_receita,0), 1)
    INTO v_is_int, v_rend
  FROM public.insumos WHERE id = p_insumo_id;

  IF v_is_int IS NULL OR NOT v_is_int THEN RETURN NULL; END IF;

  FOR rec_comp IN
    SELECT ri.quantidade AS q, ri.insumo_ingrediente_id AS ing_id,
           ins.custo_unitario AS cu, ins.is_intermediario AS is_int,
           COALESCE(ins.fator_perda,0) AS perda
    FROM public.receitas_intermediarias ri
    JOIN public.insumos ins ON ins.id = ri.insumo_ingrediente_id
    WHERE ri.insumo_id = p_insumo_id
  LOOP
    IF rec_comp.is_int THEN
      v_custo_comp := COALESCE(
        public.recalcular_custo_intermediario(rec_comp.ing_id, p_depth+1),
        rec_comp.cu
      );
    ELSE
      v_custo_comp := rec_comp.cu;
    END IF;
    v_perda_div := CASE WHEN rec_comp.perda >= 100 THEN 1 ELSE 1 - (rec_comp.perda/100.0) END;
    v_custo := v_custo + (rec_comp.q * COALESCE(v_custo_comp,0) / NULLIF(v_perda_div,0));
  END LOOP;

  v_custo := v_custo / NULLIF(v_rend,0);

  UPDATE public.insumos
     SET custo_unitario = v_custo, updated_at = now()
   WHERE id = p_insumo_id
     AND custo_unitario IS DISTINCT FROM v_custo;

  RETURN v_custo;
END;
$$;

-- 4) Calcular custo total da ficha de UM produto
CREATE OR REPLACE FUNCTION public.calcular_custo_ficha(p_produto_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE
SET search_path = public AS $$
DECLARE
  v_total NUMERIC := 0;
  v_rend  NUMERIC;
  rec_ft  RECORD;
  v_qtd_conv NUMERIC;
  v_perda_div NUMERIC;
BEGIN
  SELECT COALESCE(NULLIF(rendimento_padrao,0),1) INTO v_rend
  FROM public.produtos WHERE id = p_produto_id;

  FOR rec_ft IN
    SELECT ft.quantidade AS q, ft.unidade AS unid_ficha,
           ins.custo_unitario AS cu, ins.unidade_medida AS unid_insumo,
           COALESCE(ins.fator_perda,0) AS perda
    FROM public.fichas_tecnicas ft
    JOIN public.insumos ins ON ins.id = ft.insumo_id
    WHERE ft.produto_id = p_produto_id
  LOOP
    v_qtd_conv := public.converter_unidade(
      rec_ft.q,
      COALESCE(rec_ft.unid_ficha, rec_ft.unid_insumo),
      rec_ft.unid_insumo
    );
    v_perda_div := CASE WHEN rec_ft.perda >= 100 THEN 1 ELSE 1 - (rec_ft.perda/100.0) END;
    v_total := v_total + (v_qtd_conv * COALESCE(rec_ft.cu,0) / NULLIF(v_perda_div,0));
  END LOOP;

  RETURN COALESCE(v_total / NULLIF(v_rend,0), 0);
END;
$$;

-- 5a) Trigger composição de sub-receita -> recalcula pai + cascateia
CREATE OR REPLACE FUNCTION public.trg_recalc_intermediario_composicao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_pai UUID := COALESCE(NEW.insumo_id, OLD.insumo_id);
  rec_pai RECORD;
BEGIN
  PERFORM public.recalcular_custo_intermediario(v_pai);
  FOR rec_pai IN
    SELECT DISTINCT ri.insumo_id AS pai_id
    FROM public.receitas_intermediarias ri
    WHERE ri.insumo_ingrediente_id = v_pai
  LOOP
    PERFORM public.recalcular_custo_intermediario(rec_pai.pai_id);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ri_composicao ON public.receitas_intermediarias;
CREATE TRIGGER trg_ri_composicao
AFTER INSERT OR UPDATE OR DELETE ON public.receitas_intermediarias
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_intermediario_composicao();

-- 5b) Trigger cascata: custo do insumo mudou -> recalcula intermediários que o usam
CREATE OR REPLACE FUNCTION public.trg_cascata_custo_insumo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  rec_pai RECORD;
BEGIN
  IF NEW.custo_unitario IS NOT DISTINCT FROM OLD.custo_unitario THEN
    RETURN NEW;
  END IF;
  FOR rec_pai IN
    SELECT DISTINCT ri.insumo_id AS pai_id
    FROM public.receitas_intermediarias ri
    WHERE ri.insumo_ingrediente_id = NEW.id
  LOOP
    PERFORM public.recalcular_custo_intermediario(rec_pai.pai_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_insumo_custo_cascata ON public.insumos;
CREATE TRIGGER trg_insumo_custo_cascata
AFTER UPDATE OF custo_unitario ON public.insumos
FOR EACH ROW EXECUTE FUNCTION public.trg_cascata_custo_insumo();

-- 6) Snapshot de custo na venda
CREATE OR REPLACE FUNCTION public.trg_vendas_custo_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.custo_snapshot IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.produto_id IS NULL THEN RETURN NEW; END IF;
  NEW.custo_snapshot := public.calcular_custo_ficha(NEW.produto_id) * COALESCE(NEW.quantidade,1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendas_snapshot ON public.vendas;
CREATE TRIGGER trg_vendas_snapshot
BEFORE INSERT ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.trg_vendas_custo_snapshot();

-- Backfill snapshot de vendas antigas
UPDATE public.vendas
   SET custo_snapshot = public.calcular_custo_ficha(produto_id) * COALESCE(quantidade,1)
 WHERE custo_snapshot IS NULL AND produto_id IS NOT NULL;

-- 7) baixar_estoque_venda v2 (explode intermediários)
-- 7a) função recursiva auxiliar
CREATE OR REPLACE FUNCTION public.baixar_insumo_recursivo(
  p_empresa_id UUID,
  p_insumo_id UUID,
  p_quantidade NUMERIC,
  p_venda_id UUID,
  p_depth INT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_is_int BOOLEAN;
  v_estoque NUMERIC;
  v_rend NUMERIC;
  v_do_estoque NUMERIC;
  v_a_explodir NUMERIC;
  rec_comp RECORD;
  v_perda_div NUMERIC;
BEGIN
  IF p_depth > 10 OR p_quantidade <= 0 THEN RETURN; END IF;

  SELECT is_intermediario, estoque_atual, COALESCE(NULLIF(rendimento_receita,0),1)
    INTO v_is_int, v_estoque, v_rend
  FROM public.insumos WHERE id = p_insumo_id;

  IF v_is_int IS NULL THEN RETURN; END IF;

  IF NOT v_is_int THEN
    INSERT INTO public.estoque_movimentos
      (empresa_id, insumo_id, tipo, quantidade, origem, observacao, referencia)
    VALUES
      (p_empresa_id, p_insumo_id, 'saida', p_quantidade, 'venda',
       'Baixa automática - Venda', p_venda_id);
    RETURN;
  END IF;

  IF v_estoque >= p_quantidade THEN
    v_do_estoque := p_quantidade; v_a_explodir := 0;
  ELSIF v_estoque > 0 THEN
    v_do_estoque := v_estoque; v_a_explodir := p_quantidade - v_estoque;
  ELSE
    v_do_estoque := 0; v_a_explodir := p_quantidade;
  END IF;

  IF v_do_estoque > 0 THEN
    INSERT INTO public.estoque_movimentos
      (empresa_id, insumo_id, tipo, quantidade, origem, observacao, referencia)
    VALUES
      (p_empresa_id, p_insumo_id, 'saida', v_do_estoque, 'venda',
       'Baixa de sub-receita pronta', p_venda_id);
  END IF;

  IF v_a_explodir > 0 THEN
    FOR rec_comp IN
      SELECT ri.insumo_ingrediente_id AS ing_id, ri.quantidade AS q,
             COALESCE(ins.fator_perda,0) AS perda
      FROM public.receitas_intermediarias ri
      JOIN public.insumos ins ON ins.id = ri.insumo_ingrediente_id
      WHERE ri.insumo_id = p_insumo_id
    LOOP
      v_perda_div := CASE WHEN rec_comp.perda >= 100 THEN 1 ELSE 1 - (rec_comp.perda/100.0) END;
      PERFORM public.baixar_insumo_recursivo(
        p_empresa_id,
        rec_comp.ing_id,
        (rec_comp.q * v_a_explodir / v_rend) / NULLIF(v_perda_div,0),
        p_venda_id,
        p_depth + 1
      );
    END LOOP;
  END IF;
END;
$$;

-- 7b) trigger principal (substitui o antigo)
CREATE OR REPLACE FUNCTION public.baixar_estoque_venda()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
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
