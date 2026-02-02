-- =====================================================
-- POLÍTICAS RLS (Row Level Security)
-- Execute após 03-triggers.sql
-- =====================================================

-- =====================================================
-- EMPRESAS
-- =====================================================
CREATE POLICY "Users can view their own empresa" ON public.empresas
    FOR SELECT USING (id = get_user_empresa_id());

CREATE POLICY "Users can update own empresa" ON public.empresas
    FOR UPDATE USING (id = get_user_empresa_id());

CREATE POLICY "Admins can view all empresas" ON public.empresas
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete empresas" ON public.empresas
    FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage empresas" ON public.empresas
    FOR ALL USING (true);

-- =====================================================
-- USUÁRIOS
-- =====================================================
CREATE POLICY "Users can view only their own profile" ON public.usuarios
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update only their own profile" ON public.usuarios
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.usuarios
    FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can delete own profile" ON public.usuarios
    FOR DELETE USING (id = auth.uid());

CREATE POLICY "Admins can view all usuarios" ON public.usuarios
    FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- USER ROLES
-- =====================================================
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own role" ON public.user_roles
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update user roles" ON public.user_roles
    FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles" ON public.user_roles
    FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- =====================================================
-- TABELAS COM EMPRESA_ID (padrão)
-- =====================================================

-- Macro para criar políticas padrão por empresa
-- Configurações
CREATE POLICY "Users can view empresa configuracoes" ON public.configuracoes
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa configuracoes" ON public.configuracoes
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa configuracoes" ON public.configuracoes
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa configuracoes" ON public.configuracoes
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Insumos
CREATE POLICY "Users can view empresa insumos" ON public.insumos
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa insumos" ON public.insumos
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa insumos" ON public.insumos
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa insumos" ON public.insumos
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Produtos
CREATE POLICY "Users can view empresa produtos" ON public.produtos
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa produtos" ON public.produtos
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa produtos" ON public.produtos
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa produtos" ON public.produtos
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Fichas Técnicas (via produto)
CREATE POLICY "Users can view fichas_tecnicas" ON public.fichas_tecnicas
    FOR SELECT USING (EXISTS (SELECT 1 FROM produtos p WHERE p.id = fichas_tecnicas.produto_id AND p.empresa_id = get_user_empresa_id()));
CREATE POLICY "Users can insert fichas_tecnicas" ON public.fichas_tecnicas
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM produtos p WHERE p.id = fichas_tecnicas.produto_id AND p.empresa_id = get_user_empresa_id()));
CREATE POLICY "Users can update fichas_tecnicas" ON public.fichas_tecnicas
    FOR UPDATE USING (EXISTS (SELECT 1 FROM produtos p WHERE p.id = fichas_tecnicas.produto_id AND p.empresa_id = get_user_empresa_id()));
CREATE POLICY "Users can delete fichas_tecnicas" ON public.fichas_tecnicas
    FOR DELETE USING (EXISTS (SELECT 1 FROM produtos p WHERE p.id = fichas_tecnicas.produto_id AND p.empresa_id = get_user_empresa_id()));

-- Receitas Intermediárias (via insumo)
CREATE POLICY "Users can view receitas_intermediarias" ON public.receitas_intermediarias
    FOR SELECT USING (EXISTS (SELECT 1 FROM insumos i WHERE i.id = receitas_intermediarias.insumo_id AND i.empresa_id = get_user_empresa_id()));
CREATE POLICY "Users can insert receitas_intermediarias" ON public.receitas_intermediarias
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM insumos i WHERE i.id = receitas_intermediarias.insumo_id AND i.empresa_id = get_user_empresa_id()));
CREATE POLICY "Users can update receitas_intermediarias" ON public.receitas_intermediarias
    FOR UPDATE USING (EXISTS (SELECT 1 FROM insumos i WHERE i.id = receitas_intermediarias.insumo_id AND i.empresa_id = get_user_empresa_id()));
CREATE POLICY "Users can delete receitas_intermediarias" ON public.receitas_intermediarias
    FOR DELETE USING (EXISTS (SELECT 1 FROM insumos i WHERE i.id = receitas_intermediarias.insumo_id AND i.empresa_id = get_user_empresa_id()));

-- Vendas
CREATE POLICY "Users can view empresa vendas" ON public.vendas
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa vendas" ON public.vendas
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa vendas" ON public.vendas
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa vendas" ON public.vendas
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Produções
CREATE POLICY "Users can view empresa producoes" ON public.producoes
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa producoes" ON public.producoes
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa producoes" ON public.producoes
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa producoes" ON public.producoes
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Estoque Movimentos
CREATE POLICY "Users can view empresa estoque_movimentos" ON public.estoque_movimentos
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa estoque_movimentos" ON public.estoque_movimentos
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa estoque_movimentos" ON public.estoque_movimentos
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa estoque_movimentos" ON public.estoque_movimentos
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Custos Fixos
CREATE POLICY "Users can view empresa custos_fixos" ON public.custos_fixos
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa custos_fixos" ON public.custos_fixos
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa custos_fixos" ON public.custos_fixos
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa custos_fixos" ON public.custos_fixos
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Clientes
CREATE POLICY "Authenticated users can view their empresa clientes" ON public.clientes
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Authenticated users can insert their empresa clientes" ON public.clientes
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Authenticated users can update their empresa clientes" ON public.clientes
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Authenticated users can delete their empresa clientes" ON public.clientes
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Pedidos
CREATE POLICY "Users can view empresa pedidos" ON public.pedidos
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa pedidos" ON public.pedidos
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa pedidos" ON public.pedidos
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa pedidos" ON public.pedidos
    FOR DELETE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Public can insert pedidos via link" ON public.pedidos
    FOR INSERT WITH CHECK (origem = 'link');

-- Canais de Venda
CREATE POLICY "Users can view empresa canais_venda" ON public.canais_venda
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa canais_venda" ON public.canais_venda
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa canais_venda" ON public.canais_venda
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa canais_venda" ON public.canais_venda
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Taxas de Canais (via canal)
CREATE POLICY "Users can view taxas_canais" ON public.taxas_canais
    FOR SELECT USING (EXISTS (SELECT 1 FROM canais_venda cv WHERE cv.id = taxas_canais.canal_id AND cv.empresa_id = get_user_empresa_id()));
CREATE POLICY "Users can insert taxas_canais" ON public.taxas_canais
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM canais_venda cv WHERE cv.id = taxas_canais.canal_id AND cv.empresa_id = get_user_empresa_id()));
CREATE POLICY "Users can update taxas_canais" ON public.taxas_canais
    FOR UPDATE USING (EXISTS (SELECT 1 FROM canais_venda cv WHERE cv.id = taxas_canais.canal_id AND cv.empresa_id = get_user_empresa_id()));
CREATE POLICY "Users can delete taxas_canais" ON public.taxas_canais
    FOR DELETE USING (EXISTS (SELECT 1 FROM canais_venda cv WHERE cv.id = taxas_canais.canal_id AND cv.empresa_id = get_user_empresa_id()));

-- Preços por Canal
CREATE POLICY "Users can view empresa precos_canais" ON public.precos_canais
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa precos_canais" ON public.precos_canais
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa precos_canais" ON public.precos_canais
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa precos_canais" ON public.precos_canais
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Unidades de Compra
CREATE POLICY "Users can view empresa unidades_compra" ON public.unidades_compra
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa unidades_compra" ON public.unidades_compra
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa unidades_compra" ON public.unidades_compra
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa unidades_compra" ON public.unidades_compra
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Histórico de Preços (Insumos)
CREATE POLICY "Users can view empresa historico_precos" ON public.historico_precos
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa historico_precos" ON public.historico_precos
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa historico_precos" ON public.historico_precos
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Histórico de Preços (Produtos)
CREATE POLICY "Users can view empresa historico_precos_produtos" ON public.historico_precos_produtos
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa historico_precos_produtos" ON public.historico_precos_produtos
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa historico_precos_produtos" ON public.historico_precos_produtos
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Caixa Movimentos
CREATE POLICY "Authenticated users can view their empresa caixa" ON public.caixa_movimentos
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Authenticated users can insert their empresa caixa" ON public.caixa_movimentos
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Authenticated users can update their empresa caixa" ON public.caixa_movimentos
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Authenticated users can delete their empresa caixa" ON public.caixa_movimentos
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- XML Notas
CREATE POLICY "Users can view empresa xml_notas" ON public.xml_notas
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa xml_notas" ON public.xml_notas
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa xml_notas" ON public.xml_notas
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa xml_notas" ON public.xml_notas
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- XML Itens (via xml_notas)
CREATE POLICY "Users can view xml_itens" ON public.xml_itens
    FOR SELECT USING (EXISTS (SELECT 1 FROM xml_notas n WHERE n.id = xml_itens.xml_id AND n.empresa_id = get_user_empresa_id()));
CREATE POLICY "Users can insert xml_itens" ON public.xml_itens
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM xml_notas n WHERE n.id = xml_itens.xml_id AND n.empresa_id = get_user_empresa_id()));
CREATE POLICY "Users can update xml_itens" ON public.xml_itens
    FOR UPDATE USING (EXISTS (SELECT 1 FROM xml_notas n WHERE n.id = xml_itens.xml_id AND n.empresa_id = get_user_empresa_id()));
CREATE POLICY "Users can delete xml_itens" ON public.xml_itens
    FOR DELETE USING (EXISTS (SELECT 1 FROM xml_notas n WHERE n.id = xml_itens.xml_id AND n.empresa_id = get_user_empresa_id()));

-- Produto Mapeamento
CREATE POLICY "Users can view empresa produto_mapeamento" ON public.produto_mapeamento
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa produto_mapeamento" ON public.produto_mapeamento
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa produto_mapeamento" ON public.produto_mapeamento
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa produto_mapeamento" ON public.produto_mapeamento
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- Import Templates
CREATE POLICY "Users can view empresa import_templates" ON public.import_templates
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa import_templates" ON public.import_templates
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can update empresa import_templates" ON public.import_templates
    FOR UPDATE USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa import_templates" ON public.import_templates
    FOR DELETE USING (empresa_id = get_user_empresa_id());

-- =====================================================
-- TABELAS ESPECIAIS (admin/service)
-- =====================================================

-- User Sessions
CREATE POLICY "Admins can view all sessions" ON public.user_sessions
    FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role only user_sessions" ON public.user_sessions
    FOR ALL USING (true);

-- Access Logs
CREATE POLICY "Admins can read access_logs" ON public.access_logs
    FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service role manages access_logs" ON public.access_logs
    FOR ALL USING (true);

-- Onboarding Progress
CREATE POLICY "Users can view own onboarding" ON public.onboarding_progress
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own onboarding" ON public.onboarding_progress
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own onboarding" ON public.onboarding_progress
    FOR UPDATE USING (user_id = auth.uid());

-- AI Usage
CREATE POLICY "Users can view their own AI usage" ON public.ai_usage
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own AI usage" ON public.ai_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own AI usage" ON public.ai_usage
    FOR UPDATE USING (auth.uid() = user_id);

-- Coach Histórico
CREATE POLICY "Users can view empresa coach_historico" ON public.coach_historico
    FOR SELECT USING (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can insert empresa coach_historico" ON public.coach_historico
    FOR INSERT WITH CHECK (empresa_id = get_user_empresa_id());
CREATE POLICY "Users can delete empresa coach_historico" ON public.coach_historico
    FOR DELETE USING (empresa_id = get_user_empresa_id());
