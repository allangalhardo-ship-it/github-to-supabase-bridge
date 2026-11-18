DO $do$
DECLARE d text; trecho text := '  IF v_pid IS NOT NULL AND v_receb IS NULL THEN';
BEGIN
  SELECT pg_get_functiondef('public.salvar_venda_pedido(jsonb,jsonb,uuid,uuid)'::regprocedure) INTO d;
  IF position(trecho in d) = 0 THEN RAISE EXCEPTION 'Trecho esperado do pagamento não encontrado'; END IF;
  d := replace(d, trecho, $novo$  IF v_tipo = 'app_delivery' AND (p_pedido->>'forma_pagamento') = 'pago_app' THEN
    v_receb := 'plataforma';
  ELSIF v_tipo = 'app_delivery' AND p_pedido ? 'forma_pagamento'
        AND NULLIF(p_pedido->>'forma_pagamento','') IS NOT NULL
        AND COALESCE(p_pedido->>'origem','manual') = 'manual' THEN
    v_receb := 'loja';
  ELSIF v_pid IS NULL AND v_tipo = 'app_delivery'
        AND COALESCE(p_pedido->>'origem','manual') = 'manual' AND v_receb IS NULL THEN
    v_receb := 'plataforma';
  END IF;
  IF v_pid IS NOT NULL AND v_receb IS NULL THEN$novo$);
  EXECUTE d;
END $do$;

DO $do$
DECLARE d text; trecho text := 'WHEN vp.pagamento_recebido_por = ''loja'' AND vp.taxa_canal > 0 THEN ''loja_tx''';
BEGIN
  SELECT pg_get_functiondef('public.get_caixa_pedidos(uuid)'::regprocedure) INTO d;
  IF position(trecho in d) = 0 THEN RAISE EXCEPTION 'Trecho esperado do Caixa não encontrado'; END IF;
  d := replace(d, trecho, 'WHEN c.tipo = ''app_delivery'' AND vp.pagamento_recebido_por = ''loja'' AND vp.taxa_canal > 0 THEN ''loja_tx''');
  d := replace(d, 'vp.pagamento_recebido_por = ''loja'' AND vp.taxa_canal > 0 THEN vp.taxa_canal', 'c.tipo = ''app_delivery'' AND vp.pagamento_recebido_por = ''loja'' AND vp.taxa_canal > 0 THEN vp.taxa_canal');
  EXECUTE d;
END $do$;

CREATE OR REPLACE FUNCTION public.bloquear_exclusao_canal_com_vendas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE v_total bigint;
BEGIN
  SELECT count(*) INTO v_total FROM public.vendas_pedidos WHERE canal_id = OLD.id;
  IF v_total > 0 THEN
    RAISE EXCEPTION 'Este canal tem % pedidos. Desative-o para manter o histórico.', v_total;
  END IF;
  RETURN OLD;
END;
$function$;
REVOKE ALL ON FUNCTION public.bloquear_exclusao_canal_com_vendas() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER bloquear_exclusao_canal_com_vendas BEFORE DELETE ON public.canais_venda
FOR EACH ROW EXECUTE FUNCTION public.bloquear_exclusao_canal_com_vendas();