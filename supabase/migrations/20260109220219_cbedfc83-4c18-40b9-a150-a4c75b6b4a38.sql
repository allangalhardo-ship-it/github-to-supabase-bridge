-- Adicionar campo de estoque de produto acabado na tabela produtos
ALTER TABLE public.produtos 
ADD COLUMN IF NOT EXISTS estoque_acabado numeric NOT NULL DEFAULT 0;

-- Criar tabela de produções
CREATE TABLE public.producoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL,
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    quantidade numeric NOT NULL DEFAULT 1,
    observacao text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.producoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para produções
CREATE POLICY "Users can view empresa producoes" 
ON public.producoes FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa producoes" 
ON public.producoes FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update empresa producoes" 
ON public.producoes FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete empresa producoes" 
ON public.producoes FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Função para processar produção: baixa insumos + alimenta estoque acabado
CREATE OR REPLACE FUNCTION public.processar_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    ficha RECORD;
    qtd_baixa NUMERIC;
BEGIN
    -- Para cada insumo da ficha técnica do produto
    FOR ficha IN 
        SELECT ft.insumo_id, ft.quantidade
        FROM fichas_tecnicas ft
        WHERE ft.produto_id = NEW.produto_id
    LOOP
        -- Calcula quantidade a baixar
        qtd_baixa := ficha.quantidade * NEW.quantidade;
        
        -- Insere movimento de saída de insumo
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
            'producao',
            'Produção de ' || NEW.quantidade || 'x produto',
            NEW.id
        );
    END LOOP;
    
    -- Alimenta estoque de produto acabado
    UPDATE produtos
    SET estoque_acabado = estoque_acabado + NEW.quantidade
    WHERE id = NEW.produto_id;
    
    RETURN NEW;
END;
$$;

-- Trigger para processar produção
CREATE TRIGGER trigger_processar_producao
AFTER INSERT ON public.producoes
FOR EACH ROW
EXECUTE FUNCTION public.processar_producao();

-- Atualizar função de baixa de estoque na venda para considerar estoque acabado
CREATE OR REPLACE FUNCTION public.baixar_estoque_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    ficha RECORD;
    qtd_baixa NUMERIC;
    estoque_disponivel NUMERIC;
    qtd_do_acabado NUMERIC;
    qtd_dos_insumos NUMERIC;
BEGIN
    -- Só processa se a venda tiver um produto_id
    IF NEW.produto_id IS NOT NULL THEN
        -- Verifica estoque de produto acabado disponível
        SELECT estoque_acabado INTO estoque_disponivel
        FROM produtos
        WHERE id = NEW.produto_id;
        
        -- Calcula quanto vem do estoque acabado e quanto dos insumos
        IF estoque_disponivel >= NEW.quantidade THEN
            -- Tem estoque acabado suficiente
            qtd_do_acabado := NEW.quantidade;
            qtd_dos_insumos := 0;
        ELSIF estoque_disponivel > 0 THEN
            -- Tem estoque parcial - usa o que tem e baixa insumos pro resto
            qtd_do_acabado := estoque_disponivel;
            qtd_dos_insumos := NEW.quantidade - estoque_disponivel;
        ELSE
            -- Não tem estoque acabado - baixa tudo dos insumos
            qtd_do_acabado := 0;
            qtd_dos_insumos := NEW.quantidade;
        END IF;
        
        -- Baixa do estoque de produto acabado se houver
        IF qtd_do_acabado > 0 THEN
            UPDATE produtos
            SET estoque_acabado = estoque_acabado - qtd_do_acabado
            WHERE id = NEW.produto_id;
        END IF;
        
        -- Baixa insumos para a quantidade que não tinha em estoque acabado
        IF qtd_dos_insumos > 0 THEN
            FOR ficha IN 
                SELECT ft.insumo_id, ft.quantidade
                FROM fichas_tecnicas ft
                WHERE ft.produto_id = NEW.produto_id
            LOOP
                qtd_baixa := ficha.quantidade * qtd_dos_insumos;
                
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
                    'Baixa automática - Venda de ' || qtd_dos_insumos || 'x produto (sem estoque acabado)',
                    NEW.id
                );
            END LOOP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;