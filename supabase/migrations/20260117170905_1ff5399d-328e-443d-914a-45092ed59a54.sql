
-- =====================================================
-- SECURITY FIXES: Strengthen RLS Policies
-- =====================================================

-- 1. Fix clientes table - ensure only authenticated users with correct empresa_id
DROP POLICY IF EXISTS "Users can view empresa clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can insert empresa clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can update empresa clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can delete empresa clientes" ON public.clientes;

CREATE POLICY "Authenticated users can view their empresa clientes" 
ON public.clientes FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Authenticated users can insert their empresa clientes" 
ON public.clientes FOR INSERT TO authenticated
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Authenticated users can update their empresa clientes" 
ON public.clientes FOR UPDATE TO authenticated
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Authenticated users can delete their empresa clientes" 
ON public.clientes FOR DELETE TO authenticated
USING (empresa_id = get_user_empresa_id());

-- 2. Fix caixa_movimentos - ensure only authenticated
DROP POLICY IF EXISTS "Users can view empresa caixa_movimentos" ON public.caixa_movimentos;
DROP POLICY IF EXISTS "Users can insert empresa caixa_movimentos" ON public.caixa_movimentos;
DROP POLICY IF EXISTS "Users can update empresa caixa_movimentos" ON public.caixa_movimentos;
DROP POLICY IF EXISTS "Users can delete empresa caixa_movimentos" ON public.caixa_movimentos;

CREATE POLICY "Authenticated users can view their empresa caixa" 
ON public.caixa_movimentos FOR SELECT TO authenticated
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Authenticated users can insert their empresa caixa" 
ON public.caixa_movimentos FOR INSERT TO authenticated
WITH CHECK (empresa_id = get_user_empresa_id());

CREATE POLICY "Authenticated users can update their empresa caixa" 
ON public.caixa_movimentos FOR UPDATE TO authenticated
USING (empresa_id = get_user_empresa_id());

CREATE POLICY "Authenticated users can delete their empresa caixa" 
ON public.caixa_movimentos FOR DELETE TO authenticated
USING (empresa_id = get_user_empresa_id());

-- 3. Strengthen access_logs - service role only (already correct, just verify)
DROP POLICY IF EXISTS "Service role only" ON public.access_logs;
CREATE POLICY "Service role only access_logs" 
ON public.access_logs FOR ALL TO service_role
USING (true);

-- 4. Strengthen user_sessions - service role only
DROP POLICY IF EXISTS "Service role only" ON public.user_sessions;
CREATE POLICY "Service role only user_sessions" 
ON public.user_sessions FOR ALL TO service_role
USING (true);

-- 5. Ensure usuarios table is properly protected
DROP POLICY IF EXISTS "Users can view own profile" ON public.usuarios;
DROP POLICY IF EXISTS "Users can update own profile" ON public.usuarios;
DROP POLICY IF EXISTS "Users can insert own profile during signup" ON public.usuarios;

CREATE POLICY "Users can view only their own profile" 
ON public.usuarios FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update only their own profile" 
ON public.usuarios FOR UPDATE TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can insert their profile during signup" 
ON public.usuarios FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- 6. Add admin access to usuarios for admin panel
CREATE POLICY "Admins can view all usuarios" 
ON public.usuarios FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 7. Add admin access to user_sessions for admin panel
CREATE POLICY "Admins can view all sessions" 
ON public.user_sessions FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 8. Add admin access to access_logs for admin panel
CREATE POLICY "Admins can view all access_logs" 
ON public.access_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));
