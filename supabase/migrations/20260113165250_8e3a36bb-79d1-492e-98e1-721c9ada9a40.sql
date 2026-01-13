-- Add is_test_user column to usuarios table
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS is_test_user boolean DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_usuarios_is_test_user ON public.usuarios(is_test_user) WHERE is_test_user = true;