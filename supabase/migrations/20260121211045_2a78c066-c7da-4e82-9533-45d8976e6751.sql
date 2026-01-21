-- Criar tabela para histórico de mensagens do Coach
CREATE TABLE public.coach_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- meta_mensal, margem, tendencia, canal, oportunidade, insumos
  status TEXT NOT NULL, -- success, warning, alert, neutral
  headline TEXT NOT NULL,
  detail TEXT NOT NULL,
  prioridade INTEGER NOT NULL DEFAULT 0,
  dados_contexto JSONB, -- dados adicionais para referência futura
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_coach_historico_empresa_id ON public.coach_historico(empresa_id);
CREATE INDEX idx_coach_historico_created_at ON public.coach_historico(created_at DESC);

-- Enable RLS
ALTER TABLE public.coach_historico ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can view empresa coach_historico"
  ON public.coach_historico
  FOR SELECT
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa coach_historico"
  ON public.coach_historico
  FOR INSERT
  WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete empresa coach_historico"
  ON public.coach_historico
  FOR DELETE
  USING (empresa_id = get_user_empresa_id());