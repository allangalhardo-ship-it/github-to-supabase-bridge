-- Add image URL field to products
ALTER TABLE public.produtos
ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- Create a public bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product images
DO $$
BEGIN
  -- Public read (useful for listing in-app)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Product images are publicly accessible'
  ) THEN
    CREATE POLICY "Product images are publicly accessible"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'product-images');
  END IF;

  -- Upload only inside the current user's empresa folder
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload product images (empresa folder)'
  ) THEN
    CREATE POLICY "Users can upload product images (empresa folder)"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'product-images'
      AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update product images (empresa folder)'
  ) THEN
    CREATE POLICY "Users can update product images (empresa folder)"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'product-images'
      AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete product images (empresa folder)'
  ) THEN
    CREATE POLICY "Users can delete product images (empresa folder)"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'product-images'
      AND (storage.foldername(name))[1] = public.get_user_empresa_id()::text
    );
  END IF;
END $$;