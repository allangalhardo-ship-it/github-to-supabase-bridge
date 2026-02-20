import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatCurrencyBRL } from "@/lib/format";
import { Clock, CheckCircle2, ChefHat, Package, Truck, XCircle, Phone, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Pedido {
  id: string;
  numero_pedido: number;
  status: string;
  itens: any[];
  valor_total: number;
  tipo_entrega: string;
  forma_pagamento: string;
  cliente_nome: string | null;
  cliente_whatsapp: string | null;
  endereco_entrega: string | null;
  observacoes: string | null;
  created_at: string;
}

const COLUNAS = [
  { status: 'pendente', label: 'Pendentes', icon: Clock, color: 'bg-amber-500', bgLight: 'bg-amber-50', textColor: 'text-amber-700', nextStatus: 'confirmado', nextLabel: 'Confirmar' },
  { status: 'confirmado', label: 'Confirmados', icon: CheckCircle2, color: 'bg-blue-500', bgLight: 'bg-blue-50', textColor: 'text-blue-700', nextStatus: 'preparando', nextLabel: 'Preparando' },
  { status: 'preparando', label: 'Preparando', icon: ChefHat, color: 'bg-orange-500', bgLight: 'bg-orange-50', textColor: 'text-orange-700', nextStatus: 'pronto', nextLabel: 'Pronto' },
  { status: 'pronto', label: 'Prontos', icon: Package, color: 'bg-emerald-500', bgLight: 'bg-emerald-50', textColor: 'text-emerald-700', nextStatus: 'entregue', nextLabel: 'Entregue' },
  { status: 'entregue', label: 'Entregues', icon: Truck, color: 'bg-gray-400', bgLight: 'bg-gray-50', textColor: 'text-gray-600', nextStatus: null, nextLabel: null },
];

const PAGAMENTO_LABELS: Record<string, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', cartao_credito: 'Crédito', cartao_debito: 'Débito',
};

// Notification sound
function playNewOrderSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    // Audio not supported
  }
}

function buildWhatsAppStatusMessage(pedido: Pedido, novoStatus: string): string {
  const statusMessages: Record<string, string> = {
    confirmado: `✅ *Pedido #${pedido.numero_pedido} confirmado!*\n\nSeu pedido foi recebido e será preparado em breve.`,
    preparando: `👨‍🍳 *Pedido #${pedido.numero_pedido} em preparo!*\n\nEstamos preparando seu pedido com carinho.`,
    pronto: pedido.tipo_entrega === 'retirada'
      ? `🎉 *Pedido #${pedido.numero_pedido} pronto!*\n\nSeu pedido está pronto para retirada!`
      : `🎉 *Pedido #${pedido.numero_pedido} pronto!*\n\nSeu pedido está pronto e saindo para entrega!`,
    entregue: `✨ *Pedido #${pedido.numero_pedido} entregue!*\n\nObrigado pela preferência! Esperamos que aproveite.`,
    cancelado: `❌ *Pedido #${pedido.numero_pedido} cancelado.*\n\nInfelizmente seu pedido foi cancelado.`,
  };
  return statusMessages[novoStatus] || '';
}

export function PedidosKanban() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  // Load empresa_id
  useEffect(() => {
    if (!user) return;
    supabase.from("usuarios").select("empresa_id").eq("id", user.id).single()
      .then(({ data }) => { if (data) setEmpresaId(data.empresa_id); });
  }, [user]);

  // Load pedidos
  useEffect(() => {
    if (!empresaId) return;

    const fetchPedidos = async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("empresa_id", empresaId)
        .in("status", ['pendente', 'confirmado', 'preparando', 'pronto', 'entregue'])
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && data) {
        setPedidos(data as unknown as Pedido[]);
      }
      setLoading(false);
    };

    fetchPedidos();

    // Realtime
    const channel = supabase
      .channel('pedidos-kanban')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pedidos',
        filter: `empresa_id=eq.${empresaId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const novo = payload.new as unknown as Pedido;
          setPedidos(prev => [novo, ...prev]);
          playNewOrderSound();
          toast.success(`🛒 Novo pedido #${novo.numero_pedido}!`, { duration: 5000 });
        } else if (payload.eventType === 'UPDATE') {
          setPedidos(prev => prev.map(p => p.id === (payload.new as any).id ? payload.new as unknown as Pedido : p));
        } else if (payload.eventType === 'DELETE') {
          setPedidos(prev => prev.filter(p => p.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [empresaId]);

  const atualizarStatus = useCallback(async (pedido: Pedido, novoStatus: string) => {
    const timestampField = `${novoStatus}_em`;
    const updateData: any = { status: novoStatus, [timestampField]: new Date().toISOString() };

    const { error } = await supabase
      .from("pedidos")
      .update(updateData)
      .eq("id", pedido.id);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    // Send WhatsApp notification to customer
    if (pedido.cliente_whatsapp) {
      const msg = buildWhatsAppStatusMessage(pedido, novoStatus);
      if (msg) {
        const num = pedido.cliente_whatsapp.replace(/\D/g, "");
        const fullNum = num.startsWith('55') ? num : `55${num}`;
        window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(msg)}`, "_blank");
      }
    }

    toast.success(`Pedido #${pedido.numero_pedido} → ${novoStatus}`);
  }, []);

  const cancelarPedido = useCallback(async (pedido: Pedido) => {
    const { error } = await supabase
      .from("pedidos")
      .update({ status: 'cancelado', cancelado_em: new Date().toISOString() })
      .eq("id", pedido.id);

    if (error) {
      toast.error("Erro ao cancelar");
      return;
    }

    setPedidos(prev => prev.filter(p => p.id !== pedido.id));
    
    if (pedido.cliente_whatsapp) {
      const msg = buildWhatsAppStatusMessage(pedido, 'cancelado');
      const num = pedido.cliente_whatsapp.replace(/\D/g, "");
      const fullNum = num.startsWith('55') ? num : `55${num}`;
      window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(msg)}`, "_blank");
    }

    toast.success(`Pedido #${pedido.numero_pedido} cancelado`);
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="min-w-[280px] space-y-3">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Pedidos</h2>
          <p className="text-sm text-muted-foreground">
            {pedidos.filter(p => p.status === 'pendente').length} pendente(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Atualização em tempo real</span>
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 min-w-max">
          {COLUNAS.map((coluna) => {
            const pedidosColuna = pedidos.filter(p => p.status === coluna.status);
            const Icon = coluna.icon;

            return (
              <div key={coluna.status} className="w-[300px] flex-shrink-0">
                {/* Header da coluna */}
                <div className={cn("flex items-center gap-2 px-3 py-2 rounded-t-xl", coluna.bgLight)}>
                  <div className={cn("w-2 h-2 rounded-full", coluna.color)} />
                  <span className={cn("text-sm font-semibold", coluna.textColor)}>{coluna.label}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {pedidosColuna.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="bg-muted/30 rounded-b-xl p-2 min-h-[200px] space-y-2">
                  <AnimatePresence mode="popLayout">
                    {pedidosColuna.map((pedido) => {
                      const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
                      return (
                        <motion.div
                          key={pedido.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.2 }}
                          className="bg-background rounded-xl border shadow-sm p-3 space-y-2"
                        >
                          {/* Header do card */}
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground">#{pedido.numero_pedido}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Cliente */}
                          {pedido.cliente_nome && (
                            <p className="text-xs text-muted-foreground">
                              👤 {pedido.cliente_nome}
                            </p>
                          )}

                          {/* Itens */}
                          <div className="text-xs text-foreground/80 space-y-0.5">
                            {itens.slice(0, 3).map((item: any, i: number) => (
                              <p key={i}>{item.quantidade}x {item.nome}</p>
                            ))}
                            {itens.length > 3 && (
                              <p className="text-muted-foreground">+{itens.length - 3} item(ns)</p>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              {pedido.tipo_entrega === 'entrega' ? '🛵 Entrega' : '🏪 Retirada'}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {PAGAMENTO_LABELS[pedido.forma_pagamento] || pedido.forma_pagamento}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t">
                            <span className="font-bold text-sm text-emerald-600">
                              {formatCurrencyBRL(pedido.valor_total)}
                            </span>

                            <div className="flex gap-1">
                              {pedido.cliente_whatsapp && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    const num = pedido.cliente_whatsapp!.replace(/\D/g, "");
                                    window.open(`https://wa.me/55${num}`, "_blank");
                                  }}
                                >
                                  <Phone className="h-3 w-3" />
                                </Button>
                              )}

                              {coluna.status === 'pendente' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[10px] text-red-500 hover:text-red-700"
                                  onClick={() => cancelarPedido(pedido)}
                                >
                                  <XCircle className="h-3 w-3" />
                                </Button>
                              )}

                              {coluna.nextStatus && (
                                <Button
                                  size="sm"
                                  className="h-7 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white"
                                  onClick={() => atualizarStatus(pedido, coluna.nextStatus!)}
                                >
                                  {coluna.nextLabel}
                                </Button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {pedidosColuna.length === 0 && (
                    <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                      Nenhum pedido
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
