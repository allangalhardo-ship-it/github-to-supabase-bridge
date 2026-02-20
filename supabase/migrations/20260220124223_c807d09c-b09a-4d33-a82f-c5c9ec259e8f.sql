
-- Enhance pedidos table for multi-step checkout
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS numero_pedido SERIAL,
  ADD COLUMN IF NOT EXISTS tipo_entrega TEXT NOT NULL DEFAULT 'retirada',
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT NOT NULL DEFAULT 'dinheiro',
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
  ADD COLUMN IF NOT EXISTS cliente_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS troco_para NUMERIC,
  ADD COLUMN IF NOT EXISTS confirmado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preparando_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pronto_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entregue_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

-- Allow public (anonymous) users to view their own pedido by id for tracking
CREATE POLICY "Public can view pedido by id" ON public.pedidos
  FOR SELECT USING (origem = 'cardapio');

-- Allow public to update pedidos they created (for cancellation only won't be used yet)
-- We already have "Public can insert pedidos via link" which uses origem='link'
-- Update it to also allow origem='cardapio'
DROP POLICY IF EXISTS "Public can insert pedidos via link" ON public.pedidos;
CREATE POLICY "Public can insert pedidos via cardapio" ON public.pedidos
  FOR INSERT WITH CHECK (origem IN ('link', 'cardapio'));
