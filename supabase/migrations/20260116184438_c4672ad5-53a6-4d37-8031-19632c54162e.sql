-- Função para reverter estoque quando uma venda é excluída
CREATE OR REPLACE FUNCTION public.reverter_estoque_venda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    movimento RECORD;
    produto_info RECORD;
BEGIN
    -- Se a venda tinha um produto vinculado
    IF OLD.produto_id IS NOT NULL THEN
        -- Buscar os movimentos de estoque que foram criados por esta venda
        FOR movimento IN 
            SELECT * FROM estoque_movimentos 
            WHERE referencia = OLD.id AND origem = 'venda'
        LOOP
            -- Criar movimento de entrada para reverter a saída
            INSERT INTO estoque_movimentos (
                empresa_id,
                insumo_id,
                tipo,
                quantidade,
                origem,
                observacao,
                referencia
            ) VALUES (
                movimento.empresa_id,
                movimento.insumo_id,
                'entrada',
                movimento.quantidade,
                'estorno_venda',
                'Estorno automático - Venda excluída',
                OLD.id
            );
        END LOOP;
        
        -- Verificar se houve baixa do estoque acabado (quando não há movimentos de insumos)
        -- Isso acontece quando a venda usou estoque de produto acabado
        SELECT INTO produto_info estoque_acabado FROM produtos WHERE id = OLD.produto_id;
        
        -- Se não houve movimentos de insumos para esta venda, significa que usou estoque acabado
        IF NOT EXISTS (SELECT 1 FROM estoque_movimentos WHERE referencia = OLD.id AND origem = 'venda') THEN
            -- Volta o estoque acabado
            UPDATE produtos
            SET estoque_acabado = estoque_acabado + OLD.quantidade
            WHERE id = OLD.produto_id;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$function$;

-- Criar o trigger para reverter estoque ao excluir venda
DROP TRIGGER IF EXISTS trigger_reverter_estoque_venda ON vendas;
CREATE TRIGGER trigger_reverter_estoque_venda
    BEFORE DELETE ON vendas
    FOR EACH ROW
    EXECUTE FUNCTION reverter_estoque_venda();