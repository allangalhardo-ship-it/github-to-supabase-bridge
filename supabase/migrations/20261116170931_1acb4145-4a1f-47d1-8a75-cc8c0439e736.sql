CREATE OR REPLACE FUNCTION public.origem_pedido_de_venda(p_origem text, p_plataforma text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN p_origem = 'importacao_99food' OR p_plataforma ILIKE '99%' THEN '99food'
    WHEN p_origem = 'importacao' THEN 'planilha'
    WHEN p_origem = 'importacao_foto' THEN 'foto'
    WHEN p_origem IS NULL THEN 'manual'
    ELSE p_origem END;
$$;