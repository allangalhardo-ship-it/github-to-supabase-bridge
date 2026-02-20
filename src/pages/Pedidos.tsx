import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrencyBRL } from "@/lib/format";
import { ClipboardList, ChefHat, Package, Truck, CheckCircle2, XCircle, Clock, Search, Phone, Bike, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Pedido } from "@/components/cardapio/types";

const COLUNAS = [
  { key: "pendente", label: "Novos", icon: Clock, color: "bg-amber-500" },
  { key: "confirmado", label: "Aceitos", icon: CheckCircle2, color: "bg-blue-500" },
  { key: "preparando", label: "Preparando", icon: ChefHat, color: "bg-orange-500" },
  { key: "pronto", label: "Prontos", icon: Package, color: "bg-emerald-500" },
  { key: "saiu_entrega", label: "Saiu entrega", icon: Bike, color: "bg-purple-500" },
  { key: "entregue", label: "Entregues", icon: Truck, color: "bg-gray-500" },
];

const NEXT_STATUS: Record<string, string> = {
  pendente: "confirmado",
  confirmado: "preparando",
  preparando: "pronto",
  pronto: "saiu_entrega",
  saiu_entrega: "entregue",
};

const NEXT_LABEL: Record<string, string> = {
  pendente: "Aceitar",
  confirmado: "Preparar",
  preparando: "Pronto",
  pronto: "Saiu entrega",
  saiu_entrega: "Entregue",
};

function buildWhatsAppMsg(pedido: Pedido, status: string): string {
  const msgs: Record<string, string> = {
    confirmado: `✅ Pedido #${pedido.numero_pedido} confirmado! Estamos preparando.`,
    preparando: `👨‍🍳 Pedido #${pedido.numero_pedido} está sendo preparado!`,
    pronto: `📦 Pedido #${pedido.numero_pedido} está pronto!${pedido.tipo_entrega === "retirada" ? " Pode retirar." : ""}`,
    saiu_entrega: `🛵 Pedido #${pedido.numero_pedido} saiu para entrega!`,
    entregue: `✅ Pedido #${pedido.numero_pedido} entregue! Obrigado!`,
    cancelado: `❌ Pedido #${pedido.numero_pedido} foi cancelado.${pedido.motivo_cancelamento ? ` Motivo: ${pedido.motivo_cancelamento}` : ""}`,
  };
  return msgs[status] || "";
}

export default function Pedidos() {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresa_id;
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!empresaId) return;
    const fetchPedidos = async () => {
      const { data } = await supabase.from("pedidos").select("*").eq("empresa_id", empresaId).order("created_at", { ascending: false }).limit(200);
      setPedidos((data as unknown as Pedido[]) || []);
      setLoading(false);
    };
    fetchPedidos();

    const channel = supabase.channel("pedidos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `empresa_id=eq.${empresaId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setPedidos(prev => [payload.new as unknown as Pedido, ...prev]);
          try { audioRef.current?.play(); } catch {}
          toast.info(`🔔 Novo pedido #${(payload.new as any).numero_pedido}!`);
        } else if (payload.eventType === "UPDATE") {
          setPedidos(prev => prev.map(p => p.id === (payload.new as any).id ? payload.new as unknown as Pedido : p));
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [empresaId]);

  const atualizarStatus = async (pedido: Pedido, novoStatus: string) => {
    const timestampCol = `${novoStatus}_em`;
    const { error } = await supabase.from("pedidos").update({ status: novoStatus, [timestampCol]: new Date().toISOString() } as any).eq("id", pedido.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success(`Pedido #${pedido.numero_pedido} → ${NEXT_LABEL[pedido.status] || novoStatus}`);
    if (pedido.cliente_whatsapp) {
      const msg = buildWhatsAppMsg({ ...pedido, status: novoStatus }, novoStatus);
      if (msg) {
        const num = pedido.cliente_whatsapp.replace(/\D/g, "");
        const fullNum = num.length <= 11 ? `55${num}` : num;
        window.open(`https://wa.me/${fullNum}?text=${encodeURIComponent(msg)}`, "_blank");
      }
    }
  };

  const cancelarPedido = async (pedido: Pedido) => {
    const motivo = prompt("Motivo do cancelamento:");
    if (!motivo) return;
    await supabase.from("pedidos").update({ status: "cancelado", cancelado_em: new Date().toISOString(), motivo_cancelamento: motivo } as any).eq("id", pedido.id);
    toast.success(`Pedido #${pedido.numero_pedido} cancelado`);
  };

  const pedidosFiltrados = pedidos.filter(p => {
    if (filtroStatus !== "todos" && p.status !== filtroStatus) return false;
    if (busca) {
      const t = busca.toLowerCase();
      if (!p.numero_pedido.toString().includes(t) && !p.cliente_nome?.toLowerCase().includes(t)) return false;
    }
    return true;
  });

  const pedidosAtivos = pedidos.filter(p => !["entregue", "cancelado"].includes(p.status));

  if (loading) return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-6">
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczGjB+o8bVumMzFSuBq87dv2k0FTOGqMzZu2c0FQ==" preload="auto" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            Pedidos
          </h1>
          <p className="text-muted-foreground">{pedidosAtivos.length} pedido{pedidosAtivos.length !== 1 ? "s" : ""} ativo{pedidosAtivos.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nº ou nome..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-10" />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {COLUNAS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
            <SelectItem value="cancelado">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status badges */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {COLUNAS.slice(0, 5).map(col => {
          const count = pedidos.filter(p => p.status === col.key).length;
          return (
            <button key={col.key} onClick={() => setFiltroStatus(f => f === col.key ? "todos" : col.key)}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filtroStatus === col.key ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"
              }`}>
              <col.icon className="h-3.5 w-3.5" /> {col.label}
              {count > 0 && <Badge variant="secondary" className="h-5 min-w-5 text-[10px] p-0 flex items-center justify-center">{count}</Badge>}
            </button>
          );
        })}
      </div>

      {/* Pedidos list */}
      <div className="space-y-3">
        <AnimatePresence>
          {pedidosFiltrados.map(pedido => {
            const nextStatus = NEXT_STATUS[pedido.status];
            const coluna = COLUNAS.find(c => c.key === pedido.status);
            const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
            return (
              <motion.div key={pedido.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="bg-card border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-foreground">#{pedido.numero_pedido}</span>
                    <Badge className={`${coluna?.color || "bg-gray-500"} text-white text-[10px]`}>{coluna?.label || pedido.status}</Badge>
                    {pedido.tipo_entrega === "entrega" && <Badge variant="outline" className="text-[10px]">🛵 Entrega</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(pedido.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>

                {pedido.cliente_nome && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{pedido.cliente_nome}</span>
                    {pedido.cliente_whatsapp && (
                      <a href={`https://wa.me/55${pedido.cliente_whatsapp.replace(/\D/g, "")}`} target="_blank" className="text-emerald-600 hover:underline inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> WhatsApp
                      </a>
                    )}
                  </div>
                )}

                <div className="text-sm text-muted-foreground space-y-0.5">
                  {itens.slice(0, 3).map((item: any, i: number) => (
                    <p key={i}>{item.quantidade}x {item.nome}</p>
                  ))}
                  {itens.length > 3 && <p className="text-xs">+{itens.length - 3} itens</p>}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-bold text-foreground">{formatCurrencyBRL(pedido.valor_total)}</span>
                  <div className="flex gap-2">
                    {pedido.status !== "cancelado" && pedido.status !== "entregue" && (
                      <Button variant="outline" size="sm" onClick={() => cancelarPedido(pedido)} className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10">
                        Cancelar
                      </Button>
                    )}
                    {nextStatus && (
                      <Button size="sm" onClick={() => atualizarStatus(pedido, nextStatus)} className="text-xs">
                        {NEXT_LABEL[pedido.status]}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {pedidosFiltrados.length === 0 && (
          <div className="text-center py-16">
            <ClipboardList className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum pedido encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
