-- Adicionar campos para assinatura Asaas na tabela usuarios
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS asaas_plan TEXT,
ADD COLUMN IF NOT EXISTS asaas_subscription_end TIMESTAMP WITH TIME ZONE;

-- Criar índice para buscar por subscription_id
CREATE INDEX IF NOT EXISTS idx_usuarios_asaas_subscription_id 
ON public.usuarios(asaas_subscription_id) 
WHERE asaas_subscription_id IS NOT NULL;