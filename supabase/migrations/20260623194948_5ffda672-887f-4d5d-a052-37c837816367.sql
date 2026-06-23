CREATE TABLE public.ai_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_threads TO authenticated;
GRANT ALL ON public.ai_chat_threads TO service_role;

ALTER TABLE public.ai_chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem suas próprias threads"
  ON public.ai_chat_threads FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND empresa_id = public.get_user_empresa_id());

CREATE POLICY "Usuários criam threads na sua empresa"
  ON public.ai_chat_threads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND empresa_id = public.get_user_empresa_id());

CREATE POLICY "Usuários atualizam suas próprias threads"
  ON public.ai_chat_threads FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND empresa_id = public.get_user_empresa_id());

CREATE POLICY "Usuários deletam suas próprias threads"
  ON public.ai_chat_threads FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND empresa_id = public.get_user_empresa_id());

CREATE INDEX idx_ai_chat_threads_user_updated ON public.ai_chat_threads(user_id, updated_at DESC);
CREATE INDEX idx_ai_chat_threads_empresa ON public.ai_chat_threads(empresa_id);

CREATE TRIGGER trg_ai_chat_threads_updated
  BEFORE UPDATE ON public.ai_chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.ai_chat_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL DEFAULT '',
  parts JSONB,
  ai_msg_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_messages TO authenticated;
GRANT ALL ON public.ai_chat_messages TO service_role;

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem mensagens das suas threads"
  ON public.ai_chat_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ai_chat_threads t
    WHERE t.id = ai_chat_messages.thread_id
      AND t.user_id = auth.uid()
  ));

CREATE POLICY "Usuários criam mensagens nas suas threads"
  ON public.ai_chat_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_chat_threads t
    WHERE t.id = ai_chat_messages.thread_id
      AND t.user_id = auth.uid()
  ));

CREATE POLICY "Usuários deletam mensagens das suas threads"
  ON public.ai_chat_messages FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ai_chat_threads t
    WHERE t.id = ai_chat_messages.thread_id
      AND t.user_id = auth.uid()
  ));

CREATE INDEX idx_ai_chat_messages_thread_created ON public.ai_chat_messages(thread_id, created_at);

INSERT INTO public.ai_quotas (feature, plan, daily_limit)
VALUES
  ('chat', 'standard', 30),
  ('chat', 'pro', 150)
ON CONFLICT (feature, plan) DO UPDATE SET daily_limit = EXCLUDED.daily_limit;