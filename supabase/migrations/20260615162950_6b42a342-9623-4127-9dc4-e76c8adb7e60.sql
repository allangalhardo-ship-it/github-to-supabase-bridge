
REVOKE EXECUTE ON FUNCTION public.recalcular_custo_intermediario(UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.baixar_insumo_recursivo(UUID, UUID, NUMERIC, UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_intermediario_composicao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_cascata_custo_insumo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_vendas_custo_snapshot() FROM PUBLIC, anon, authenticated;
-- calcular_custo_ficha e converter_unidade ficam disponíveis para chamada via SDK
