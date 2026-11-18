CREATE OR REPLACE FUNCTION public.get_caixa_pedidos(p_empresa_id uuid)
RETURNS TABLE(pedido_id uuid, canal_id uuid, canal_nome text, data_caixa date, tipo text, valor numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
WITH pedidos AS (
 SELECT vp.*, COALESCE(c.nome, vp.canal_texto) AS nome_canal,
 CASE WHEN vp.pagamento_recebido_por='plataforma' THEN 'plataforma'
 WHEN c.tipo='app_delivery' AND vp.pagamento_recebido_por='loja' THEN 'loja_app'
 ELSE 'normal' END AS modo
 FROM public.vendas_pedidos vp LEFT JOIN public.canais_venda c ON c.id=vp.canal_id
 WHERE vp.empresa_id=p_empresa_id AND (p_empresa_id=public.get_user_empresa_id() OR auth.uid() IS NULL)
), linhas AS (
 SELECT id AS pedido_id, canal_id, nome_canal, COALESCE(data_repasse_prevista,data_venda) AS data_caixa, 'repasse'::text AS tipo, valor_liquido AS valor FROM pedidos WHERE modo='plataforma'
 UNION ALL SELECT id,canal_id,nome_canal,data_venda,'venda',valor_bruto FROM pedidos WHERE modo='loja_app'
 UNION ALL SELECT id,canal_id,nome_canal,COALESCE(data_repasse_prevista,data_venda),'desconto_repasse',-taxa_canal FROM pedidos WHERE modo='loja_app' AND taxa_canal>0
 UNION ALL SELECT id,canal_id,nome_canal,data_venda,'venda',CASE WHEN valor_liquido>0 THEN valor_liquido ELSE valor_bruto END FROM pedidos WHERE modo='normal'
), meses AS (
 SELECT c.id AS canal_id,c.nome,c.mensalidade,date_trunc('month',p.data_venda)::date AS mes,
 max(CASE WHEN p.modo='plataforma' THEN COALESCE(p.data_repasse_prevista,p.data_venda) END) AS data_repasse,
 COALESCE(sum(CASE WHEN p.modo='plataforma' THEN p.valor_liquido ELSE 0 END),0)-COALESCE(sum(CASE WHEN p.modo='loja_app' THEN p.taxa_canal ELSE 0 END),0) AS disponivel,
 max(p.data_venda) AS ultima_venda
 FROM public.canais_venda c JOIN pedidos p ON p.canal_id=c.id
 WHERE c.empresa_id=p_empresa_id AND c.mensalidade>0
 GROUP BY c.id,c.nome,c.mensalidade,date_trunc('month',p.data_venda)::date
), cobranca AS (
 SELECT *,CASE WHEN data_repasse IS NULL THEN 0 ELSE LEAST(mensalidade,GREATEST(disponivel,0)) END AS abatimento FROM meses
)
SELECT * FROM linhas
UNION ALL SELECT NULL::uuid,canal_id,nome,data_repasse,'mensalidade',-abatimento FROM cobranca WHERE abatimento>0
UNION ALL SELECT NULL::uuid,canal_id,nome,LEAST(ultima_venda,(mes+interval '1 month - 1 day')::date),'mensalidade_saida',-(mensalidade-abatimento) FROM cobranca WHERE mensalidade>abatimento;
$function$;
GRANT EXECUTE ON FUNCTION public.get_caixa_pedidos(uuid) TO authenticated, service_role;