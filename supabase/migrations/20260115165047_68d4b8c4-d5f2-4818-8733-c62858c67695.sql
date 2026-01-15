-- Create table to store price history for insumos
CREATE TABLE public.historico_precos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insumo_id UUID NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  preco_anterior NUMERIC,
  preco_novo NUMERIC NOT NULL,
  variacao_percentual NUMERIC,
  origem TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'xml', 'ajuste'
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.historico_precos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view empresa historico_precos" 
ON public.historico_precos 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa historico_precos" 
ON public.historico_precos 
FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete empresa historico_precos" 
ON public.historico_precos 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Create index for faster queries
CREATE INDEX idx_historico_precos_insumo ON public.historico_precos(insumo_id);
CREATE INDEX idx_historico_precos_created ON public.historico_precos(created_at DESC);