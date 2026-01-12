-- Adicionar campos na tabela usuarios
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS telefone text,
ADD COLUMN IF NOT EXISTS cpf_cnpj text;

-- Adicionar campo segmento na tabela empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS segmento text;

-- Criar índice único para CPF/CNPJ (evitar duplicatas)
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_cpf_cnpj ON public.usuarios(cpf_cnpj) WHERE cpf_cnpj IS NOT NULL;