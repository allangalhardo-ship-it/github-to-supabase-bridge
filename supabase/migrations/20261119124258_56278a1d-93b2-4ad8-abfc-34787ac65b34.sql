ALTER TABLE public.encomendas
  ADD COLUMN IF NOT EXISTS canal_id uuid REFERENCES public.canais_venda(id),
  ADD COLUMN IF NOT EXISTS desconto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sinal_data date,
  ADD COLUMN IF NOT EXISTS sinal_forma_pagamento text,
  ADD COLUMN IF NOT EXISTS sinal_devolvido boolean,
  ADD COLUMN IF NOT EXISTS pedido_id uuid;
ALTER TABLE public.insumos ADD COLUMN IF NOT EXISTS tempo_preparo_min numeric;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS tempo_preparo_min numeric;
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS horas_producao_semana numeric;