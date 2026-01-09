-- Adicionar campos de shelf life e alerta na tabela producoes
ALTER TABLE public.producoes
ADD COLUMN shelf_life_dias integer DEFAULT NULL,
ADD COLUMN dias_alerta_vencimento integer DEFAULT 3,
ADD COLUMN data_vencimento date DEFAULT NULL;

-- Criar índice para busca de produtos próximos ao vencimento
CREATE INDEX idx_producoes_data_vencimento ON public.producoes(data_vencimento) WHERE data_vencimento IS NOT NULL;