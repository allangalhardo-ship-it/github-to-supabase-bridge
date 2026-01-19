-- Trigger para normalizar quantidade de movimentos de estoque (sempre positivo)
-- O tipo (entrada/saida) define a direção, não o sinal da quantidade

CREATE OR REPLACE FUNCTION public.normalizar_quantidade_movimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Garantir que quantidade seja sempre positiva
  NEW.quantidade := ABS(NEW.quantidade);
  
  -- Garantir que quantidade_original seja positiva se existir
  IF NEW.quantidade_original IS NOT NULL THEN
    NEW.quantidade_original := ABS(NEW.quantidade_original);
  END IF;
  
  -- Garantir que fator_conversao seja positivo se existir
  IF NEW.fator_conversao IS NOT NULL THEN
    NEW.fator_conversao := ABS(NEW.fator_conversao);
  END IF;
  
  -- Garantir que custo_total seja positivo se existir
  IF NEW.custo_total IS NOT NULL THEN
    NEW.custo_total := ABS(NEW.custo_total);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE INSERT para normalizar valores
DROP TRIGGER IF EXISTS trg_normalizar_quantidade_movimento ON public.estoque_movimentos;
CREATE TRIGGER trg_normalizar_quantidade_movimento
BEFORE INSERT ON public.estoque_movimentos
FOR EACH ROW
EXECUTE FUNCTION public.normalizar_quantidade_movimento();