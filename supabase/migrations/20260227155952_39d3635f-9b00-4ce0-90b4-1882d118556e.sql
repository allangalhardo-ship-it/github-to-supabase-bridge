
-- Novas colunas financeiras na tabela vendas
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS numero_pedido_externo text,
  ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_entrega numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_servico numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentivo_plataforma numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentivo_loja numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_plataforma numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_liquido numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plataforma text;

-- Tabela de mapeamento de nomes externos para auto-link
CREATE TABLE IF NOT EXISTS public.produto_nome_externo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome_externo text NOT NULL,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  plataforma text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, nome_externo, plataforma)
);

-- RLS para produto_nome_externo
ALTER TABLE public.produto_nome_externo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view empresa produto_nome_externo"
  ON public.produto_nome_externo FOR SELECT
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa produto_nome_externo"
  ON public.produto_nome_externo FOR INSERT
  WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update empresa produto_nome_externo"
  ON public.produto_nome_externo FOR UPDATE
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete empresa produto_nome_externo"
  ON public.produto_nome_externo FOR DELETE
  USING (empresa_id = get_user_empresa_id());

-- Índice para busca rápida por nome externo
CREATE INDEX IF NOT EXISTS idx_produto_nome_externo_busca
  ON public.produto_nome_externo(empresa_id, nome_externo, plataforma);
