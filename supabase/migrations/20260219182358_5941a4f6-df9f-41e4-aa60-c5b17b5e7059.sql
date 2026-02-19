
-- Fix overly permissive RLS policies

-- 1. empresas: Replace "Service role can manage empresas" FOR ALL USING (true)
-- This policy is too broad. Service role bypasses RLS anyway, so this policy
-- effectively gives ALL authenticated users full access.
DROP POLICY IF EXISTS "Service role can manage empresas" ON public.empresas;

-- Add missing INSERT policy for empresas (needed by bootstrap-account edge function via service role)
-- Service role already bypasses RLS, so no replacement needed.

-- 2. user_sessions: Replace "Service role only user_sessions" FOR ALL USING (true)
DROP POLICY IF EXISTS "Service role only user_sessions" ON public.user_sessions;

-- Users should be able to manage their own sessions
CREATE POLICY "Users can manage own sessions" ON public.user_sessions
    FOR ALL USING (user_id = auth.uid());

-- 3. access_logs: Replace "Service role manages access_logs" FOR ALL USING (true)
DROP POLICY IF EXISTS "Service role manages access_logs" ON public.access_logs;

-- Users can insert their own access logs
CREATE POLICY "Users can insert own access_logs" ON public.access_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());
