-- Remover políticas antigas muito permissivas
DROP POLICY IF EXISTS "Authenticated users can upload cardapio images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update cardapio images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete cardapio images" ON storage.objects;

-- Criar políticas mais restritivas - usuário só pode fazer upload na pasta da sua empresa
CREATE POLICY "Users can upload to their empresa folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cardapio-images' 
  AND (storage.foldername(name))[1] = (SELECT empresa_id::text FROM public.usuarios WHERE id = auth.uid())
);

CREATE POLICY "Users can update their empresa images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'cardapio-images' 
  AND (storage.foldername(name))[1] = (SELECT empresa_id::text FROM public.usuarios WHERE id = auth.uid())
);

CREATE POLICY "Users can delete their empresa images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cardapio-images' 
  AND (storage.foldername(name))[1] = (SELECT empresa_id::text FROM public.usuarios WHERE id = auth.uid())
);