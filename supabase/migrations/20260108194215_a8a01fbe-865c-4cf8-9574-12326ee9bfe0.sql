-- =============================================
-- GastroGestor - Schema Completo
-- =============================================

-- 1. Tabela de Empresas
CREATE TABLE public.empresas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Tabela de Perfis de Usuários (vinculado a auth.users)
CREATE TABLE public.usuarios (
    id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Tabela de Roles (para segurança)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'user',
    UNIQUE (user_id, role)
);

-- 4. Tabela de Insumos
CREATE TABLE public.insumos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    unidade_medida TEXT NOT NULL DEFAULT 'un',
    custo_unitario DECIMAL(12,4) NOT NULL DEFAULT 0,
    estoque_atual DECIMAL(12,4) NOT NULL DEFAULT 0,
    estoque_minimo DECIMAL(12,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Tabela de Produtos
CREATE TABLE public.produtos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    categoria TEXT,
    preco_venda DECIMAL(12,2) NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Tabela de Fichas Técnicas (relação produto-insumo)
CREATE TABLE public.fichas_tecnicas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
    quantidade DECIMAL(12,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Tabela de Movimentos de Estoque
CREATE TABLE public.estoque_movimentos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    quantidade DECIMAL(12,4) NOT NULL,
    origem TEXT NOT NULL DEFAULT 'manual',
    referencia UUID,
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Tabela de Vendas
CREATE TABLE public.vendas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
    descricao_produto TEXT,
    quantidade DECIMAL(12,4) NOT NULL DEFAULT 1,
    valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
    canal TEXT DEFAULT 'balcao',
    data_venda DATE NOT NULL DEFAULT CURRENT_DATE,
    origem TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. Tabela de Custos Fixos
CREATE TABLE public.custos_fixos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    valor_mensal DECIMAL(12,2) NOT NULL DEFAULT 0,
    categoria TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. Tabela de Configurações
CREATE TABLE public.configuracoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL UNIQUE REFERENCES public.empresas(id) ON DELETE CASCADE,
    margem_desejada_padrao DECIMAL(5,2) NOT NULL DEFAULT 30,
    cmv_alvo DECIMAL(5,2) NOT NULL DEFAULT 35,
    imposto_medio_sobre_vendas DECIMAL(5,2) NOT NULL DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 11. Tabela de Notas XML
CREATE TABLE public.xml_notas (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    numero TEXT,
    fornecedor TEXT,
    data_emissao DATE,
    valor_total DECIMAL(12,2),
    arquivo_xml TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 12. Tabela de Itens XML
CREATE TABLE public.xml_itens (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    xml_id UUID NOT NULL REFERENCES public.xml_notas(id) ON DELETE CASCADE,
    produto_descricao TEXT,
    ean TEXT,
    quantidade DECIMAL(12,4),
    unidade TEXT,
    valor_total DECIMAL(12,2),
    custo_unitario DECIMAL(12,4),
    insumo_id UUID REFERENCES public.insumos(id) ON DELETE SET NULL,
    mapeado BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 13. Tabela de Mapeamento de Produtos (DE-PARA)
CREATE TABLE public.produto_mapeamento (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    fornecedor_cnpj TEXT,
    codigo_produto_nota TEXT,
    ean_gtin TEXT,
    descricao_nota TEXT,
    insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
    unidade_conversao DECIMAL(12,4) DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(empresa_id, fornecedor_cnpj, codigo_produto_nota)
);

-- 14. Tabela de Templates de Importação CSV
CREATE TABLE public.import_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    plataforma TEXT NOT NULL,
    mapeamento JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- Habilitar RLS em todas as tabelas
-- =============================================
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fichas_tecnicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_fixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xml_notas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xml_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_mapeamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_templates ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Funções auxiliares para RLS
-- =============================================

-- Função para obter empresa_id do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
$$;

-- Função para verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =============================================
-- Políticas RLS
-- =============================================

-- Empresas: usuários só veem sua própria empresa
CREATE POLICY "Users can view own empresa"
ON public.empresas FOR SELECT
TO authenticated
USING (id = public.get_user_empresa_id());

CREATE POLICY "Users can insert empresa during signup"
ON public.empresas FOR INSERT
TO authenticated
WITH CHECK (true);

-- Usuarios: usuários veem colegas da mesma empresa
CREATE POLICY "Users can view own profile"
ON public.usuarios FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id() OR id = auth.uid());

CREATE POLICY "Users can insert own profile"
ON public.usuarios FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.usuarios FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- User Roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own role"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Insumos: filtrado por empresa
CREATE POLICY "Users can view empresa insumos"
ON public.insumos FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can insert empresa insumos"
ON public.insumos FOR INSERT
TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can update empresa insumos"
ON public.insumos FOR UPDATE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can delete empresa insumos"
ON public.insumos FOR DELETE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

-- Produtos: filtrado por empresa
CREATE POLICY "Users can view empresa produtos"
ON public.produtos FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can insert empresa produtos"
ON public.produtos FOR INSERT
TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can update empresa produtos"
ON public.produtos FOR UPDATE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can delete empresa produtos"
ON public.produtos FOR DELETE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

-- Fichas Técnicas: via produto
CREATE POLICY "Users can view fichas_tecnicas"
ON public.fichas_tecnicas FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.id = produto_id AND p.empresa_id = public.get_user_empresa_id()
  )
);

CREATE POLICY "Users can insert fichas_tecnicas"
ON public.fichas_tecnicas FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.id = produto_id AND p.empresa_id = public.get_user_empresa_id()
  )
);

CREATE POLICY "Users can update fichas_tecnicas"
ON public.fichas_tecnicas FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.id = produto_id AND p.empresa_id = public.get_user_empresa_id()
  )
);

CREATE POLICY "Users can delete fichas_tecnicas"
ON public.fichas_tecnicas FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.id = produto_id AND p.empresa_id = public.get_user_empresa_id()
  )
);

-- Estoque Movimentos: filtrado por empresa
CREATE POLICY "Users can view empresa estoque_movimentos"
ON public.estoque_movimentos FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can insert empresa estoque_movimentos"
ON public.estoque_movimentos FOR INSERT
TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id());

-- Vendas: filtrado por empresa
CREATE POLICY "Users can view empresa vendas"
ON public.vendas FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can insert empresa vendas"
ON public.vendas FOR INSERT
TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can update empresa vendas"
ON public.vendas FOR UPDATE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can delete empresa vendas"
ON public.vendas FOR DELETE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

-- Custos Fixos: filtrado por empresa
CREATE POLICY "Users can view empresa custos_fixos"
ON public.custos_fixos FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can insert empresa custos_fixos"
ON public.custos_fixos FOR INSERT
TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can update empresa custos_fixos"
ON public.custos_fixos FOR UPDATE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can delete empresa custos_fixos"
ON public.custos_fixos FOR DELETE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

-- Configurações: filtrado por empresa
CREATE POLICY "Users can view empresa configuracoes"
ON public.configuracoes FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can insert empresa configuracoes"
ON public.configuracoes FOR INSERT
TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can update empresa configuracoes"
ON public.configuracoes FOR UPDATE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

-- XML Notas: filtrado por empresa
CREATE POLICY "Users can view empresa xml_notas"
ON public.xml_notas FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can insert empresa xml_notas"
ON public.xml_notas FOR INSERT
TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can delete empresa xml_notas"
ON public.xml_notas FOR DELETE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

-- XML Itens: via xml_nota
CREATE POLICY "Users can view xml_itens"
ON public.xml_itens FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.xml_notas n
    WHERE n.id = xml_id AND n.empresa_id = public.get_user_empresa_id()
  )
);

CREATE POLICY "Users can insert xml_itens"
ON public.xml_itens FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.xml_notas n
    WHERE n.id = xml_id AND n.empresa_id = public.get_user_empresa_id()
  )
);

CREATE POLICY "Users can update xml_itens"
ON public.xml_itens FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.xml_notas n
    WHERE n.id = xml_id AND n.empresa_id = public.get_user_empresa_id()
  )
);

-- Produto Mapeamento: filtrado por empresa
CREATE POLICY "Users can view empresa produto_mapeamento"
ON public.produto_mapeamento FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can insert empresa produto_mapeamento"
ON public.produto_mapeamento FOR INSERT
TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can update empresa produto_mapeamento"
ON public.produto_mapeamento FOR UPDATE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can delete empresa produto_mapeamento"
ON public.produto_mapeamento FOR DELETE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

-- Import Templates: filtrado por empresa
CREATE POLICY "Users can view empresa import_templates"
ON public.import_templates FOR SELECT
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can insert empresa import_templates"
ON public.import_templates FOR INSERT
TO authenticated
WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can update empresa import_templates"
ON public.import_templates FOR UPDATE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "Users can delete empresa import_templates"
ON public.import_templates FOR DELETE
TO authenticated
USING (empresa_id = public.get_user_empresa_id());

-- =============================================
-- Triggers para atualizar timestamps
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_insumos_updated_at
BEFORE UPDATE ON public.insumos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_produtos_updated_at
BEFORE UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_custos_fixos_updated_at
BEFORE UPDATE ON public.custos_fixos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_configuracoes_updated_at
BEFORE UPDATE ON public.configuracoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Trigger para atualizar estoque ao inserir movimento
-- =============================================

CREATE OR REPLACE FUNCTION public.atualizar_estoque_insumo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo = 'entrada' THEN
        UPDATE public.insumos
        SET estoque_atual = estoque_atual + NEW.quantidade
        WHERE id = NEW.insumo_id;
    ELSIF NEW.tipo = 'saida' THEN
        UPDATE public.insumos
        SET estoque_atual = estoque_atual - NEW.quantidade
        WHERE id = NEW.insumo_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_atualizar_estoque
AFTER INSERT ON public.estoque_movimentos
FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_insumo();

-- =============================================
-- Índices para performance
-- =============================================

CREATE INDEX idx_insumos_empresa ON public.insumos(empresa_id);
CREATE INDEX idx_produtos_empresa ON public.produtos(empresa_id);
CREATE INDEX idx_vendas_empresa_data ON public.vendas(empresa_id, data_venda);
CREATE INDEX idx_estoque_movimentos_empresa ON public.estoque_movimentos(empresa_id);
CREATE INDEX idx_fichas_tecnicas_produto ON public.fichas_tecnicas(produto_id);
CREATE INDEX idx_xml_itens_xml ON public.xml_itens(xml_id);
CREATE INDEX idx_produto_mapeamento_ean ON public.produto_mapeamento(ean_gtin);
CREATE INDEX idx_produto_mapeamento_fornecedor ON public.produto_mapeamento(empresa_id, fornecedor_cnpj);