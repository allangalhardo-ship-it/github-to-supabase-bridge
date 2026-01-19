import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Bot, 
  User, 
  Send, 
  Loader2, 
  Sparkles,
  MessageSquare,
  Lightbulb,
  TrendingUp,
  Calculator,
  Package,
  Check,
  X,
  AlertCircle
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  pendingActions?: PendingAction[];
  isConfirmation?: boolean;
}

interface PendingAction {
  id: string;
  toolName: string;
  args: any;
  description: string;
}

const suggestedQuestions = [
  { icon: TrendingUp, text: "Qual produto tem a melhor margem?", category: "Análise" },
  { icon: Calculator, text: "Como calcular o preço ideal para delivery?", category: "Precificação" },
  { icon: Package, text: "Quais insumos estão com estoque baixo?", category: "Estoque" },
  { icon: Lightbulb, text: "Dicas para reduzir meu CMV", category: "Gestão" },
];

const suggestedActions = [
  { icon: Package, text: "Cadastra: Brigadeiro - 100g leite condensado, 20g chocolate, 10g manteiga. Preço: R$ 5", category: "📝 Cadastrar" },
  { icon: TrendingUp, text: "Registra venda: 10 brigadeiros por R$ 50 no iFood", category: "💰 Venda" },
  { icon: Calculator, text: "Atualiza o preço da farinha de trigo para R$ 6,50/kg", category: "🔄 Atualizar" },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

const Assistente: React.FC = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingActions]);

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast({
        title: "Sessão expirada",
        description: "Por favor, faça login novamente.",
        variant: "destructive",
      });
      return null;
    }
    return session;
  };

  const streamResponse = async (resp: Response) => {
    if (!resp.body) return;

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant" && !last.isConfirmation) {
                return prev.map((m, i) => 
                  i === prev.length - 1 ? { ...m, content: assistantContent } : m
                );
              }
              return [...prev, { role: "assistant", content: assistantContent }];
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant" && !last.isConfirmation) {
                return prev.map((m, i) => 
                  i === prev.length - 1 ? { ...m, content: assistantContent } : m
                );
              }
              return [...prev, { role: "assistant", content: assistantContent }];
            });
          }
        } catch { /* ignore */ }
      }
    }
  };

  const sendMessage = async (userMessage: string) => {
    const session = await getSession();
    if (!session) return;

    const allMessages = [...messages.filter(m => !m.isConfirmation), { role: 'user' as const, content: userMessage }];
    
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ 
        messages: allMessages.map(m => ({ role: m.role, content: m.content }))
      }),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro ${resp.status}`);
    }

    const contentType = resp.headers.get("content-type") || "";
    
    // Check if it's a JSON response (confirmation needed) or stream
    if (contentType.includes("application/json")) {
      const data = await resp.json();
      
      if (data.requiresConfirmation && data.pendingActions) {
        // Show confirmation UI
        setPendingActions(data.pendingActions);
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.assistantPreview || "Entendi! Vou executar as seguintes ações:",
          pendingActions: data.pendingActions,
          isConfirmation: true,
        }]);
        return;
      }
      
      // Handle direct response
      if (data.content) {
        setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
      }
    } else {
      // Stream response
      await streamResponse(resp);
    }
  };

  const executeAction = async (action: PendingAction) => {
    const session = await getSession();
    if (!session) return;

    setIsLoading(true);
    
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          executeAction: true,
          pendingAction: {
            toolName: action.toolName,
            args: action.args,
          }
        }),
      });

      if (!resp.ok) {
        throw new Error("Erro ao executar ação");
      }

      const data = await resp.json();
      
      if (data.actionResult) {
        // Remove this action from pending
        setPendingActions(prev => prev.filter(a => a.id !== action.id));
        
        // Remove confirmation message and add result
        setMessages(prev => {
          const filtered = prev.filter(m => !m.isConfirmation);
          return [...filtered, { 
            role: "assistant", 
            content: data.actionResult.message 
          }];
        });
        
        if (data.actionResult.success) {
          toast({
            title: "Ação executada!",
            description: action.description,
          });
        }
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao executar ação",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const executeAllActions = async (actions: PendingAction[]) => {
    const session = await getSession();
    if (!session) return;

    setIsLoading(true);
    const results: string[] = [];
    let successCount = 0;
    
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          executeAction: true,
          pendingActions: actions.map(a => ({
            toolName: a.toolName,
            args: a.args,
          }))
        }),
      });

      if (!resp.ok) {
        throw new Error("Erro ao executar ações");
      }

      const data = await resp.json();
      
      if (data.actionResults) {
        for (const result of data.actionResults) {
          results.push(result.message);
          if (result.success) successCount++;
        }
        
        // Remove confirmation message and add results
        setMessages(prev => {
          const filtered = prev.filter(m => !m.isConfirmation);
          return [...filtered, { 
            role: "assistant", 
            content: results.join('\n\n')
          }];
        });
        setPendingActions([]);
        
        toast({
          title: `${successCount} de ${actions.length} ações executadas!`,
          description: successCount === actions.length ? "Todas as ações foram concluídas" : "Algumas ações falharam",
          variant: successCount === actions.length ? "default" : "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao executar ações",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cancelAction = () => {
    setPendingActions([]);
    setMessages(prev => {
      const filtered = prev.filter(m => !m.isConfirmation);
      return [...filtered, { 
        role: "assistant", 
        content: "Ok, ação cancelada. Como posso ajudar?" 
      }];
    });
  };

  const handleSend = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    // Clear pending actions if any
    if (pendingActions.length > 0) {
      setPendingActions([]);
      setMessages(prev => prev.filter(m => !m.isConfirmation));
    }

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    try {
      await sendMessage(text);
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao enviar mensagem",
        variant: "destructive",
      });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-7 w-7 text-primary" />
          Assistente IA
        </h1>
        <p className="text-muted-foreground">
          Tire dúvidas sobre o sistema, peça análises dos seus dados ou dicas de gestão
        </p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 bg-primary/5">
                <Sparkles className="h-3 w-3" />
                Gemini 3 Flash
              </Badge>
              <span className="text-xs text-muted-foreground">
                Pode executar ações no sistema
              </span>
            </div>
            {messages.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setMessages([]);
                  setPendingActions([]);
                }}
              >
                Limpar conversa
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                    <Bot className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Olá, {usuario?.nome?.split(' ')[0] || 'usuário'}! 👋
                  </h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Sou seu assistente de gestão. Posso analisar seus dados, 
                    ajudar com precificação e <strong>executar ações</strong> como cadastros e atualizações.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Perguntas:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {suggestedQuestions.map((q, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        className="h-auto py-3 px-4 justify-start text-left"
                        onClick={() => handleSend(q.text)}
                      >
                        <q.icon className="h-4 w-4 mr-3 shrink-0 text-primary" />
                        <div>
                          <span className="block text-sm">{q.text}</span>
                          <span className="text-xs text-muted-foreground">{q.category}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Ações que posso executar:
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {suggestedActions.map((q, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        className="h-auto py-3 px-4 justify-start text-left border-primary/20 bg-primary/5 hover:bg-primary/10"
                        onClick={() => handleSend(q.text)}
                      >
                        <q.icon className="h-4 w-4 mr-3 shrink-0 text-primary" />
                        <div>
                          <span className="block text-sm">{q.text}</span>
                          <span className="text-xs text-muted-foreground">{q.category}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i}>
                    <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                      {msg.role === 'user' && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-secondary">
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>

                    {/* Confirmation UI for pending actions */}
                    {msg.isConfirmation && msg.pendingActions && msg.pendingActions.length > 0 && (
                      <div className="ml-11 mt-3 space-y-3">
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                              <AlertCircle className="h-4 w-4" />
                              <span className="font-medium text-sm">
                                {msg.pendingActions.length === 1 ? 'Confirme a ação:' : `Confirme as ${msg.pendingActions.length} ações:`}
                              </span>
                            </div>
                            
                            {/* Buttons for multiple actions */}
                            {msg.pendingActions.length > 1 && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelAction}
                                  disabled={isLoading}
                                  className="gap-1"
                                >
                                  <X className="h-3 w-3" />
                                  Cancelar Todas
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => executeAllActions(msg.pendingActions!)}
                                  disabled={isLoading}
                                  className="gap-1 bg-green-600 hover:bg-green-700"
                                >
                                  {isLoading ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                  Confirmar Todas
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            {msg.pendingActions.map((action, actionIndex) => (
                              <div key={actionIndex} className="flex items-center justify-between bg-white dark:bg-background rounded-md p-3 border">
                                <span className="text-sm flex-1">{action.description}</span>
                                <div className="flex gap-2 ml-2">
                                  {msg.pendingActions!.length === 1 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={cancelAction}
                                      disabled={isLoading}
                                      className="gap-1"
                                    >
                                      <X className="h-3 w-3" />
                                      Cancelar
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    onClick={() => executeAction(action)}
                                    disabled={isLoading}
                                    className="gap-1"
                                  >
                                    {isLoading ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Check className="h-3 w-3" />
                                    )}
                                    {msg.pendingActions!.length === 1 ? 'Confirmar' : 'Executar'}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex gap-3 justify-start">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-lg px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input area */}
          <div className="p-4 border-t bg-background">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua pergunta ou peça para cadastrar algo..."
                className="min-h-[44px] max-h-32 resize-none"
                disabled={isLoading}
              />
              <Button 
                onClick={() => handleSend()} 
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-[44px] w-[44px] shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              💡 Posso cadastrar produtos, insumos, registrar vendas e atualizar preços
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Assistente;
