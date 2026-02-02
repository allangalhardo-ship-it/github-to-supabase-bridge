-- =====================================================
-- STORAGE BUCKETS
-- Execute após 04-policies.sql
-- =====================================================

-- Criar buckets de storage
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('database-backups', 'database-backups', false);

-- Políticas para bucket avatars (público)
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Políticas para bucket product-images (público)
CREATE POLICY "Product images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Users can update product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images');

CREATE POLICY "Users can delete product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images');

-- Políticas para bucket database-backups (privado, apenas service role)
CREATE POLICY "Only service role can access backups"
ON storage.objects FOR ALL
USING (bucket_id = 'database-backups');
