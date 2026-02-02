-- =====================================================
-- FUNÇÕES DO BANCO DE DADOS
-- Execute após 01-schema.sql
-- =====================================================

-- Função para obter empresa_id do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.usuarios WHERE id = auth.uid()
$$;

-- Função para verificar role do usuário
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para atualizar timestamp updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Função para atualizar estoque do insumo
CREATE OR REPLACE FUNCTION public.atualizar_estoque_insumo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.tipo = 'entrada' THEN
        UPDATE public.insumos
        SET estoque_atual = estoque_atual + NEW.quantidade
        WHERE id = NEW.insumo_id;
    ELSIF NEW.tipo = 'saida' THEN
        UPDATE public.insumos
        SET estoque_atual = estoque_atual - NEW.quantidade
        WHERE id = NEW.insumo_id;
    END IF;
    RETURN NEW;
END;
$$;

-- Função para normalizar quantidade de movimento
CREATE OR REPLACE FUNCTION public.normalizar_quantidade_movimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.quantidade := ABS(NEW.quantidade);
  
  IF NEW.quantidade_original IS NOT NULL THEN
    NEW.quantidade_original := ABS(NEW.quantidade_original);
  END IF;
  
  IF NEW.fator_conversao IS NOT NULL THEN
    NEW.fator_conversao := ABS(NEW.fator_conversao);
  END IF;
  
  IF NEW.custo_total IS NOT NULL THEN
    NEW.custo_total := ABS(NEW.custo_total);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Função para processar produção
CREATE OR REPLACE FUNCTION public.processar_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    ficha RECORD;
    qtd_baixa NUMERIC;
BEGIN
    FOR ficha IN 
        SELECT ft.insumo_id, ft.quantidade
        FROM fichas_tecnicas ft
        WHERE ft.produto_id = NEW.produto_id
    LOOP
        qtd_baixa := ficha.quantidade * NEW.quantidade;
        
        INSERT INTO estoque_movimentos (
            empresa_id,
            insumo_id,
            tipo,
            quantidade,
            origem,
            observacao,
            referencia
        ) VALUES (
            NEW.empresa_id,
            ficha.insumo_id,
            'saida',
            qtd_baixa,
            'producao',
            'Produção de ' || NEW.quantidade || 'x produto',
            NEW.id
        );
    END LOOP;
    
    UPDATE produtos
    SET estoque_acabado = estoque_acabado + NEW.quantidade
    WHERE id = NEW.produto_id;
    
    RETURN NEW;
END;
$$;

-- Função para baixar estoque na venda
CREATE OR REPLACE FUNCTION public.baixar_estoque_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    ficha RECORD;
    qtd_baixa NUMERIC;
    estoque_disponivel NUMERIC;
    qtd_do_acabado NUMERIC;
    qtd_dos_insumos NUMERIC;
BEGIN
    IF NEW.produto_id IS NOT NULL THEN
        SELECT estoque_acabado INTO estoque_disponivel
        FROM produtos
        WHERE id = NEW.produto_id;
        
        IF estoque_disponivel >= NEW.quantidade THEN
            qtd_do_acabado := NEW.quantidade;
            qtd_dos_insumos := 0;
        ELSIF estoque_disponivel > 0 THEN
            qtd_do_acabado := estoque_disponivel;
            qtd_dos_insumos := NEW.quantidade - estoque_disponivel;
        ELSE
            qtd_do_acabado := 0;
            qtd_dos_insumos := NEW.quantidade;
        END IF;
        
        IF qtd_do_acabado > 0 THEN
            UPDATE produtos
            SET estoque_acabado = estoque_acabado - qtd_do_acabado
            WHERE id = NEW.produto_id;
        END IF;
        
        IF qtd_dos_insumos > 0 THEN
            FOR ficha IN 
                SELECT ft.insumo_id, ft.quantidade
                FROM fichas_tecnicas ft
                WHERE ft.produto_id = NEW.produto_id
            LOOP
                qtd_baixa := ficha.quantidade * qtd_dos_insumos;
                
                INSERT INTO estoque_movimentos (
                    empresa_id,
                    insumo_id,
                    tipo,
                    quantidade,
                    origem,
                    observacao,
                    referencia
                ) VALUES (
                    NEW.empresa_id,
                    ficha.insumo_id,
                    'saida',
                    qtd_baixa,
                    'venda',
                    'Baixa automática - Venda de ' || qtd_dos_insumos || 'x produto (sem estoque acabado)',
                    NEW.id
                );
            END LOOP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Função para reverter estoque na exclusão de venda
CREATE OR REPLACE FUNCTION public.reverter_estoque_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    movimento RECORD;
    produto_info RECORD;
BEGIN
    IF OLD.produto_id IS NOT NULL THEN
        FOR movimento IN 
            SELECT * FROM estoque_movimentos 
            WHERE referencia = OLD.id AND origem = 'venda'
        LOOP
            INSERT INTO estoque_movimentos (
                empresa_id,
                insumo_id,
                tipo,
                quantidade,
                origem,
                observacao,
                referencia
            ) VALUES (
                movimento.empresa_id,
                movimento.insumo_id,
                'entrada',
                movimento.quantidade,
                'estorno_venda',
                'Estorno automático - Venda excluída',
                OLD.id
            );
        END LOOP;
        
        SELECT INTO produto_info estoque_acabado FROM produtos WHERE id = OLD.produto_id;
        
        IF NOT EXISTS (SELECT 1 FROM estoque_movimentos WHERE referencia = OLD.id AND origem = 'venda') THEN
            UPDATE produtos
            SET estoque_acabado = estoque_acabado + OLD.quantidade
            WHERE id = OLD.produto_id;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$;

-- Função para obter insumos com estoque baixo
CREATE OR REPLACE FUNCTION public.get_insumos_estoque_baixo(p_empresa_id UUID)
RETURNS TABLE(id UUID, nome TEXT, unidade_medida TEXT, estoque_atual NUMERIC, estoque_minimo NUMERIC, custo_unitario NUMERIC)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    nome,
    unidade_medida,
    estoque_atual,
    estoque_minimo,
    custo_unitario
  FROM insumos
  WHERE empresa_id = p_empresa_id
    AND estoque_atual <= estoque_minimo
  ORDER BY (estoque_minimo - estoque_atual) DESC;
$$;

-- Função para dashboard de vendas
CREATE OR REPLACE FUNCTION public.get_dashboard_vendas(p_empresa_id UUID, p_data_inicio DATE, p_data_fim DATE)
RETURNS TABLE(id UUID, data_venda DATE, valor_total NUMERIC, quantidade NUMERIC, canal TEXT, produto_id UUID, produto_nome TEXT, produto_preco_venda NUMERIC, custo_insumos NUMERIC)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    v.id,
    v.data_venda::date,
    v.valor_total,
    v.quantidade,
    v.canal,
    v.produto_id,
    p.nome AS produto_nome,
    p.preco_venda AS produto_preco_venda,
    COALESCE(
      (SELECT SUM(ft.quantidade * i.custo_unitario)
       FROM fichas_tecnicas ft
       JOIN insumos i ON i.id = ft.insumo_id
       WHERE ft.produto_id = p.id), 
      0
    ) AS custo_insumos
  FROM vendas v
  LEFT JOIN produtos p ON p.id = v.produto_id
  WHERE v.empresa_id = p_empresa_id
    AND v.data_venda >= p_data_inicio
    AND v.data_venda <= p_data_fim
  ORDER BY v.data_venda DESC;
$$;

-- Função para top produtos
CREATE OR REPLACE FUNCTION public.get_top_produtos(p_empresa_id UUID, p_data_inicio DATE, p_data_fim DATE, p_limit INTEGER DEFAULT 5)
RETURNS TABLE(produto_id UUID, nome TEXT, receita NUMERIC, custo NUMERIC, lucro NUMERIC, quantidade NUMERIC)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH vendas_periodo AS (
    SELECT 
      v.produto_id,
      p.nome,
      p.preco_venda,
      SUM(v.valor_total) AS receita,
      CASE 
        WHEN p.preco_venda > 0 THEN SUM(v.valor_total / p.preco_venda)
        ELSE SUM(v.quantidade)
      END AS unidades
    FROM vendas v
    JOIN produtos p ON p.id = v.produto_id
    WHERE v.empresa_id = p_empresa_id
      AND v.data_venda >= p_data_inicio
      AND v.data_venda <= p_data_fim
      AND v.produto_id IS NOT NULL
    GROUP BY v.produto_id, p.nome, p.preco_venda
  ),
  custos AS (
    SELECT 
      ft.produto_id,
      SUM(ft.quantidade * i.custo_unitario) AS custo_unitario
    FROM fichas_tecnicas ft
    JOIN insumos i ON i.id = ft.insumo_id
    GROUP BY ft.produto_id
  )
  SELECT 
    vp.produto_id,
    vp.nome,
    vp.receita,
    COALESCE(c.custo_unitario * vp.unidades, 0) AS custo,
    vp.receita - COALESCE(c.custo_unitario * vp.unidades, 0) AS lucro,
    vp.unidades AS quantidade
  FROM vendas_periodo vp
  LEFT JOIN custos c ON c.produto_id = vp.produto_id
  ORDER BY lucro DESC
  LIMIT p_limit;
$$;
