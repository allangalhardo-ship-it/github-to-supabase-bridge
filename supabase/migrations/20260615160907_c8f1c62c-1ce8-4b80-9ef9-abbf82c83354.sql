
-- 1) Tabela de alertas
CREATE TABLE IF NOT EXISTS public.alertas_custo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  custo_anterior NUMERIC NOT NULL DEFAULT 0,
  custo_novo NUMERIC NOT NULL DEFAULT 0,
  variacao_pct NUMERIC NOT NULL DEFAULT 0,
  custo_ficha_anterior NUMERIC NOT NULL DEFAULT 0,
  custo_ficha_novo NUMERIC NOT NULL DEFAULT 0,
  margem_antes NUMERIC,
  margem_depois NUMERIC,
  margem_meta NUMERIC,
  canal_pior TEXT,
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo | dispensado | resolvido
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alertas_custo_empresa ON public.alertas_custo(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_alertas_custo_produto ON public.alertas_custo(produto_id) WHERE status = 'ativo';
-- Apenas 1 alerta ATIVO por (insumo, produto)
CREATE UNIQUE INDEX IF NOT EXISTS uq_alertas_custo_ativo
  ON public.alertas_custo(insumo_id, produto_id)
  WHERE status = 'ativo';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas_custo TO authenticated;
GRANT ALL ON public.alertas_custo TO service_role;

ALTER TABLE public.alertas_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alertas_custo_select_empresa" ON public.alertas_custo
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "alertas_custo_update_empresa" ON public.alertas_custo
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "alertas_custo_delete_empresa" ON public.alertas_custo
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

-- Insert apenas pelo trigger (security definer); ainda assim deixamos service_role livre
CREATE POLICY "alertas_custo_insert_service" ON public.alertas_custo
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());

-- Trigger de updated_at
CREATE TRIGGER trg_alertas_custo_updated_at
BEFORE UPDATE ON public.alertas_custo
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Função utilitária: calcula margem mínima do produto entre todos os canais
-- Retorna (margem_min, canal_pior_nome). Usa imposto da configuração e taxas_canais.
CREATE OR REPLACE FUNCTION public.calcular_margem_minima_produto(
  p_produto_id UUID,
  p_custo_ficha NUMERIC,
  p_empresa_id UUID
)
RETURNS TABLE(margem_min NUMERIC, canal_pior TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imposto NUMERIC := 0;
  v_preco_base NUMERIC := 0;
BEGIN
  SELECT COALESCE(imposto_medio_sobre_vendas, 0) / 100.0
    INTO v_imposto
  FROM public.configuracoes
  WHERE empresa_id = p_empresa_id
  LIMIT 1;

  SELECT COALESCE(preco_venda, 0) INTO v_preco_base
  FROM public.produtos WHERE id = p_produto_id;

  RETURN QUERY
  WITH canais AS (
    SELECT
      cv.id AS canal_id,
      cv.nome AS canal_nome,
      COALESCE((
        SELECT SUM(percentual)::NUMERIC / 100.0
        FROM public.taxas_canais
        WHERE canal_id = cv.id
      ), 0) AS taxa,
      COALESCE(
        (SELECT preco FROM public.precos_canais
          WHERE produto_id = p_produto_id AND canal = cv.id::text
          LIMIT 1),
        v_preco_base
      ) AS preco
    FROM public.canais_venda cv
    WHERE cv.empresa_id = p_empresa_id AND cv.ativo = true
  ),
  calc AS (
    SELECT
      canal_nome,
      preco,
      CASE WHEN preco > 0
        THEN ((preco - p_custo_ficha - preco * v_imposto - preco * taxa) / preco) * 100.0
        ELSE -100
      END AS margem
    FROM canais
  )
  SELECT margem, canal_nome
  FROM calc
  WHERE preco > 0
  ORDER BY margem ASC
  LIMIT 1;
END;
$$;

-- 3) Trigger principal: detecta aumento de custo do insumo e cria alertas
CREATE OR REPLACE FUNCTION public.detectar_impacto_custo_insumo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variacao NUMERIC;
  v_margem_meta NUMERIC := 30;
  produto_rec RECORD;
  v_custo_ficha_novo NUMERIC;
  v_custo_ficha_anterior NUMERIC;
  v_margem_result RECORD;
  v_margem_antes_result RECORD;
BEGIN
  -- Só processa se houve mudança de custo pra cima
  IF NEW.custo_unitario IS NULL OR OLD.custo_unitario IS NULL OR OLD.custo_unitario = 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.custo_unitario <= OLD.custo_unitario THEN
    RETURN NEW;
  END IF;

  v_variacao := ((NEW.custo_unitario - OLD.custo_unitario) / OLD.custo_unitario) * 100.0;

  -- Gatilho 1: variação >= 10%
  IF v_variacao < 10 THEN
    RETURN NEW;
  END IF;

  -- Meta de margem da empresa
  SELECT COALESCE(margem_desejada_padrao, 30) INTO v_margem_meta
  FROM public.configuracoes
  WHERE empresa_id = NEW.empresa_id
  LIMIT 1;

  -- Para cada produto que usa esse insumo
  FOR produto_rec IN
    SELECT DISTINCT ft.produto_id
    FROM public.fichas_tecnicas ft
    JOIN public.produtos p ON p.id = ft.produto_id
    WHERE ft.insumo_id = NEW.id AND p.empresa_id = NEW.empresa_id
  LOOP
    -- Custo da ficha NOVO (com custo atualizado)
    SELECT COALESCE(SUM(ft.quantidade * i.custo_unitario), 0)
      INTO v_custo_ficha_novo
    FROM public.fichas_tecnicas ft
    JOIN public.insumos i ON i.id = ft.insumo_id
    WHERE ft.produto_id = produto_rec.produto_id;

    -- Custo ANTERIOR (substitui o custo do insumo alterado pelo OLD)
    SELECT COALESCE(SUM(
      ft.quantidade * CASE WHEN ft.insumo_id = NEW.id THEN OLD.custo_unitario ELSE i.custo_unitario END
    ), 0)
      INTO v_custo_ficha_anterior
    FROM public.fichas_tecnicas ft
    JOIN public.insumos i ON i.id = ft.insumo_id
    WHERE ft.produto_id = produto_rec.produto_id;

    -- Margem mínima depois
    SELECT margem_min, canal_pior
      INTO v_margem_result
    FROM public.calcular_margem_minima_produto(produto_rec.produto_id, v_custo_ficha_novo, NEW.empresa_id);

    -- Margem mínima antes
    SELECT margem_min, canal_pior
      INTO v_margem_antes_result
    FROM public.calcular_margem_minima_produto(produto_rec.produto_id, v_custo_ficha_anterior, NEW.empresa_id);

    -- Gatilho 2: margem ficou abaixo de 70% da meta
    IF v_margem_result.margem_min IS NOT NULL
       AND v_margem_result.margem_min < (v_margem_meta * 0.7) THEN

      INSERT INTO public.alertas_custo (
        empresa_id, insumo_id, produto_id,
        custo_anterior, custo_novo, variacao_pct,
        custo_ficha_anterior, custo_ficha_novo,
        margem_antes, margem_depois, margem_meta, canal_pior, status
      ) VALUES (
        NEW.empresa_id, NEW.id, produto_rec.produto_id,
        OLD.custo_unitario, NEW.custo_unitario, v_variacao,
        v_custo_ficha_anterior, v_custo_ficha_novo,
        v_margem_antes_result.margem_min, v_margem_result.margem_min,
        v_margem_meta, v_margem_result.canal_pior, 'ativo'
      )
      ON CONFLICT (insumo_id, produto_id) WHERE status = 'ativo'
      DO UPDATE SET
        custo_novo = EXCLUDED.custo_novo,
        custo_ficha_novo = EXCLUDED.custo_ficha_novo,
        variacao_pct = EXCLUDED.variacao_pct,
        margem_depois = EXCLUDED.margem_depois,
        canal_pior = EXCLUDED.canal_pior,
        margem_meta = EXCLUDED.margem_meta,
        updated_at = now();
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detectar_impacto_custo ON public.insumos;
CREATE TRIGGER trg_detectar_impacto_custo
AFTER UPDATE OF custo_unitario ON public.insumos
FOR EACH ROW
EXECUTE FUNCTION public.detectar_impacto_custo_insumo();

-- 4) Trigger de auto-resolução: quando o usuário reajusta preço, verifica se
-- a margem voltou à meta e marca alertas como resolvidos.
CREATE OR REPLACE FUNCTION public.resolver_alertas_custo_produto(p_produto_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_custo_ficha NUMERIC;
  v_margem_meta NUMERIC := 30;
  v_margem_result RECORD;
BEGIN
  SELECT empresa_id INTO v_empresa_id FROM public.produtos WHERE id = p_produto_id;
  IF v_empresa_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(margem_desejada_padrao, 30) INTO v_margem_meta
  FROM public.configuracoes WHERE empresa_id = v_empresa_id LIMIT 1;

  SELECT COALESCE(SUM(ft.quantidade * i.custo_unitario), 0)
    INTO v_custo_ficha
  FROM public.fichas_tecnicas ft
  JOIN public.insumos i ON i.id = ft.insumo_id
  WHERE ft.produto_id = p_produto_id;

  SELECT margem_min INTO v_margem_result
  FROM public.calcular_margem_minima_produto(p_produto_id, v_custo_ficha, v_empresa_id);

  IF v_margem_result.margem_min IS NOT NULL
     AND v_margem_result.margem_min >= v_margem_meta THEN
    UPDATE public.alertas_custo
    SET status = 'resolvido', resolved_at = now(), margem_depois = v_margem_result.margem_min
    WHERE produto_id = p_produto_id AND status = 'ativo';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_resolver_alertas_preco_canal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.resolver_alertas_custo_produto(NEW.produto_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolver_alertas_precos_canais ON public.precos_canais;
CREATE TRIGGER trg_resolver_alertas_precos_canais
AFTER INSERT OR UPDATE ON public.precos_canais
FOR EACH ROW EXECUTE FUNCTION public.trg_resolver_alertas_preco_canal();

CREATE OR REPLACE FUNCTION public.trg_resolver_alertas_produto_preco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.preco_venda IS DISTINCT FROM OLD.preco_venda THEN
    PERFORM public.resolver_alertas_custo_produto(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolver_alertas_produtos ON public.produtos;
CREATE TRIGGER trg_resolver_alertas_produtos
AFTER UPDATE OF preco_venda ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.trg_resolver_alertas_produto_preco();
