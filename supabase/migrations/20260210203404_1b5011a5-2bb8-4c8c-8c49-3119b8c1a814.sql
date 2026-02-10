-- Adicionar coluna para configuração do cardápio (ordenação de categorias, visibilidade, etc.)
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS cardapio_config JSONB DEFAULT '{}';

-- Comentário para documentar o formato esperado
COMMENT ON COLUMN public.empresas.cardapio_config IS 'Configurações do cardápio digital: { categorias_ordem: string[], categorias_ocultas: string[] }';