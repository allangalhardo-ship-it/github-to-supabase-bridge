-- Criar tabela de histórico de preços de produtos
CREATE TABLE public.historico_precos_produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  preco_anterior NUMERIC,
  preco_novo NUMERIC NOT NULL,
  variacao_percentual NUMERIC,
  origem TEXT NOT NULL DEFAULT 'manual',
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.historico_precos_produtos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view empresa historico_precos_produtos"
ON public.historico_precos_produtos
FOR SELECT
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa historico_precos_produtos"
ON public.historico_precos_produtos
FOR INSERT
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete empresa historico_precos_produtos"
ON public.historico_precos_produtos
FOR DELETE
USING (empresa_id = get_user_empresa_id());

-- Índices para performance
CREATE INDEX idx_historico_precos_produtos_empresa ON public.historico_precos_produtos(empresa_id);
CREATE INDEX idx_historico_precos_produtos_produto ON public.historico_precos_produtos(produto_id);
CREATE INDEX idx_historico_precos_produtos_created ON public.historico_precos_produtos(created_at DESC);