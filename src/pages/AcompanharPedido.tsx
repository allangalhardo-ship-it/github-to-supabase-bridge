import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, ChefHat, Package, Truck, XCircle, Bike } from "lucide-react";
import { formatCurrencyBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const STATUS_CONFIG = [
  { key: "pendente", label: "Pedido recebido", icon: Clock, color: "from-amber-400 to-amber-500" },
  { key: "confirmado", label: "Confirmado", icon: CheckCircle2, color: "from-blue-400 to-blue-500" },
  { key: "preparando", label: "Preparando", icon: ChefHat, color: "from-orange-400 to-orange-500" },
  { key: "pronto", label: "Pronto", icon: Package, color: "from-emerald-400 to-emerald-500" },
  { key: "saiu_entrega", label: "Saiu para entrega", icon: Bike, color: "from-purple-400 to-purple-500" },
  { key: "entregue", label: "Entregue", icon: Truck, color: "from-emerald-500 to-emerald-600" },
];

export default function AcompanharPedido() {
  const { pedidoId } = useParams<{ pedidoId: string }>();
  const [pedido, setPedido] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pedidoId) return;
    const fetch = async () => {
      const { data } = await supabase.from("pedidos").select("*").eq("id", pedidoId).eq("origem", "cardapio").single();
      if (data) setPedido(data);
      setLoading(false);
    };
    fetch();
    const channel = supabase.channel(`pedido-${pedidoId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pedidos", filter: `id=eq.${pedidoId}` }, (payload) => setPedido(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [pedidoId]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-red-500 border-t-transparent" /></div>;
  if (!pedido) return <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center"><XCircle className="h-16 w-16 text-gray-300 mb-4" /><h1 className="text-xl font-black text-gray-700">Pedido não encontrado</h1></div>;

  const isCancelado = pedido.status === "cancelado";
  const statusIndex = STATUS_CONFIG.findIndex(s => s.key === pedido.status);
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
  const currentStatus = STATUS_CONFIG[statusIndex];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-6 text-center shadow-sm">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Pedido</p>
        <h1 className="text-4xl font-black text-gray-900 mt-1">#{pedido.numero_pedido}</h1>
        <p className="text-xs text-gray-400 mt-1">{new Date(pedido.created_at).toLocaleString("pt-BR")}</p>
      </div>
      <div className="max-w-md mx-auto p-5 space-y-5">
        {isCancelado ? (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <p className="font-black text-red-700 text-lg">Pedido cancelado</p>
            {pedido.motivo_cancelamento && <p className="text-sm text-red-600 mt-1">{pedido.motivo_cancelamento}</p>}
          </div>
        ) : (
          <>
            {/* Current status hero */}
            {currentStatus && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-gradient-to-r ${currentStatus.color} rounded-2xl p-5 text-white text-center shadow-lg`}
              >
                <currentStatus.icon className="h-10 w-10 mx-auto mb-2" />
                <p className="font-black text-lg">{currentStatus.label}</p>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  <span className="text-sm text-white/90 font-medium">Atualização em tempo real</span>
                </div>
              </motion.div>
            )}
            
            {/* Timeline */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="text-sm font-bold text-gray-700 mb-4">Progresso</h2>
              {STATUS_CONFIG.map((s, i) => {
                const isActive = i <= statusIndex;
                const isCurrent = i === statusIndex;
                const Icon = s.icon;
                return (
                  <div key={s.key} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all", 
                        isCurrent ? `bg-gradient-to-r ${s.color} shadow-lg` : isActive ? "bg-emerald-100" : "bg-gray-100")}>
                        <Icon className={cn("h-4 w-4", isCurrent ? "text-white" : isActive ? "text-emerald-600" : "text-gray-300")} />
                      </div>
                      {i < STATUS_CONFIG.length - 1 && <div className={cn("w-0.5 h-7", i < statusIndex ? "bg-emerald-300" : "bg-gray-200")} />}
                    </div>
                    <div className="pt-1.5">
                      <p className={cn("text-sm font-semibold", isCurrent ? "text-gray-900 font-bold" : isActive ? "text-gray-700" : "text-gray-400")}>
                        {s.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
          <h2 className="text-sm font-bold text-gray-700">Itens</h2>
          {itens.map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-600">{item.quantidade}x {item.nome}</span>
              <span className="font-bold text-gray-800">{formatCurrencyBRL((item.preco_unitario || 0) * (item.quantidade || 1))}</span>
            </div>
          ))}
          <div className="border-t pt-3 flex justify-between font-black text-lg">
            <span>Total</span>
            <span className="text-gray-900">{formatCurrencyBRL(pedido.valor_total)}</span>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-2 text-sm text-gray-600">
          <p>📦 {pedido.tipo_entrega === "entrega" ? "Entrega" : "Retirada no local"}</p>
          {pedido.endereco_entrega && <p>📍 {pedido.endereco_entrega}</p>}
          {pedido.observacoes && <p>📝 {pedido.observacoes}</p>}
        </div>
      </div>
    </div>
  );
}
