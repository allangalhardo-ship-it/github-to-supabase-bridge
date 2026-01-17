
-- =====================================================
-- FINAL SECURITY FIXES
-- =====================================================

-- 1. Fix access_logs - Allow admins to view (already created in previous migration)
-- The service role policy is correct, and admin policy was added

-- 2. Fix empresas table - Add proper DELETE policy and strengthen INSERT
DROP POLICY IF EXISTS "Users can insert empresa during signup" ON public.empresas;
DROP POLICY IF EXISTS "Users can view own empresa" ON public.empresas;

-- Only allow empresa creation during bootstrap (edge function uses service role)
-- This removes the race condition by not allowing direct client INSERT
CREATE POLICY "Service role can manage empresas" 
ON public.empresas FOR ALL TO service_role
USING (true);

-- Authenticated users can only view their own empresa
CREATE POLICY "Users can view their own empresa" 
ON public.empresas FOR SELECT TO authenticated
USING (id = get_user_empresa_id());

-- Admins can view all empresas
CREATE POLICY "Admins can view all empresas" 
ON public.empresas FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete empresas
CREATE POLICY "Admins can delete empresas" 
ON public.empresas FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 3. Ensure access_logs has proper admin access (in case previous migration didn't apply correctly)
DROP POLICY IF EXISTS "Service role only access_logs" ON public.access_logs;
DROP POLICY IF EXISTS "Admins can view all access_logs" ON public.access_logs;

CREATE POLICY "Service role manages access_logs" 
ON public.access_logs FOR ALL TO service_role
USING (true);

CREATE POLICY "Admins can read access_logs" 
ON public.access_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));
