REVOKE EXECUTE ON FUNCTION public.registrar_venda_pedido(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.estornar_venda_pedido(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_pedido_financeiro() FROM anon, authenticated;