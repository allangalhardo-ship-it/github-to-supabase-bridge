-- Fix 1: Restrict usuarios table RLS policy to only allow viewing own profile
-- This prevents exposing PII (email, phone, CPF/CNPJ) to all company users
DROP POLICY IF EXISTS "Users can view own profile" ON public.usuarios;

CREATE POLICY "Users can view own profile"
ON public.usuarios FOR SELECT
USING (id = auth.uid());

-- Fix 2: Add server-side validation for avatar uploads
-- Configure allowed MIME types and file size limit on avatars bucket
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    file_size_limit = 2097152  -- 2MB in bytes
WHERE id = 'avatars';