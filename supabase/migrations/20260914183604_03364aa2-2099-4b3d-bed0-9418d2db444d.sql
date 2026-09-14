DROP FUNCTION IF EXISTS public.get_dashboard_vendas(uuid, date, date);
CREATE FUNCTION public.get_dashboard_vendas(p_empresa_id uuid, p_data_inicio date, p_data_fim date)
RETURNS TABLE(id uuid, data_venda date, valor_total numeric, quantidade numeric, canal text, produto_id uuid, produto_nome text, produto_preco_venda numeric, custo_insumos numeric, custo_snapshot numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    v.id,
    v.data_venda::date,
    v.valor_total,
    v.quantidade,
    v.canal,
    v.produto_id,
    p.nome AS produto_nome,
    p.preco_venda AS produto_preco_venda,
    COALESCE(public.calcular_custo_ficha(p.id), 0) AS custo_insumos,
    v.custo_snapshot
  FROM vendas v
  LEFT JOIN produtos p ON p.id = v.produto_id
  WHERE v.empresa_id = p_empresa_id
    AND v.data_venda >= p_data_inicio
    AND v.data_venda <= p_data_fim
  ORDER BY v.data_venda DESC;
$function$;

DROP FUNCTION IF EXISTS public.get_top_produtos(uuid, date, date, integer);
CREATE FUNCTION public.get_top_produtos(p_empresa_id uuid, p_data_inicio date, p_data_fim date, p_limit integer DEFAULT 5)
RETURNS TABLE(produto_id uuid, nome text, receita numeric, custo numeric, lucro numeric, quantidade numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    v.produto_id,
    p.nome,
    SUM(v.valor_total) AS receita,
    SUM(COALESCE(v.custo_snapshot, COALESCE(public.calcular_custo_ficha(p.id), 0) * COALESCE(v.quantidade, 0))) AS custo,
    SUM(v.valor_total) - SUM(COALESCE(v.custo_snapshot, COALESCE(public.calcular_custo_ficha(p.id), 0) * COALESCE(v.quantidade, 0))) AS lucro,
    SUM(COALESCE(v.quantidade, 0)) AS quantidade
  FROM vendas v
  JOIN produtos p ON p.id = v.produto_id
  WHERE v.empresa_id = p_empresa_id
    AND v.data_venda >= p_data_inicio
    AND v.data_venda <= p_data_fim
    AND v.produto_id IS NOT NULL
  GROUP BY v.produto_id, p.nome
  ORDER BY lucro DESC
  LIMIT p_limit;
$function$;

DROP FUNCTION IF EXISTS public.get_insumos_estoque_baixo(uuid);
CREATE FUNCTION public.get_insumos_estoque_baixo(p_empresa_id uuid)
RETURNS TABLE(id uuid, nome text, unidade_medida text, estoque_atual numeric, estoque_minimo numeric, custo_unitario numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    id,
    nome,
    unidade_medida,
    estoque_atual,
    estoque_minimo,
    custo_unitario
  FROM insumos
  WHERE empresa_id = p_empresa_id
    AND estoque_minimo > 0
    AND estoque_atual <= estoque_minimo
  ORDER BY (estoque_minimo - estoque_atual) DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_dashboard_vendas(uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_top_produtos(uuid, date, date, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_insumos_estoque_baixo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_vendas(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_top_produtos(uuid, date, date, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_insumos_estoque_baixo(uuid) TO authenticated, service_role;