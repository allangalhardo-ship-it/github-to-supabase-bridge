
-- RPC para calcular saldo total do caixa no backend
CREATE OR REPLACE FUNCTION public.get_saldo_caixa(p_empresa_id uuid)
RETURNS TABLE(
  total_entradas numeric,
  total_saidas numeric,
  saldo numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH movimentos AS (
    SELECT 
      COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0) AS entradas,
      COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0) AS saidas
    FROM caixa_movimentos
    WHERE empresa_id = p_empresa_id
  ),
  vendas_total AS (
    SELECT COALESCE(SUM(valor_total), 0) AS total
    FROM vendas
    WHERE empresa_id = p_empresa_id
  ),
  notas_total AS (
    SELECT COALESCE(SUM(valor_total), 0) AS total
    FROM xml_notas
    WHERE empresa_id = p_empresa_id
  )
  SELECT
    (m.entradas + v.total)::numeric AS total_entradas,
    (m.saidas + n.total)::numeric AS total_saidas,
    (m.entradas + v.total - m.saidas - n.total)::numeric AS saldo
  FROM movimentos m, vendas_total v, notas_total n;
$$;
