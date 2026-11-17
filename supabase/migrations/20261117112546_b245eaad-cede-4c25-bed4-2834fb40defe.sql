CREATE OR REPLACE FUNCTION public.get_caixa_pedidos(p_empresa_id uuid)
 RETURNS TABLE(pedido_id uuid, canal_id uuid, canal_nome text, data_caixa date, tipo text, valor numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
      COALESCE(sum(CASE WHEN vp.pagamento_recebido_por = 'plataforma' THEN vp.valor_liquido END), 0)
        - COALESCE(sum(CASE WHEN vp.pagamento_recebido_por = 'loja' AND vp.taxa_canal > 0 THEN vp.taxa_canal END), 0) AS a_receber,
      max(vp.data_venda) AS dt_ult
    FROM canais_venda c JOIN vendas_pedidos vp ON vp.canal_id = c.id
    WHERE c.empresa_id = p_empresa_id AND c.mensalidade > 0
      AND (p_empresa_id = get_user_empresa_id() OR auth.uid() IS NULL)
    GROUP BY c.id, c.nome, 3, c.mensalidade
  ), mens2 AS (
    SELECT *, CASE WHEN dt_rep IS NULL THEN 0 ELSE LEAST(mensalidade, GREATEST(a_receber, 0)) END AS no_repasse FROM mens
  )
  SELECT * FROM linhas
  UNION ALL
  -- abatida do repasse do mês (aparece no "A receber" enquanto não cai)
  SELECT NULL::uuid, canal_id, nome, dt_rep, 'mensalidade', -no_repasse FROM mens2 WHERE no_repasse > 0
  UNION ALL
  -- sem valor a receber no mês (ou o que sobrar): saída automática no Caixa
  SELECT NULL::uuid, canal_id, nome, LEAST(dt_ult, (mes + interval '1 month - 1 day')::date), 'mensalidade_saida', -(mensalidade - no_repasse)
  FROM mens2 WHERE mensalidade - no_repasse > 0;
$function$;

UPDATE public.taxas_canais SET nome = 'Pagamento online'
WHERE canal_id = '473336d0-1826-44a8-bc59-7dc6945bb3e5' AND nome = 'Comissão' AND percentual = 4;