-- Criar tabela de unidades de compra para conversão
CREATE TABLE public.unidades_compra (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, -- "pacote 500g", "kg", "caixa 12un", etc.
  fator_conversao NUMERIC NOT NULL DEFAULT 1, -- quantas unidades de produção equivalem a 1 desta unidade
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, insumo_id, nome)
);

-- Enable RLS
ALTER TABLE public.unidades_compra ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view empresa unidades_compra"
ON public.unidades_compra
FOR SELECT
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa unidades_compra"
ON public.unidades_compra
FOR INSERT
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update empresa unidades_compra"
ON public.unidades_compra
FOR UPDATE
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete empresa unidades_compra"
ON public.unidades_compra
FOR DELETE
USING (empresa_id = get_user_empresa_id());

-- Add trigger for updated_at
CREATE TRIGGER update_unidades_compra_updated_at
BEFORE UPDATE ON public.unidades_compra
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add column to estoque_movimentos to track unit conversion info
ALTER TABLE public.estoque_movimentos 
ADD COLUMN IF NOT EXISTS quantidade_original NUMERIC,
ADD COLUMN IF NOT EXISTS unidade_compra TEXT,
ADD COLUMN IF NOT EXISTS fator_conversao NUMERIC,
ADD COLUMN IF NOT EXISTS custo_total NUMERIC;