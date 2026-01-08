-- Corrigir função com search_path mutable
CREATE OR REPLACE FUNCTION public.atualizar_estoque_insumo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo = 'entrada' THEN
        UPDATE public.insumos
        SET estoque_atual = estoque_atual + NEW.quantidade
        WHERE id = NEW.insumo_id;
    ELSIF NEW.tipo = 'saida' THEN
        UPDATE public.insumos
        SET estoque_atual = estoque_atual - NEW.quantidade
        WHERE id = NEW.insumo_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Corrigir política permissiva na tabela empresas
DROP POLICY IF EXISTS "Users can insert empresa during signup" ON public.empresas;

-- Permitir insert apenas durante o signup (antes do perfil existir)
CREATE POLICY "Users can insert empresa during signup"
ON public.empresas FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE id = auth.uid()
  )
);