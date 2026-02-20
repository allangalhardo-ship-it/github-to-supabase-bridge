-- =============================================
-- SISTEMA DE PEDIDOS V2 — Migração completa
-- =============================================

-- 1. Novas colunas em empresas
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS chave_pix text,
  ADD COLUMN IF NOT EXISTS entrega_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pedido_minimo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tempo_estimado_entrega text DEFAULT '30-50 min';

-- 2. Nova coluna em produtos
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS descricao_cardapio text,
  ADD COLUMN IF NOT EXISTS destaque boolean NOT NULL DEFAULT false;

-- 3. Tabela de bairros/regiões de entrega
CREATE TABLE IF NOT EXISTS public.bairros_entrega (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  taxa_entrega numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bairros_entrega ENABLE ROW LEVEL SECURITY;

-- Empreendedor gerencia seus bairros
CREATE POLICY "Users can manage empresa bairros_entrega"
  ON public.bairros_entrega FOR ALL
  USING (empresa_id = get_user_empresa_id());

-- Público pode ler bairros de empresas com cardápio ativo
CREATE POLICY "Public can view bairros_entrega"
  ON public.bairros_entrega FOR SELECT
  USING (
    ativo = true
    AND EXISTS (
      SELECT 1 FROM empresas e
      WHERE e.id = bairros_entrega.empresa_id
      AND e.cardapio_ativo = true
    )
  );

-- 4. Novas colunas em pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS taxa_entrega numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bairro_entrega text,
  ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saiu_entrega_em timestamptz;
