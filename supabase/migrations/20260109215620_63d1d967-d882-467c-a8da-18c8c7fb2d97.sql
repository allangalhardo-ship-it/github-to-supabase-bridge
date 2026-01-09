-- Função para baixar estoque automaticamente quando uma venda é inserida
CREATE OR REPLACE FUNCTION public.baixar_estoque_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    ficha RECORD;
    qtd_baixa NUMERIC;
BEGIN
    -- Só processa se a venda tiver um produto_id
    IF NEW.produto_id IS NOT NULL THEN
        -- Para cada insumo da ficha técnica do produto
        FOR ficha IN 
            SELECT ft.insumo_id, ft.quantidade, i.unidade_medida
            FROM fichas_tecnicas ft
            JOIN insumos i ON i.id = ft.insumo_id
            WHERE ft.produto_id = NEW.produto_id
        LOOP
            -- Calcula quantidade a baixar (quantidade da ficha * quantidade vendida)
            qtd_baixa := ficha.quantidade * NEW.quantidade;
            
            -- Insere movimento de saída
            INSERT INTO estoque_movimentos (
                empresa_id,
                insumo_id,
                tipo,
                quantidade,
                origem,
                observacao,
                referencia
            ) VALUES (
                NEW.empresa_id,
                ficha.insumo_id,
                'saida',
                qtd_baixa,
                'venda',
                'Baixa automática - Venda de ' || NEW.quantidade || 'x produto',
                NEW.id
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar trigger para executar após inserção de venda
CREATE TRIGGER trigger_baixar_estoque_venda
AFTER INSERT ON public.vendas
FOR EACH ROW
EXECUTE FUNCTION public.baixar_estoque_venda();

-- Também precisamos criar o trigger de atualização de estoque que estava faltando
CREATE TRIGGER trigger_atualizar_estoque_insumo
AFTER INSERT ON public.estoque_movimentos
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_estoque_insumo();