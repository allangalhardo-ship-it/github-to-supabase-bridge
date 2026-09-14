DROP POLICY IF EXISTS "Public can insert pedidos via cardapio" ON public.pedidos;
REVOKE INSERT ON public.pedidos FROM anon;
GRANT ALL ON public.pedidos TO service_role;