import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Trash2,
  X,
  PanelLeftOpen,
  PanelLeftClose,
  Send,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useChatThreads, loadThreadMessages } from "@/hooks/useChatThreads";
import mascot from "@/assets/ai-chef-mascot.png";


const SUGESTOES = [
  "Por que meu lucro caiu este mês?",
  "Qual produto tem a pior margem?",
  "Devo reajustar algum preço?",
  "Quanto gastei com insumos nos últimos 30 dias?",
  "Como anda meu fluxo de caixa?",
];

function ThreadList({
  activeId,
  onSelect,
  onNew,
  onDelete,
  threads,
  loading,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  threads: ReturnType<typeof useChatThreads>["threads"];
  loading: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <div className="flex h-full w-full flex-col border-r bg-muted/30">
      <div className="flex items-center justify-between border-b p-3">
        <span className="text-sm font-semibold">Conversas</span>
        <Button size="sm" variant="default" onClick={onNew} className="h-7 gap-1">
          <Plus className="h-3.5 w-3.5" />
          Nova
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {loading && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">Carregando…</div>
          )}
          {!loading && threads.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nenhuma conversa ainda.<br />
              Clique em "Nova" pra começar.
            </div>
          )}
          {threads.map((t) => (
            <div
              key={t.id}
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-accent",
                activeId === t.id && "bg-accent"
              )}
            >
              <button
                onClick={() => onSelect(t.id)}
                className="flex-1 truncate text-left text-xs"
                title={t.title}
              >
                <div className="truncate font-medium">{t.title}</div>
                <div className="text-[10px] text-muted-foreground">
                  {t.message_count} msg
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(t.id);
                }}
                className="rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                title="Excluir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Todas as mensagens dessa conversa serão apagadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) {
                  onDelete(confirmDelete);
                  setConfirmDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChatWindow({
  threadId,
  initialMessages,
  onMessageSent,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  onMessageSent: () => void;
}) {
  const [draft, setDraft] = useState("");

  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
      prepareSendMessagesRequest: async ({ messages, body }) => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: { threadId, messages, ...(body ?? {}) },
        };
      },
    });
  }, [threadId]);

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (err) => {
      const msg = err?.message || "";
      if (msg.includes("quota_excedida") || msg.includes("429")) {
        toast.error("Limite diário de mensagens atingido. Tente novamente amanhã.");
      } else if (msg.includes("402") || msg.includes("credits_exhausted")) {
        toast.error("Créditos de IA esgotados. Avise o suporte.");
      } else {
        toast.error("Erro ao enviar mensagem.");
      }
    },
    onFinish: () => {
      onMessageSent();
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = async (message: { text: string }) => {
    const text = (message.text || draft).trim();
    if (!text || isLoading) return;
    setDraft("");
    await sendMessage({ text });
    onMessageSent();
  };


  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent>
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <img
                src={mascot}
                alt="Assistente IA"
                width={80}
                height={80}
                loading="lazy"
                className="mb-3 h-20 w-20"
              />
              <h3 className="text-base font-semibold">Como posso ajudar?</h3>
              <p className="mb-4 mt-1 max-w-sm text-xs text-muted-foreground">
                Faço análises do seu negócio com base nas vendas, custos, estoque e margens cadastrados.
              </p>
              <div className="flex flex-col gap-2 sm:max-w-sm">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setDraft(s);
                    }}
                    className="rounded-lg border bg-background px-3 py-2 text-left text-xs transition hover:border-primary hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}

              </div>
            </div>
          ) : (
            messages.map((m) => {
              const text = (m.parts || [])
                .filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("");
              return (
                <Message key={m.id} from={m.role}>
                  <MessageContent>
                    {m.role === "assistant" ? (
                      <MessageResponse>{text}</MessageResponse>
                    ) : (
                      <div className="whitespace-pre-wrap">{text}</div>
                    )}
                  </MessageContent>
                </Message>
              );
            })
          )}
          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Pensando…</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t bg-background p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit({ text: draft });
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit({ text: draft });
              }
            }}
            placeholder="Pergunte sobre vendas, custos, margens…"
            disabled={isLoading}
            rows={2}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            autoFocus
          />
          <Button
            type="submit"
            size="icon"
            disabled={!draft.trim() || isLoading}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-[11px] text-destructive">
            Erro ao processar mensagem. Tente de novo.
          </p>
        )}
      </div>

    </div>
  );
}

export default function AiChatBubble() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  const [threadMessages, setThreadMessages] = useState<UIMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const { threads, loading, fetchThreads, createThread, deleteThread } = useChatThreads();
  const activeThreadId = searchParams.get("aiThread");

  // Carregar mensagens da thread ativa
  useEffect(() => {
    if (!activeThreadId || !open) {
      setThreadMessages([]);
      return;
    }
    setLoadingMessages(true);
    loadThreadMessages(activeThreadId)
      .then(setThreadMessages)
      .finally(() => setLoadingMessages(false));
  }, [activeThreadId, open]);

  const handleNew = async () => {
    const id = await createThread();
    if (id) {
      setSearchParams((prev) => {
        prev.set("aiThread", id);
        return prev;
      });
    } else {
      toast.error("Não foi possível criar a conversa.");
    }
  };

  const handleSelect = (id: string) => {
    setSearchParams((prev) => {
      prev.set("aiThread", id);
      return prev;
    });
  };

  const handleDelete = async (id: string) => {
    await deleteThread(id);
    if (activeThreadId === id) {
      setSearchParams((prev) => {
        prev.delete("aiThread");
        return prev;
      });
    }
    toast.success("Conversa excluída");
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearchParams((prev) => {
        prev.delete("aiThread");
        return prev;
      });
    } else if (!activeThreadId && threads.length > 0) {
      // Ao abrir, selecionar a thread mais recente
      handleSelect(threads[0].id);
    }
  };

  // Auto-abrir se já existe ?aiThread na URL
  useEffect(() => {
    if (activeThreadId && !open) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  return (
    <>
      {/* Bolha flutuante */}
      {!open && (
        <button
          onClick={() => handleOpenChange(true)}
          aria-label="Abrir assistente IA"
          className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:shadow-xl md:bottom-6 md:right-6"
        >
          <img
            src={mascot}
            alt=""
            width={48}
            height={48}
            loading="lazy"
            className="h-12 w-12 rounded-full"
          />
          <span className="sr-only">Assistente IA</span>
        </button>
      )}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-3xl"
        >
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSidebarOpen((v) => !v)}
              className="shrink-0"
              title={sidebarOpen ? "Ocultar conversas" : "Mostrar conversas"}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
            <img
              src={mascot}
              alt="Assistente IA"
              width={32}
              height={32}
              loading="lazy"
              className="h-8 w-8 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Consultor Financeiro IA</div>
              <div className="text-[11px] text-muted-foreground">
                Análises com seus dados em tempo real
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1">
            {sidebarOpen && (
              <div className="w-56 shrink-0">
                <ThreadList
                  activeId={activeThreadId}
                  onSelect={handleSelect}
                  onNew={handleNew}
                  onDelete={handleDelete}
                  threads={threads}
                  loading={loading}
                />
              </div>
            )}

            {activeThreadId ? (
              loadingMessages ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Carregando mensagens…
                </div>
              ) : (
                <ChatWindow
                  key={activeThreadId}
                  threadId={activeThreadId}
                  initialMessages={threadMessages}
                  onMessageSent={fetchThreads}
                />
              )
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <img
                  src={mascot}
                  alt="Assistente IA"
                  width={96}
                  height={96}
                  loading="lazy"
                  className="h-24 w-24"
                />
                <h3 className="text-base font-semibold">
                  Comece uma conversa
                </h3>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Pergunte qualquer coisa sobre seu negócio: vendas, lucro, custos, margens, estoque. As respostas usam seus dados reais.
                </p>
                <Button onClick={handleNew} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova conversa
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
