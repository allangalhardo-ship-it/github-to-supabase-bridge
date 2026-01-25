-- Adicionar campo para permitir extensão manual de trial
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS trial_end_override timestamp with time zone DEFAULT NULL;

-- Comentário para documentar
COMMENT ON COLUMN public.usuarios.trial_end_override IS 'Data de fim do trial definida manualmente pelo admin. Se preenchida, substitui o cálculo padrão de 7 dias.';