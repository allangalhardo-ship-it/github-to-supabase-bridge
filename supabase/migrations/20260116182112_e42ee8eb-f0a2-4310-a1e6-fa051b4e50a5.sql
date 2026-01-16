-- Add faturamento_mensal column to configuracoes table
ALTER TABLE public.configuracoes 
ADD COLUMN faturamento_mensal numeric NOT NULL DEFAULT 0;