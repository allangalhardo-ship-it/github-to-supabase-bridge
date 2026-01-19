-- Fix: duplicated triggers on estoque_movimentos were applying stock changes multiple times
-- Keep a single trigger and remove duplicates.

DROP TRIGGER IF EXISTS trigger_atualizar_estoque ON public.estoque_movimentos;
DROP TRIGGER IF EXISTS trigger_atualizar_estoque_insumo ON public.estoque_movimentos;

-- Ensure the canonical trigger exists (idempotent)
DROP TRIGGER IF EXISTS trg_atualizar_estoque_insumo ON public.estoque_movimentos;
CREATE TRIGGER trg_atualizar_estoque_insumo
AFTER INSERT ON public.estoque_movimentos
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_estoque_insumo();
