
-- ============================================
-- PLANO DE ESCALABILIDADE: 1000+ USUÁRIOS
-- ============================================

-- 1. ÍNDICES CRÍTICOS PARA PERFORMANCE

-- Índice composto para vendas (query mais pesada do Dashboard)
CREATE INDEX IF NOT EXISTS idx_vendas_empresa_data ON public.vendas (empresa_id, data_venda DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_produto_data ON public.vendas (produto_id, data_venda DESC) WHERE produto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendas_canal ON public.vendas (canal) WHERE canal IS NOT NULL;

-- Índice para produtos por empresa
CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON public.produtos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON public.produtos (empresa_id, ativo) WHERE ativo = true;

-- Índice para custos fixos
CREATE INDEX IF NOT EXISTS idx_custos_fixos_empresa ON public.custos_fixos (empresa_id);

-- Índice para clientes
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON public.clientes (empresa_id);

-- Índice para usuarios (login rápido)
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios (email);

-- Índice para producoes
CREATE INDEX IF NOT EXISTS idx_producoes_empresa_data ON public.producoes (empresa_id, created_at DESC);

-- Índice para taxas_apps
CREATE INDEX IF NOT EXISTS idx_taxas_apps_empresa_ativo ON public.taxas_apps (empresa_id, ativo) WHERE ativo = true;

-- Índice para fichas_tecnicas (join pesado)
CREATE INDEX IF NOT EXISTS idx_fichas_tecnicas_insumo ON public.fichas_tecnicas (insumo_id);

-- Índice para user_sessions (analytics)
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON public.user_sessions (user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_started ON public.user_sessions (started_at DESC);

-- 2. OTIMIZAÇÃO DE CONSULTAS FREQUENTES

-- Função otimizada para buscar vendas do dashboard
CREATE OR REPLACE FUNCTION public.get_dashboard_vendas(
  p_empresa_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS TABLE (
  id UUID,
  data_venda DATE,
  valor_total NUMERIC,
  quantidade NUMERIC,
  canal TEXT,
  produto_id UUID,
  produto_nome TEXT,
  produto_preco_venda NUMERIC,
  custo_insumos NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    v.id,
    v.data_venda::date,
    v.valor_total,
    v.quantidade,
    v.canal,
    v.produto_id,
    p.nome AS produto_nome,
    p.preco_venda AS produto_preco_venda,
    COALESCE(
      (SELECT SUM(ft.quantidade * i.custo_unitario)
       FROM fichas_tecnicas ft
       JOIN insumos i ON i.id = ft.insumo_id
       WHERE ft.produto_id = p.id), 
      0
    ) AS custo_insumos
  FROM vendas v
  LEFT JOIN produtos p ON p.id = v.produto_id
  WHERE v.empresa_id = p_empresa_id
    AND v.data_venda >= p_data_inicio
    AND v.data_venda <= p_data_fim
  ORDER BY v.data_venda DESC;
$$;

-- Função para top produtos com lucro
CREATE OR REPLACE FUNCTION public.get_top_produtos(
  p_empresa_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  produto_id UUID,
  nome TEXT,
  receita NUMERIC,
  custo NUMERIC,
  lucro NUMERIC,
  quantidade NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH vendas_periodo AS (
    SELECT 
      v.produto_id,
      p.nome,
      p.preco_venda,
      SUM(v.valor_total) AS receita,
      CASE 
        WHEN p.preco_venda > 0 THEN SUM(v.valor_total / p.preco_venda)
        ELSE SUM(v.quantidade)
      END AS unidades
    FROM vendas v
    JOIN produtos p ON p.id = v.produto_id
    WHERE v.empresa_id = p_empresa_id
      AND v.data_venda >= p_data_inicio
      AND v.data_venda <= p_data_fim
      AND v.produto_id IS NOT NULL
    GROUP BY v.produto_id, p.nome, p.preco_venda
  ),
  custos AS (
    SELECT 
      ft.produto_id,
      SUM(ft.quantidade * i.custo_unitario) AS custo_unitario
    FROM fichas_tecnicas ft
    JOIN insumos i ON i.id = ft.insumo_id
    GROUP BY ft.produto_id
  )
  SELECT 
    vp.produto_id,
    vp.nome,
    vp.receita,
    COALESCE(c.custo_unitario * vp.unidades, 0) AS custo,
    vp.receita - COALESCE(c.custo_unitario * vp.unidades, 0) AS lucro,
    vp.unidades AS quantidade
  FROM vendas_periodo vp
  LEFT JOIN custos c ON c.produto_id = vp.produto_id
  ORDER BY lucro DESC
  LIMIT p_limit;
$$;

-- Função para insumos com estoque baixo
CREATE OR REPLACE FUNCTION public.get_insumos_estoque_baixo(p_empresa_id UUID)
RETURNS TABLE (
  id UUID,
  nome TEXT,
  unidade_medida TEXT,
  estoque_atual NUMERIC,
  estoque_minimo NUMERIC,
  custo_unitario NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    nome,
    unidade_medida,
    estoque_atual,
    estoque_minimo,
    custo_unitario
  FROM insumos
  WHERE empresa_id = p_empresa_id
    AND estoque_atual <= estoque_minimo
  ORDER BY (estoque_minimo - estoque_atual) DESC;
$$;

-- 3. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_dashboard_vendas TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_produtos TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_insumos_estoque_baixo TO authenticated;
