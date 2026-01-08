-- Adicionar campo para taxa do app de delivery (iFood, 99, Rappi, etc.)
ALTER TABLE public.configuracoes 
ADD COLUMN IF NOT EXISTS taxa_app_delivery numeric NOT NULL DEFAULT 12;

-- Comentário explicativo
COMMENT ON COLUMN public.configuracoes.taxa_app_delivery IS 'Porcentagem média cobrada pelos apps de delivery (iFood, 99, Rappi)';