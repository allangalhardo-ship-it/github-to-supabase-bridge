ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS idempotency_key uuid;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_empresa_idempotency_key_unique UNIQUE (empresa_id, idempotency_key);