
-- Tabela principal de encomendas
CREATE TABLE public.encomendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL,
  cliente_whatsapp text,
  data_entrega date NOT NULL,
  hora_entrega text,
  local_entrega text,
  observacoes text,
  status text NOT NULL DEFAULT 'pendente',
  valor_sinal numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  forma_pagamento text DEFAULT 'dinheiro',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de itens da encomenda (múltiplos produtos)
CREATE TABLE public.encomenda_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encomenda_id uuid NOT NULL REFERENCES public.encomendas(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  produto_nome text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 1,
  preco_unitario numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_encomendas_empresa_data ON public.encomendas(empresa_id, data_entrega);
CREATE INDEX idx_encomendas_status ON public.encomendas(empresa_id, status);
CREATE INDEX idx_encomenda_itens_encomenda ON public.encomenda_itens(encomenda_id);

-- RLS
ALTER TABLE public.encomendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encomenda_itens ENABLE ROW LEVEL SECURITY;

-- Policies encomendas
CREATE POLICY "Users can view empresa encomendas" ON public.encomendas
  FOR SELECT TO authenticated USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa encomendas" ON public.encomendas
  FOR INSERT TO authenticated WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update empresa encomendas" ON public.encomendas
  FOR UPDATE TO authenticated USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete empresa encomendas" ON public.encomendas
  FOR DELETE TO authenticated USING (empresa_id = get_user_empresa_id());

-- Policies encomenda_itens (via join com encomendas)
CREATE POLICY "Users can view encomenda_itens" ON public.encomenda_itens
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.encomendas e
    WHERE e.id = encomenda_itens.encomenda_id AND e.empresa_id = get_user_empresa_id()
  ));

CREATE POLICY "Users can insert encomenda_itens" ON public.encomenda_itens
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.encomendas e
    WHERE e.id = encomenda_itens.encomenda_id AND e.empresa_id = get_user_empresa_id()
  ));

CREATE POLICY "Users can update encomenda_itens" ON public.encomenda_itens
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.encomendas e
    WHERE e.id = encomenda_itens.encomenda_id AND e.empresa_id = get_user_empresa_id()
  ));

CREATE POLICY "Users can delete encomenda_itens" ON public.encomenda_itens
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.encomendas e
    WHERE e.id = encomenda_itens.encomenda_id AND e.empresa_id = get_user_empresa_id()
  ));

-- Trigger para updated_at
CREATE TRIGGER update_encomendas_updated_at
  BEFORE UPDATE ON public.encomendas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
