CREATE OR REPLACE FUNCTION public.get_caixa_pedidos(p_empresa_id uuid)
RETURNS TABLE(pedido_id uuid, canal_id uuid, canal_nome text, data_caixa date, tipo text, valor numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH p AS (
    SELECT vp.*, COALESCE(c.nome, vp.canal_texto) AS cnome,
      CASE WHEN vp.pagamento_recebido_por = 'plataforma' THEN 'plat'
           WHEN vp.pagamento_recebido_por = 'loja' AND vp.taxa_canal > 0 THEN 'loja_tx'
           ELSE 'normal' END AS modo
    FROM vendas_pedidos vp LEFT JOIN canais_venda c ON c.id = vp.canal_id
    WHERE vp.empresa_id = p_empresa_id
      AND (p_empresa_id = get_user_empresa_id() OR auth.uid() IS NULL)
  ), linhas AS (
    SELECT id, canal_id, cnome, COALESCE(data_repasse_prevista, data_venda), 'repasse', valor_liquido FROM p WHERE modo = 'plat'
    UNION ALL
    SELECT id, canal_id, cnome, data_venda, 'venda', valor_bruto FROM p WHERE modo = 'loja_tx'
    UNION ALL
    SELECT id, canal_id, cnome, COALESCE(data_repasse_prevista, data_venda), 'desconto_repasse', -taxa_canal FROM p WHERE modo = 'loja_tx'
    UNION ALL
    SELECT id, canal_id, cnome, data_venda, 'venda', valor_liquido FROM p WHERE modo = 'normal'
  ), mens AS (
    SELECT c.id AS canal_id, c.nome, date_trunc('month', vp.data_venda)::date AS mes, c.mensalidade,
      max(CASE WHEN vp.pagamento_recebido_por = 'plataforma' THEN COALESCE(vp.data_repasse_prevista, vp.data_venda) END) AS dt_rep,
      max(vp.data_venda) AS dt_ult
    FROM canais_venda c JOIN vendas_pedidos vp ON vp.canal_id = c.id
    WHERE c.empresa_id = p_empresa_id AND c.mensalidade > 0
      AND (p_empresa_id = get_user_empresa_id() OR auth.uid() IS NULL)
    GROUP BY c.id, c.nome, 3, c.mensalidade
  )
  SELECT * FROM linhas
  UNION ALL
  SELECT NULL::uuid, canal_id, nome, COALESCE(dt_rep, dt_ult), 'mensalidade', -mensalidade FROM mens;
$$;
REVOKE EXECUTE ON FUNCTION public.get_caixa_pedidos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_caixa_pedidos(uuid) TO authenticated;