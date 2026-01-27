-- 1. Criar tabela de Canais de Venda
CREATE TABLE public.canais_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'app_delivery', -- 'presencial', 'app_delivery', 'proprio'
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Criar tabela de Taxas por Canal (múltiplas por canal)
CREATE TABLE public.taxas_canais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal_id uuid NOT NULL REFERENCES public.canais_venda(id) ON DELETE CASCADE,
  nome text NOT NULL,
  percentual numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Habilitar RLS nas novas tabelas
ALTER TABLE public.canais_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxas_canais ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para canais_venda
CREATE POLICY "Users can view empresa canais_venda"
ON public.canais_venda FOR SELECT
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa canais_venda"
ON public.canais_venda FOR INSERT
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update empresa canais_venda"
ON public.canais_venda FOR UPDATE
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete empresa canais_venda"
ON public.canais_venda FOR DELETE
USING (empresa_id = get_user_empresa_id());

-- 5. Políticas RLS para taxas_canais (via canal_id -> empresa_id)
CREATE POLICY "Users can view taxas_canais"
ON public.taxas_canais FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.canais_venda cv
  WHERE cv.id = taxas_canais.canal_id
  AND cv.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can insert taxas_canais"
ON public.taxas_canais FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.canais_venda cv
  WHERE cv.id = taxas_canais.canal_id
  AND cv.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can update taxas_canais"
ON public.taxas_canais FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.canais_venda cv
  WHERE cv.id = taxas_canais.canal_id
  AND cv.empresa_id = get_user_empresa_id()
));

CREATE POLICY "Users can delete taxas_canais"
ON public.taxas_canais FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.canais_venda cv
  WHERE cv.id = taxas_canais.canal_id
  AND cv.empresa_id = get_user_empresa_id()
));

-- 6. Trigger para updated_at
CREATE TRIGGER update_canais_venda_updated_at
BEFORE UPDATE ON public.canais_venda
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Migrar dados existentes de taxas_apps para nova estrutura
-- Para cada registro em taxas_apps, criar um canal_venda e uma taxa_canal
INSERT INTO public.canais_venda (id, empresa_id, nome, tipo, ativo, created_at, updated_at)
SELECT id, empresa_id, nome_app, 'app_delivery', ativo, created_at, updated_at
FROM public.taxas_apps;

INSERT INTO public.taxas_canais (canal_id, nome, percentual, created_at)
SELECT id, 'Taxa total', taxa_percentual, created_at
FROM public.taxas_apps;

-- 8. Criar canal Balcão padrão para empresas que ainda não têm
INSERT INTO public.canais_venda (empresa_id, nome, tipo, ativo)
SELECT DISTINCT e.id, 'Balcão', 'presencial', true
FROM public.empresas e
WHERE NOT EXISTS (
  SELECT 1 FROM public.canais_venda cv 
  WHERE cv.empresa_id = e.id AND cv.tipo = 'presencial'
);