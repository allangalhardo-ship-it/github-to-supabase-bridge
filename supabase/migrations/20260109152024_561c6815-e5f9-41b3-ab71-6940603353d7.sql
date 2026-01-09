-- Create table for app-specific delivery fees
CREATE TABLE public.taxas_apps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL,
  nome_app TEXT NOT NULL,
  taxa_percentual NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, nome_app)
);

-- Enable RLS
ALTER TABLE public.taxas_apps ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view empresa taxas_apps" 
ON public.taxas_apps FOR SELECT 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can insert empresa taxas_apps" 
ON public.taxas_apps FOR INSERT 
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can update empresa taxas_apps" 
ON public.taxas_apps FOR UPDATE 
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Users can delete empresa taxas_apps" 
ON public.taxas_apps FOR DELETE 
USING (empresa_id = get_user_empresa_id());

-- Add trigger for updated_at
CREATE TRIGGER update_taxas_apps_updated_at
BEFORE UPDATE ON public.taxas_apps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();