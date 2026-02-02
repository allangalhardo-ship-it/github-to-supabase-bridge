-- =====================================================
-- ÍNDICES DE PERFORMANCE PARA QUERIES FREQUENTES
-- =====================================================

-- Tabela: vendas (consultas por empresa, data, produto)
CREATE INDEX IF NOT EXISTS idx_vendas_empresa_data ON public.vendas(empresa_id, data_venda DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_produto ON public.vendas(produto_id) WHERE produto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendas_canal ON public.vendas(canal) WHERE canal IS NOT NULL;

-- Tabela: produtos (consultas por empresa, categoria, ativo)
CREATE INDEX IF NOT EXISTS idx_produtos_empresa_ativo ON public.produtos(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON public.produtos(categoria) WHERE categoria IS NOT NULL;

-- Tabela: insumos (consultas por empresa, estoque)
CREATE INDEX IF NOT EXISTS idx_insumos_empresa ON public.insumos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_insumos_estoque_baixo ON public.insumos(empresa_id, estoque_atual, estoque_minimo);

-- Tabela: fichas_tecnicas (consultas por produto e insumo)
CREATE INDEX IF NOT EXISTS idx_fichas_produto ON public.fichas_tecnicas(produto_id);
CREATE INDEX IF NOT EXISTS idx_fichas_insumo ON public.fichas_tecnicas(insumo_id);

-- Tabela: estoque_movimentos (consultas por empresa, insumo, data)
CREATE INDEX IF NOT EXISTS idx_estoque_mov_empresa_data ON public.estoque_movimentos(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_insumo ON public.estoque_movimentos(insumo_id);

-- Tabela: producoes (consultas por empresa, produto, data)
CREATE INDEX IF NOT EXISTS idx_producoes_empresa_data ON public.producoes(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_producoes_produto ON public.producoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_producoes_vencimento ON public.producoes(data_vencimento) WHERE data_vencimento IS NOT NULL;

-- Tabela: caixa_movimentos (consultas por empresa, data, tipo)
CREATE INDEX IF NOT EXISTS idx_caixa_empresa_data ON public.caixa_movimentos(empresa_id, data_movimento DESC);
CREATE INDEX IF NOT EXISTS idx_caixa_tipo ON public.caixa_movimentos(tipo);

-- Tabela: clientes (consultas por empresa)
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON public.clientes(empresa_id);

-- Tabela: custos_fixos (consultas por empresa)
CREATE INDEX IF NOT EXISTS idx_custos_fixos_empresa ON public.custos_fixos(empresa_id);

-- Tabela: pedidos (consultas por empresa, status, data)
CREATE INDEX IF NOT EXISTS idx_pedidos_empresa_status ON public.pedidos(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_pedidos_data_entrega ON public.pedidos(data_entrega) WHERE data_entrega IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON public.pedidos(cliente_id) WHERE cliente_id IS NOT NULL;

-- Tabela: precos_canais (consultas por produto e canal)
CREATE INDEX IF NOT EXISTS idx_precos_canais_produto ON public.precos_canais(produto_id);
CREATE INDEX IF NOT EXISTS idx_precos_canais_empresa_canal ON public.precos_canais(empresa_id, canal);

-- Tabela: canais_venda (consultas por empresa)
CREATE INDEX IF NOT EXISTS idx_canais_empresa_ativo ON public.canais_venda(empresa_id, ativo);

-- Tabela: historico_precos (consultas por insumo e data)
CREATE INDEX IF NOT EXISTS idx_historico_precos_insumo_data ON public.historico_precos(insumo_id, created_at DESC);

-- Tabela: historico_precos_produtos (consultas por produto e data)
CREATE INDEX IF NOT EXISTS idx_historico_precos_produtos_data ON public.historico_precos_produtos(produto_id, created_at DESC);

-- Tabela: receitas_intermediarias (consultas por insumo)
CREATE INDEX IF NOT EXISTS idx_receitas_insumo ON public.receitas_intermediarias(insumo_id);
CREATE INDEX IF NOT EXISTS idx_receitas_ingrediente ON public.receitas_intermediarias(insumo_ingrediente_id);

-- Tabela: user_sessions (consultas por user e atividade)
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON public.user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON public.user_sessions(last_activity_at DESC);

-- Tabela: access_logs (consultas por user e data)
CREATE INDEX IF NOT EXISTS idx_access_logs_user_date ON public.access_logs(user_id, created_at DESC);

-- Tabela: ai_usage (consultas por empresa e data)
CREATE INDEX IF NOT EXISTS idx_ai_usage_empresa_date ON public.ai_usage(empresa_id, date DESC);

-- =====================================================
-- COMENTÁRIO: Índices criados para otimizar:
-- 1. Filtros por empresa_id (RLS usa essa coluna)
-- 2. Ordenação por data (created_at, data_venda, etc.)
-- 3. Joins frequentes (produto_id, insumo_id)
-- 4. Filtros parciais (WHERE ativo = true, etc.)
-- =====================================================