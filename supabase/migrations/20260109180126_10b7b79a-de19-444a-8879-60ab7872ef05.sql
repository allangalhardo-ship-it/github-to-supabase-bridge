-- Adiciona coluna para identificar se o insumo é intermediário (base/preparação)
ALTER TABLE public.insumos
ADD COLUMN is_intermediario boolean NOT NULL DEFAULT false;

-- Adiciona comentário explicativo
COMMENT ON COLUMN public.insumos.is_intermediario IS 'Indica se o insumo é um produto intermediário (ex: ganache, recheio) que possui sua própria receita/ficha técnica';

-- Cria tabela para armazenar a ficha técnica de produtos intermediários
CREATE TABLE public.receitas_intermediarias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insumo_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  insumo_ingrediente_id uuid NOT NULL REFERENCES public.insumos(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(insumo_id, insumo_ingrediente_id)
);

-- Habilita RLS
ALTER TABLE public.receitas_intermediarias ENABLE ROW LEVEL SECURITY;

-- Policies para receitas_intermediarias (baseadas no insumo pai)
CREATE POLICY "Users can view receitas_intermediarias"
ON public.receitas_intermediarias
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM insumos i
  WHERE i.id = receitas_intermediarias.insumo_id
  AND i.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can insert receitas_intermediarias"
ON public.receitas_intermediarias
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM insumos i
  WHERE i.id = receitas_intermediarias.insumo_id
  AND i.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can update receitas_intermediarias"
ON public.receitas_intermediarias
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM insumos i
  WHERE i.id = receitas_intermediarias.insumo_id
  AND i.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can delete receitas_intermediarias"
ON public.receitas_intermediarias
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM insumos i
  WHERE i.id = receitas_intermediarias.insumo_id
  AND i.empresa_id = get_user_empresa_id()
));

-- Adiciona coluna rendimento_padrao nos insumos intermediários
ALTER TABLE public.insumos
ADD COLUMN rendimento_receita numeric DEFAULT NULL;

COMMENT ON COLUMN public.insumos.rendimento_receita IS 'Quantidade que a receita do intermediário rende (ex: 1 receita de ganache rende 0.5 kg)';