-- Criar tabela de preços por canal de venda
-- Cada produto pode ter um preço diferente para cada canal
CREATE TABLE public.precos_canais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  canal TEXT NOT NULL, -- 'balcao' ou ID do taxas_apps
  preco NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Um produto só pode ter um preço por canal
  UNIQUE(produto_id, canal)
);

-- Enable Row Level Security
ALTER TABLE public.precos_canais ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view empresa precos_canais" 
ON public.precos_canais 
FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa precos_canais" 
ON public.precos_canais 
FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update empresa precos_canais" 
ON public.precos_canais 
FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete empresa precos_canais" 
ON public.precos_canais 
FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_precos_canais_updated_at
BEFORE UPDATE ON public.precos_canais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();