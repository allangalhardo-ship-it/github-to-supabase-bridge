import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { UIMessage } from "ai";

export interface ChatThread {
  id: string;
  title: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DbMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  parts: any;
  ai_msg_id: string | null;
  created_at: string;
}

function dbMessageToUIMessage(m: DbMessage): UIMessage {
  if (m.parts && Array.isArray(m.parts) && m.parts.length > 0) {
    return {
      id: m.ai_msg_id || m.id,
      role: m.role as any,
      parts: m.parts,
    } as UIMessage;
  }
  return {
    id: m.ai_msg_id || m.id,
    role: m.role as any,
    parts: [{ type: "text", text: m.content }],
  } as UIMessage;
}

export function useChatThreads() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_chat_threads")
      .select("id, title, message_count, last_message_at, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (!error && data) setThreads(data as ChatThread[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const createThread = useCallback(async (): Promise<string | null> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("empresa_id")
      .eq("id", userData.user.id)
      .single();
    if (!usuario?.empresa_id) return null;
    const { data, error } = await supabase
      .from("ai_chat_threads")
      .insert({
        empresa_id: usuario.empresa_id,
        user_id: userData.user.id,
        title: "Nova conversa",
      })
      .select("id")
      .single();
    if (error || !data) return null;
    await fetchThreads();
    return data.id;
  }, [fetchThreads]);

  const deleteThread = useCallback(async (id: string) => {
    await supabase.from("ai_chat_threads").delete().eq("id", id);
    await fetchThreads();
  }, [fetchThreads]);

  const renameThread = useCallback(async (id: string, title: string) => {
    await supabase.from("ai_chat_threads").update({ title }).eq("id", id);
    await fetchThreads();
  }, [fetchThreads]);

  return { threads, loading, fetchThreads, createThread, deleteThread, renameThread };
}

export async function loadThreadMessages(threadId: string): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from("ai_chat_messages")
    .select("id, role, content, parts, ai_msg_id, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as DbMessage[]).map(dbMessageToUIMessage);
}
