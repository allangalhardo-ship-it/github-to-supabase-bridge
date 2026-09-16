CREATE OR REPLACE FUNCTION public.reverter_estoque_movimento_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.tipo = 'entrada' THEN
        UPDATE public.insumos
        SET estoque_atual = GREATEST(0, COALESCE(estoque_atual, 0) - COALESCE(OLD.quantidade, 0))
        WHERE id = OLD.insumo_id;
    ELSIF OLD.tipo = 'saida' THEN
        UPDATE public.insumos
        SET estoque_atual = COALESCE(estoque_atual, 0) + COALESCE(OLD.quantidade, 0)
        WHERE id = OLD.insumo_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_reverter_estoque_movimento_delete ON public.estoque_movimentos;
CREATE TRIGGER trg_reverter_estoque_movimento_delete
AFTER DELETE ON public.estoque_movimentos
FOR EACH ROW EXECUTE FUNCTION public.reverter_estoque_movimento_delete();