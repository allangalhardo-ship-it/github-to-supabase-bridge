-- Adicionar campos extras na tabela clientes
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS data_nascimento DATE,
ADD COLUMN IF NOT EXISTS endereco_rua TEXT,
ADD COLUMN IF NOT EXISTS endereco_numero TEXT,
ADD COLUMN IF NOT EXISTS endereco_complemento TEXT,
ADD COLUMN IF NOT EXISTS endereco_bairro TEXT,
ADD COLUMN IF NOT EXISTS endereco_cidade TEXT,
ADD COLUMN IF NOT EXISTS endereco_estado TEXT,
ADD COLUMN IF NOT EXISTS endereco_cep TEXT,
ADD COLUMN IF NOT EXISTS observacoes TEXT,
ADD COLUMN IF NOT EXISTS preferencias TEXT;

-- Criar tabela de pedidos (para o formulário compartilhável)
CREATE TABLE IF NOT EXISTS public.pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  itens JSONB NOT NULL DEFAULT '[]',
  valor_total NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  data_entrega DATE,
  hora_entrega TEXT,
  endereco_entrega TEXT,
  origem TEXT NOT NULL DEFAULT 'link',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para pedidos
CREATE POLICY "Users can view empresa pedidos"
ON public.pedidos FOR SELECT
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa pedidos"
ON public.pedidos FOR INSERT
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update empresa pedidos"
ON public.pedidos FOR UPDATE
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete empresa pedidos"
ON public.pedidos FOR DELETE
USING (empresa_id = get_user_empresa_id());

-- Política pública para inserção via link (sem autenticação)
CREATE POLICY "Public can insert pedidos via link"
ON public.pedidos FOR INSERT
WITH CHECK (origem = 'link');

-- Trigger para updated_at
CREATE TRIGGER update_pedidos_updated_at
BEFORE UPDATE ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();