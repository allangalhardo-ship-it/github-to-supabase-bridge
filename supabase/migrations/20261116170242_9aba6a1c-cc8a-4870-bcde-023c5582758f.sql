REVOKE EXECUTE ON FUNCTION public.recalcular_totais_pedido(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolver_canal_id(uuid, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_vendas_garantir_pedido() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_vendas_totais_pedido() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_vendas(uuid, date, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_vendas(uuid, date, date) TO authenticated;