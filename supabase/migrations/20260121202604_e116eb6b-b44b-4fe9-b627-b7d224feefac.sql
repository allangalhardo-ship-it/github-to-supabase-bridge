-- Tabela para rastrear progresso do onboarding
CREATE TABLE public.onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  empresa_id UUID NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 1,
  completed BOOLEAN NOT NULL DEFAULT false,
  first_insumo_id UUID,
  first_produto_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own onboarding"
ON public.onboarding_progress
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own onboarding"
ON public.onboarding_progress
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own onboarding"
ON public.onboarding_progress
FOR UPDATE
USING (user_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_onboarding_progress_updated_at
BEFORE UPDATE ON public.onboarding_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();