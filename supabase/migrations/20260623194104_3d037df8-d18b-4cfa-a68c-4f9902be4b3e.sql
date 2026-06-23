UPDATE public.ai_quotas SET daily_limit = 3 WHERE feature = 'daily_summary' AND plan = 'standard';
UPDATE public.ai_quotas SET daily_limit = 10 WHERE feature = 'daily_summary' AND plan = 'pro';
DELETE FROM public.ai_usage WHERE feature = 'daily_summary' AND date = CURRENT_DATE;
DELETE FROM public.ai_cache WHERE feature = 'daily_summary';