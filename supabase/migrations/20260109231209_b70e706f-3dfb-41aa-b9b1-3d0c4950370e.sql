-- Tabela para movimentações de caixa manuais
CREATE TABLE public.caixa_movimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  data_movimento DATE NOT NULL DEFAULT CURRENT_DATE,
  origem TEXT NOT NULL DEFAULT 'manual',
  referencia UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.caixa_movimentos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view empresa caixa_movimentos"
  ON public.caixa_movimentos FOR SELECT
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa caixa_movimentos"
  ON public.caixa_movimentos FOR INSERT
  WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update empresa caixa_movimentos"
  ON public.caixa_movimentos FOR UPDATE
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete empresa caixa_movimentos"
  ON public.caixa_movimentos FOR DELETE
  USING (empresa_id = get_user_empresa_id());

-- Index para performance
CREATE INDEX idx_caixa_movimentos_empresa_data ON public.caixa_movimentos(empresa_id, data_movimento DESC);