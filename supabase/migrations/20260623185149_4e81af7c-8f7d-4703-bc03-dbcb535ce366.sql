
-- 1. AI CACHE
CREATE TABLE public.ai_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  response JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, feature, cache_key)
);

CREATE INDEX idx_ai_cache_lookup ON public.ai_cache (empresa_id, feature, cache_key, expires_at);
CREATE INDEX idx_ai_cache_expires ON public.ai_cache (expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_cache TO authenticated;
GRANT ALL ON public.ai_cache TO service_role;
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Empresa pode gerenciar seu cache"
ON public.ai_cache FOR ALL
TO authenticated
USING (empresa_id = public.get_user_empresa_id())
WITH CHECK (empresa_id = public.get_user_empresa_id());

-- 2. AI QUOTAS (limites por feature/plano)
CREATE TABLE public.ai_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  plan TEXT NOT NULL,
  daily_limit INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (feature, plan)
);

GRANT SELECT ON public.ai_quotas TO authenticated;
GRANT ALL ON public.ai_quotas TO service_role;
ALTER TABLE public.ai_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer autenticado pode ler quotas"
ON public.ai_quotas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Apenas admins alteram quotas"
ON public.ai_quotas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.ai_quotas (feature, plan, daily_limit) VALUES
  ('daily_summary', 'standard', 1),
  ('daily_summary', 'pro', 1),
  ('voice_recipe', 'standard', 20),
  ('voice_recipe', 'pro', 100),
  ('simulator', 'standard', 10),
  ('simulator', 'pro', 50),
  ('assistant', 'standard', 30),
  ('assistant', 'pro', 200);

-- 3. AI USAGE: adiciona feature e tokens_used
ALTER TABLE public.ai_usage ADD COLUMN IF NOT EXISTS feature TEXT NOT NULL DEFAULT 'assistant';
ALTER TABLE public.ai_usage ADD COLUMN IF NOT EXISTS tokens_used INTEGER NOT NULL DEFAULT 0;

-- Recria unique para incluir feature
ALTER TABLE public.ai_usage DROP CONSTRAINT IF EXISTS ai_usage_user_id_empresa_id_date_key;
ALTER TABLE public.ai_usage DROP CONSTRAINT IF EXISTS ai_usage_empresa_feature_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_empresa_feature_date_idx
  ON public.ai_usage (empresa_id, feature, date);

-- 4. RPC check_and_increment_ai_quota
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_quota(
  p_empresa_id UUID,
  p_feature TEXT,
  p_plan TEXT DEFAULT 'standard',
  p_tokens INTEGER DEFAULT 0
)
RETURNS TABLE(allowed BOOLEAN, used INTEGER, daily_limit INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_used INTEGER := 0;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  SELECT q.daily_limit INTO v_limit
  FROM public.ai_quotas q
  WHERE q.feature = p_feature AND q.plan = p_plan
  LIMIT 1;

  IF v_limit IS NULL THEN
    v_limit := 10;
  END IF;

  SELECT COALESCE(u.message_count, 0) INTO v_used
  FROM public.ai_usage u
  WHERE u.empresa_id = p_empresa_id
    AND u.feature = p_feature
    AND u.date = CURRENT_DATE;

  IF v_used >= v_limit THEN
    RETURN QUERY SELECT false, v_used, v_limit;
    RETURN;
  END IF;

  INSERT INTO public.ai_usage (user_id, empresa_id, feature, date, message_count, tokens_used)
  VALUES (COALESCE(v_user_id, p_empresa_id), p_empresa_id, p_feature, CURRENT_DATE, 1, p_tokens)
  ON CONFLICT (empresa_id, feature, date)
  DO UPDATE SET
    message_count = public.ai_usage.message_count + 1,
    tokens_used = public.ai_usage.tokens_used + p_tokens,
    updated_at = now();

  RETURN QUERY SELECT true, v_used + 1, v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_quota(UUID, TEXT, TEXT, INTEGER) TO authenticated, service_role;

-- 5. Função helper para limpar cache expirado
CREATE OR REPLACE FUNCTION public.cleanup_ai_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.ai_cache WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_ai_cache() TO authenticated, service_role;
