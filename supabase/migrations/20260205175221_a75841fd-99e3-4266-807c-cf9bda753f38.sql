-- Drop the problematic policy that shows all products with cardapio_ativo
DROP POLICY IF EXISTS "Public can view cardapio produtos" ON public.produtos;

-- Recreate with proper condition: only for anonymous/public users
CREATE POLICY "Public can view cardapio produtos"
ON public.produtos
FOR SELECT
USING (
  -- Only apply this policy when user is NOT authenticated (anonymous access)
  auth.uid() IS NULL
  AND ativo = true
  AND EXISTS (
    SELECT 1 FROM empresas e
    WHERE e.id = produtos.empresa_id
    AND e.cardapio_ativo = true
  )
);