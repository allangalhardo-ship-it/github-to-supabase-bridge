-- Adicionar colunas para logo e banner na tabela empresas
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Criar bucket para imagens do cardápio
INSERT INTO storage.buckets (id, name, public)
VALUES ('cardapio-images', 'cardapio-images', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir upload por usuários autenticados
CREATE POLICY "Authenticated users can upload cardapio images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cardapio-images');

-- Política para permitir update por usuários autenticados
CREATE POLICY "Authenticated users can update cardapio images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'cardapio-images');

-- Política para permitir delete por usuários autenticados
CREATE POLICY "Authenticated users can delete cardapio images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'cardapio-images');

-- Política para leitura pública (cardápio é público)
CREATE POLICY "Public can view cardapio images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'cardapio-images');