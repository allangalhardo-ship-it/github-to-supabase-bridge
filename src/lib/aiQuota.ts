import { supabase } from '@/integrations/supabase/client';

export type AiFeature = 'daily_summary' | 'voice_recipe' | 'simulator' | 'assistant';

export interface QuotaResult {
  allowed: boolean;
  used: number;
  daily_limit: number;
}

/**
 * Verifica e incrementa a quota de IA em uma chamada atômica.
 * Chame ANTES de invocar a edge function de IA.
 * Se `allowed === false`, mostre toast e bloqueie o uso.
 */
export async function checkAndIncrementQuota(
  empresaId: string,
  feature: AiFeature,
  plan: 'standard' | 'pro' = 'standard',
  tokens = 0,
): Promise<QuotaResult> {
  const { data, error } = await supabase.rpc('check_and_increment_ai_quota', {
    p_empresa_id: empresaId,
    p_feature: feature,
    p_plan: plan,
    p_tokens: tokens,
  });

  if (error) {
    console.error('[aiQuota] erro:', error);
    return { allowed: false, used: 0, daily_limit: 0 };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: !!row?.allowed,
    used: row?.used ?? 0,
    daily_limit: row?.daily_limit ?? 0,
  };
}

/**
 * Busca resposta cacheada. Retorna null se não houver ou estiver expirada.
 */
export async function getCachedAiResponse<T = unknown>(
  empresaId: string,
  feature: AiFeature,
  cacheKey: string,
): Promise<T | null> {
  const { data, error } = await supabase
    .from('ai_cache')
    .select('response, expires_at')
    .eq('empresa_id', empresaId)
    .eq('feature', feature)
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return data.response as T;
}

/**
 * Grava resposta no cache. `ttlSeconds` define quando expira.
 */
export async function setCachedAiResponse(
  empresaId: string,
  feature: AiFeature,
  cacheKey: string,
  response: unknown,
  ttlSeconds: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const { error } = await supabase.from('ai_cache').upsert(
    {
      empresa_id: empresaId,
      feature,
      cache_key: cacheKey,
      response: response as never,
      expires_at: expiresAt,
    },
    { onConflict: 'empresa_id,feature,cache_key' },
  );
  if (error) console.error('[aiQuota] cache set erro:', error);
}

/**
 * Helper completo: tenta cache primeiro, se miss verifica quota e chama `fetcher`.
 * Em caso de quota estourada, retorna { data: null, blocked: true }.
 */
export async function withAiCacheAndQuota<T>(opts: {
  empresaId: string;
  feature: AiFeature;
  cacheKey: string;
  ttlSeconds: number;
  plan?: 'standard' | 'pro';
  fetcher: () => Promise<{ data: T; tokens?: number }>;
}): Promise<{ data: T | null; cached: boolean; blocked: boolean; quota?: QuotaResult }> {
  const cached = await getCachedAiResponse<T>(opts.empresaId, opts.feature, opts.cacheKey);
  if (cached) return { data: cached, cached: true, blocked: false };

  const quota = await checkAndIncrementQuota(opts.empresaId, opts.feature, opts.plan ?? 'standard');
  if (!quota.allowed) {
    return { data: null, cached: false, blocked: true, quota };
  }

  const result = await opts.fetcher();
  await setCachedAiResponse(opts.empresaId, opts.feature, opts.cacheKey, result.data, opts.ttlSeconds);
  return { data: result.data, cached: false, blocked: false, quota };
}
