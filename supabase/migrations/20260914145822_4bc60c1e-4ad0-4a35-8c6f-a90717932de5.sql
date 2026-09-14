REVOKE ALL ON FUNCTION public.registrar_venda_pedido(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.estornar_venda_pedido(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_pedido_financeiro() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_venda_encomenda(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.estornar_venda_encomenda(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_encomenda_financeiro() FROM PUBLIC, anon, authenticated;