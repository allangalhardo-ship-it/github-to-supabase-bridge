-- Create clientes table
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome TEXT NOT NULL,
  whatsapp TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view empresa clientes" 
ON public.clientes 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa clientes" 
ON public.clientes 
FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update empresa clientes" 
ON public.clientes 
FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete empresa clientes" 
ON public.clientes 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Add trigger for updated_at
CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add cliente_id to vendas table
ALTER TABLE public.vendas ADD COLUMN cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

-- Add tipo_venda to vendas (direto ou app)
ALTER TABLE public.vendas ADD COLUMN tipo_venda TEXT NOT NULL DEFAULT 'direto';