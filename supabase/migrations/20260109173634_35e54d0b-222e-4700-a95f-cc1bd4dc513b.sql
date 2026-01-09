-- Adicionar campo de rendimento padrão na tabela produtos
-- Isso armazena quantas unidades a receita padrão rende (ex: 30 brigadeiros)
ALTER TABLE public.produtos 
ADD COLUMN rendimento_padrao integer DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.produtos.rendimento_padrao IS 'Quantidade de unidades que a receita padrão rende (ex: uma panela de brigadeiro rende 30 unidades)';