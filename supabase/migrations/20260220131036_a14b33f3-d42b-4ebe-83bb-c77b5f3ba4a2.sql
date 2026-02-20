-- Drop the restrictive public policy that requires auth.uid() IS NULL
DROP POLICY IF EXISTS "Public can view cardapio produtos" ON public.produtos;

-- Create a new policy that allows anyone (logged in or not) to view active products from active cardapios
CREATE POLICY "Public can view cardapio produtos"
ON public.produtos FOR SELECT
USING (
  ativo = true
  AND EXISTS (
    SELECT 1 FROM empresas e
    WHERE e.id = produtos.empresa_id
    AND e.cardapio_ativo = true
  )
);
