-- =====================================================
-- TRIGGERS DO BANCO DE DADOS
-- Execute após 02-functions.sql
-- =====================================================

-- Trigger para atualizar estoque quando há movimento
CREATE TRIGGER tr_atualizar_estoque_insumo
    AFTER INSERT ON public.estoque_movimentos
    FOR EACH ROW
    EXECUTE FUNCTION public.atualizar_estoque_insumo();

-- Trigger para normalizar quantidade de movimento
CREATE TRIGGER tr_normalizar_quantidade_movimento
    BEFORE INSERT OR UPDATE ON public.estoque_movimentos
    FOR EACH ROW
    EXECUTE FUNCTION public.normalizar_quantidade_movimento();

-- Trigger para processar produção
CREATE TRIGGER tr_processar_producao
    AFTER INSERT ON public.producoes
    FOR EACH ROW
    EXECUTE FUNCTION public.processar_producao();

-- Trigger para baixar estoque na venda
CREATE TRIGGER tr_baixar_estoque_venda
    AFTER INSERT ON public.vendas
    FOR EACH ROW
    EXECUTE FUNCTION public.baixar_estoque_venda();

-- Trigger para reverter estoque na exclusão de venda
CREATE TRIGGER tr_reverter_estoque_venda
    BEFORE DELETE ON public.vendas
    FOR EACH ROW
    EXECUTE FUNCTION public.reverter_estoque_venda();

-- Triggers para updated_at
CREATE TRIGGER tr_update_configuracoes_updated_at
    BEFORE UPDATE ON public.configuracoes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_update_insumos_updated_at
    BEFORE UPDATE ON public.insumos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_update_produtos_updated_at
    BEFORE UPDATE ON public.produtos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_update_custos_fixos_updated_at
    BEFORE UPDATE ON public.custos_fixos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_update_clientes_updated_at
    BEFORE UPDATE ON public.clientes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_update_pedidos_updated_at
    BEFORE UPDATE ON public.pedidos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_update_canais_venda_updated_at
    BEFORE UPDATE ON public.canais_venda
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_update_precos_canais_updated_at
    BEFORE UPDATE ON public.precos_canais
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_update_unidades_compra_updated_at
    BEFORE UPDATE ON public.unidades_compra
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_update_onboarding_progress_updated_at
    BEFORE UPDATE ON public.onboarding_progress
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_update_ai_usage_updated_at
    BEFORE UPDATE ON public.ai_usage
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
