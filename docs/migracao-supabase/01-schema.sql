-- =====================================================
-- SCRIPT DE MIGRAÇÃO PARA SUPABASE PRO
-- Gerado em: 2026-02-02
-- Projeto: iFood Profit Buddy
-- =====================================================

-- IMPORTANTE: Execute este script no SQL Editor do Supabase
-- Na ordem: 01-schema.sql -> 02-functions.sql -> 03-triggers.sql -> 04-policies.sql

-- =====================================================
-- 1. ENUM TYPES
-- =====================================================
CREATE TYPE app_role AS ENUM ('admin', 'user');

-- =====================================================
-- 2. TABELAS PRINCIPAIS
-- =====================================================

-- Empresas (tabela base)
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    nome TEXT NOT NULL,
    segmento TEXT NULL
);

-- Usuários
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID NOT NULL PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_test_user BOOLEAN DEFAULT false,
    trial_end_override TIMESTAMP WITH TIME ZONE NULL,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT NULL,
    cpf_cnpj TEXT NULL,
    avatar_url TEXT NULL
);

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    role app_role NOT NULL DEFAULT 'user'::app_role
);

-- Configurações
CREATE TABLE IF NOT EXISTS public.configuracoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) UNIQUE,
    margem_desejada_padrao NUMERIC NOT NULL DEFAULT 30,
    cmv_alvo NUMERIC NOT NULL DEFAULT 35,
    imposto_medio_sobre_vendas NUMERIC NOT NULL DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    taxa_app_delivery NUMERIC NOT NULL DEFAULT 12,
    faturamento_mensal NUMERIC NOT NULL DEFAULT 0
);

-- Insumos
CREATE TABLE IF NOT EXISTS public.insumos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    custo_unitario NUMERIC NOT NULL DEFAULT 0,
    estoque_atual NUMERIC NOT NULL DEFAULT 0,
    estoque_minimo NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    is_intermediario BOOLEAN NOT NULL DEFAULT false,
    rendimento_receita NUMERIC NULL,
    nome TEXT NOT NULL,
    unidade_medida TEXT NOT NULL DEFAULT 'un'
);

-- Produtos
CREATE TABLE IF NOT EXISTS public.produtos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    preco_venda NUMERIC NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    rendimento_padrao INTEGER NULL,
    estoque_acabado NUMERIC NOT NULL DEFAULT 0,
    nome TEXT NOT NULL,
    categoria TEXT NULL,
    imagem_url TEXT NULL,
    observacoes_ficha TEXT NULL
);

-- Fichas Técnicas
CREATE TABLE IF NOT EXISTS public.fichas_tecnicas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id),
    quantidade NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Receitas Intermediárias
CREATE TABLE IF NOT EXISTS public.receitas_intermediarias (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id),
    insumo_ingrediente_id UUID NOT NULL REFERENCES public.insumos(id),
    quantidade NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Vendas
CREATE TABLE IF NOT EXISTS public.vendas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    produto_id UUID NULL REFERENCES public.produtos(id),
    quantidade NUMERIC NOT NULL DEFAULT 1,
    valor_total NUMERIC NOT NULL DEFAULT 0,
    data_venda DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    cliente_id UUID NULL,
    descricao_produto TEXT NULL,
    canal TEXT NULL DEFAULT 'balcao',
    origem TEXT NOT NULL DEFAULT 'manual',
    tipo_venda TEXT NOT NULL DEFAULT 'direto'
);

-- Produções
CREATE TABLE IF NOT EXISTS public.producoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    produto_id UUID NOT NULL REFERENCES public.produtos(id),
    quantidade NUMERIC NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    shelf_life_dias INTEGER NULL,
    dias_alerta_vencimento INTEGER NULL DEFAULT 3,
    data_vencimento DATE NULL,
    observacao TEXT NULL
);

-- Estoque Movimentos
CREATE TABLE IF NOT EXISTS public.estoque_movimentos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    insumo_id UUID NOT NULL REFERENCES public.insumos(id),
    quantidade NUMERIC NOT NULL,
    referencia UUID NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    quantidade_original NUMERIC NULL,
    fator_conversao NUMERIC NULL,
    custo_total NUMERIC NULL,
    tipo TEXT NOT NULL,
    origem TEXT NOT NULL DEFAULT 'manual',
    observacao TEXT NULL,
    unidade_compra TEXT NULL
);

-- Custos Fixos
CREATE TABLE IF NOT EXISTS public.custos_fixos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    valor_mensal NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    nome TEXT NOT NULL,
    categoria TEXT NULL
);

-- Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    data_nascimento DATE NULL,
    endereco_rua TEXT NULL,
    endereco_numero TEXT NULL,
    endereco_complemento TEXT NULL,
    endereco_bairro TEXT NULL,
    endereco_cidade TEXT NULL,
    endereco_estado TEXT NULL,
    endereco_cep TEXT NULL,
    observacoes TEXT NULL,
    preferencias TEXT NULL,
    nome TEXT NOT NULL,
    whatsapp TEXT NULL,
    email TEXT NULL
);

-- Adicionar FK de vendas para clientes (após criar clientes)
ALTER TABLE public.vendas ADD CONSTRAINT vendas_cliente_id_fkey 
    FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);

-- Pedidos
CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    cliente_id UUID NULL REFERENCES public.clientes(id),
    itens JSONB NOT NULL DEFAULT '[]'::jsonb,
    valor_total NUMERIC NOT NULL DEFAULT 0,
    data_entrega DATE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    origem TEXT NOT NULL DEFAULT 'link',
    status TEXT NOT NULL DEFAULT 'pendente',
    observacoes TEXT NULL,
    hora_entrega TEXT NULL,
    endereco_entrega TEXT NULL
);

-- Canais de Venda
CREATE TABLE IF NOT EXISTS public.canais_venda (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'app_delivery'
);

-- Taxas de Canais
CREATE TABLE IF NOT EXISTS public.taxas_canais (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    canal_id UUID NOT NULL REFERENCES public.canais_venda(id) ON DELETE CASCADE,
    percentual NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    nome TEXT NOT NULL
);

-- Preços por Canal
CREATE TABLE IF NOT EXISTS public.precos_canais (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    preco NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    canal TEXT NOT NULL
);

-- Unidades de Compra
CREATE TABLE IF NOT EXISTS public.unidades_compra (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    insumo_id UUID NOT NULL REFERENCES public.insumos(id),
    fator_conversao NUMERIC NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    nome TEXT NOT NULL
);

-- Histórico de Preços (Insumos)
CREATE TABLE IF NOT EXISTS public.historico_precos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    insumo_id UUID NOT NULL REFERENCES public.insumos(id),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    preco_anterior NUMERIC NULL,
    preco_novo NUMERIC NOT NULL,
    variacao_percentual NUMERIC NULL,
    observacao TEXT NULL,
    origem TEXT NOT NULL DEFAULT 'manual'
);

-- Histórico de Preços (Produtos)
CREATE TABLE IF NOT EXISTS public.historico_precos_produtos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    produto_id UUID NOT NULL REFERENCES public.produtos(id),
    preco_anterior NUMERIC NULL,
    preco_novo NUMERIC NOT NULL,
    variacao_percentual NUMERIC NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    origem TEXT NOT NULL DEFAULT 'manual',
    observacao TEXT NULL
);

-- Caixa Movimentos
CREATE TABLE IF NOT EXISTS public.caixa_movimentos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    valor NUMERIC NOT NULL DEFAULT 0,
    data_movimento DATE NOT NULL DEFAULT CURRENT_DATE,
    referencia UUID NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    tipo TEXT NOT NULL,
    categoria TEXT NOT NULL,
    descricao TEXT NOT NULL,
    origem TEXT NOT NULL DEFAULT 'manual'
);

-- XML Notas
CREATE TABLE IF NOT EXISTS public.xml_notas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    data_emissao DATE NULL,
    valor_total NUMERIC NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    numero TEXT NULL,
    fornecedor TEXT NULL,
    arquivo_xml TEXT NULL
);

-- XML Itens
CREATE TABLE IF NOT EXISTS public.xml_itens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    xml_id UUID NOT NULL REFERENCES public.xml_notas(id) ON DELETE CASCADE,
    quantidade NUMERIC NULL,
    valor_total NUMERIC NULL,
    custo_unitario NUMERIC NULL,
    insumo_id UUID NULL REFERENCES public.insumos(id),
    mapeado BOOLEAN NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    produto_descricao TEXT NULL,
    ean TEXT NULL,
    unidade TEXT NULL
);

-- Produto Mapeamento
CREATE TABLE IF NOT EXISTS public.produto_mapeamento (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    insumo_id UUID NOT NULL REFERENCES public.insumos(id),
    unidade_conversao NUMERIC NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    fornecedor_cnpj TEXT NULL,
    codigo_produto_nota TEXT NULL,
    ean_gtin TEXT NULL,
    descricao_nota TEXT NULL
);

-- Import Templates
CREATE TABLE IF NOT EXISTS public.import_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    mapeamento JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    nome TEXT NOT NULL,
    plataforma TEXT NOT NULL
);

-- User Sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ended_at TIMESTAMP WITH TIME ZONE NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    pages_visited INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    session_id TEXT NULL,
    ip_address TEXT NULL,
    user_agent TEXT NULL,
    device_type TEXT NULL,
    browser TEXT NULL,
    os TEXT NULL,
    country TEXT NULL,
    city TEXT NULL
);

-- Access Logs
CREATE TABLE IF NOT EXISTS public.access_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    session_id UUID NULL REFERENCES public.user_sessions(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    page_path TEXT NULL,
    ip_address TEXT NULL,
    action TEXT NOT NULL DEFAULT 'page_view'
);

-- Onboarding Progress
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    current_step INTEGER NOT NULL DEFAULT 1,
    completed BOOLEAN NOT NULL DEFAULT false,
    first_insumo_id UUID NULL,
    first_produto_id UUID NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Usage
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Coach Histórico
CREATE TABLE IF NOT EXISTS public.coach_historico (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    prioridade INTEGER NOT NULL DEFAULT 0,
    dados_contexto JSONB NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    tipo TEXT NOT NULL,
    status TEXT NOT NULL,
    headline TEXT NOT NULL,
    detail TEXT NOT NULL
);

-- =====================================================
-- 3. HABILITAR RLS EM TODAS AS TABELAS
-- =====================================================
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fichas_tecnicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas_intermediarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_fixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canais_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxas_canais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precos_canais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_precos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_precos_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixa_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xml_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xml_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_mapeamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_historico ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_insumos_empresa ON public.insumos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON public.produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_empresa ON public.vendas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON public.vendas(data_venda);
CREATE INDEX IF NOT EXISTS idx_estoque_movimentos_insumo ON public.estoque_movimentos(insumo_id);
CREATE INDEX IF NOT EXISTS idx_fichas_tecnicas_produto ON public.fichas_tecnicas(produto_id);

COMMENT ON TABLE public.empresas IS 'Tabela principal de empresas/negócios';
COMMENT ON TABLE public.usuarios IS 'Usuários do sistema vinculados a empresas';
COMMENT ON TABLE public.insumos IS 'Insumos/ingredientes usados na produção';
COMMENT ON TABLE public.produtos IS 'Produtos finais vendidos';
