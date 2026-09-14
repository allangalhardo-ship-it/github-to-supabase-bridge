-- Garante que o Custo Médio Ponderado leia o estoque ANTERIOR à entrada.
-- Gatilhos AFTER disparam em ordem alfabética: "t1_..." roda antes de "tr_atualizar_estoque_insumo".
DROP TRIGGER IF EXISTS trg_custo_medio_ponderado ON public.estoque_movimentos;
DROP TRIGGER IF EXISTS t1_custo_medio_ponderado ON public.estoque_movimentos;

CREATE TRIGGER t1_custo_medio_ponderado
AFTER INSERT ON public.estoque_movimentos
FOR EACH ROW
EXECUTE FUNCTION public.calcular_custo_medio_ponderado();

-- Trava rendimento inválido no custo da ficha (evita divisão por zero/negativo)
CREATE OR REPLACE FUNCTION public.calcular_custo_ficha(p_produto_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total NUMERIC := 0;
  v_rend  NUMERIC;
  rec_ft  RECORD;
  v_qtd_conv NUMERIC;
  v_perda_div NUMERIC;
BEGIN
  SELECT GREATEST(COALESCE(NULLIF(rendimento_padrao,0),1), 1) INTO v_rend
  FROM public.produtos WHERE id = p_produto_id;

  IF v_rend IS NULL OR v_rend <= 0 THEN
    v_rend := 1;
  END IF;

  FOR rec_ft IN
    SELECT ft.quantidade AS q, ft.unidade AS unid_ficha,
           ins.custo_unitario AS cu, ins.unidade_medida AS unid_insumo,
           COALESCE(ins.fator_perda,0) AS perda
    FROM public.fichas_tecnicas ft
    JOIN public.insumos ins ON ins.id = ft.insumo_id
    WHERE ft.produto_id = p_produto_id
  LOOP
    v_qtd_conv := public.converter_unidade(
      rec_ft.q,
      COALESCE(rec_ft.unid_ficha, rec_ft.unid_insumo),
      rec_ft.unid_insumo
    );
    v_perda_div := CASE WHEN rec_ft.perda >= 100 THEN 1 ELSE 1 - (rec_ft.perda/100.0) END;
    v_total := v_total + (v_qtd_conv * COALESCE(rec_ft.cu,0) / NULLIF(v_perda_div,0));
  END LOOP;

  RETURN COALESCE(v_total / v_rend, 0);
END;
$function$;