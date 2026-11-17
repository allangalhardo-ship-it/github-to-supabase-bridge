DO $do$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.salvar_venda_pedido(jsonb,jsonb,uuid,uuid)'::regprocedure) INTO d;
  IF position('IF v_receb = ''plataforma'' THEN v_taxa_pct := v_taxa_pct + v_online; END IF;' in d) = 0 THEN
    RAISE EXCEPTION 'trecho não encontrado';
  END IF;
  d := replace(d, 'IF v_receb = ''plataforma'' THEN v_taxa_pct := v_taxa_pct + v_online; END IF;',
    'IF v_receb = ''plataforma'' OR COALESCE(NULLIF(p_pedido->>''forma_pagamento'',''''), '''') ~* ''cart|cr[eé]dito|d[eé]bito|maquin'' THEN v_taxa_pct := v_taxa_pct + v_online; END IF;');
  EXECUTE d;
END $do$;