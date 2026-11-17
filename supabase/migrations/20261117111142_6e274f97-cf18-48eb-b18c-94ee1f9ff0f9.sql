REVOKE EXECUTE ON FUNCTION public.taxas_do_canal(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_caixa_pedidos(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.atualizar_taxa_real_pedido(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_caixa_pedidos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_taxa_real_pedido(uuid, numeric) TO authenticated;