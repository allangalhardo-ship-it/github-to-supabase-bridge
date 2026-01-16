-- Add missing RLS policies to fix security warnings

-- 1. Add UPDATE policy for empresas table
CREATE POLICY "Users can update own empresa"
ON public.empresas
FOR UPDATE
USING (id = get_user_empresa_id());

-- 2. Add DELETE policy for usuarios table (for GDPR/LGPD compliance)
CREATE POLICY "Users can delete own profile"
ON public.usuarios
FOR DELETE
USING (id = auth.uid());

-- 3. Add UPDATE and DELETE policies for user_roles table (admin only)
CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- 4. Add UPDATE policy for estoque_movimentos table
CREATE POLICY "Users can update empresa estoque_movimentos"
ON public.estoque_movimentos
FOR UPDATE
USING (empresa_id = get_user_empresa_id());

-- 5. Add UPDATE policy for xml_notas table
CREATE POLICY "Users can update empresa xml_notas"
ON public.xml_notas
FOR UPDATE
USING (empresa_id = get_user_empresa_id());

-- 6. Add DELETE policy for xml_itens table
CREATE POLICY "Users can delete xml_itens"
ON public.xml_itens
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM xml_notas n
  WHERE n.id = xml_itens.xml_id
  AND n.empresa_id = get_user_empresa_id()
));

-- 7. Add DELETE policy for configuracoes table
CREATE POLICY "Users can delete empresa configuracoes"
ON public.configuracoes
FOR DELETE
USING (empresa_id = get_user_empresa_id());