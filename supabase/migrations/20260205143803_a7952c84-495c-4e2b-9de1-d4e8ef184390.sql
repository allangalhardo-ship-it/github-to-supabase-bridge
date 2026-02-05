-- Adicionar campo slug na tabela empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS whatsapp_dono TEXT,
ADD COLUMN IF NOT EXISTS cardapio_ativo BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS cardapio_descricao TEXT,
ADD COLUMN IF NOT EXISTS horario_funcionamento TEXT;

-- Índice para busca rápida por slug
CREATE INDEX IF NOT EXISTS idx_empresas_slug ON public.empresas(slug);

-- Gerar slugs automáticos para empresas existentes (baseado no nome)
UPDATE public.empresas 
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      TRANSLATE(nome, 'áàãâäéèêëíìîïóòõôöúùûüçñÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
      '[^a-zA-Z0-9\s-]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
) || '-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL;

-- Policy para permitir leitura pública do cardápio (sem autenticação)
CREATE POLICY "Public can view cardapio data" 
ON public.empresas 
FOR SELECT 
USING (cardapio_ativo = true);

-- Policy para produtos visíveis no cardápio público
CREATE POLICY "Public can view cardapio produtos" 
ON public.produtos 
FOR SELECT 
USING (
  ativo = true AND 
  EXISTS (
    SELECT 1 FROM empresas e 
    WHERE e.id = produtos.empresa_id 
    AND e.cardapio_ativo = true
  )
);