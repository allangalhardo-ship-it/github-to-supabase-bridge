
-- Grupos de opcionais vinculados a produtos
CREATE TABLE public.grupos_opcionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  min_selecao INT NOT NULL DEFAULT 0,
  max_selecao INT NOT NULL DEFAULT 1,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itens dentro de cada grupo opcional
CREATE TABLE public.itens_opcionais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grupo_id UUID NOT NULL REFERENCES public.grupos_opcionais(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  preco_adicional NUMERIC NOT NULL DEFAULT 0,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.grupos_opcionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_opcionais ENABLE ROW LEVEL SECURITY;

-- Políticas para grupos_opcionais
CREATE POLICY "Leitura pública de grupos opcionais"
  ON public.grupos_opcionais FOR SELECT
  USING (true);

CREATE POLICY "Donos gerenciam grupos opcionais"
  ON public.grupos_opcionais FOR ALL
  USING (empresa_id = (SELECT get_user_empresa_id()));

-- Políticas para itens_opcionais
CREATE POLICY "Leitura pública de itens opcionais"
  ON public.itens_opcionais FOR SELECT
  USING (true);

CREATE POLICY "Donos gerenciam itens opcionais"
  ON public.itens_opcionais FOR ALL
  USING (
    grupo_id IN (
      SELECT id FROM public.grupos_opcionais 
      WHERE empresa_id = (SELECT get_user_empresa_id())
    )
  );

-- Índices
CREATE INDEX idx_grupos_opcionais_produto ON public.grupos_opcionais(produto_id);
CREATE INDEX idx_itens_opcionais_grupo ON public.itens_opcionais(grupo_id);
