import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, ChefHat, Package, Truck, XCircle, Bike } from "lucide-react";
import { formatCurrencyBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = [
  { key: "pendente", label: "Pedido recebido", icon: Clock },
  { key: "confirmado", label: "Confirmado", icon: CheckCircle2 },
  { key: "preparando", label: "Preparando", icon: ChefHat },
  { key: "pronto", label: "Pronto", icon: Package },
  { key: "saiu_entrega", label: "Saiu para entrega", icon: Bike },
  { key: "entregue", label: "Entregue", icon: Truck },
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

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-500 border-t-transparent" /></div>;
  if (!pedido) return <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center"><XCircle className="h-16 w-16 text-gray-300 mb-4" /><h1 className="text-xl font-bold text-gray-700">Pedido não encontrado</h1></div>;

  const isCancelado = pedido.status === "cancelado";
  const statusIndex = STATUS_CONFIG.findIndex(s => s.key === pedido.status);
  const itens = Array.isArray(pedido.itens) ? pedido.itens : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-5 text-center">
        <p className="text-sm text-gray-500">Pedido</p>
        <h1 className="text-3xl font-bold text-emerald-600">#{pedido.numero_pedido}</h1>
        <p className="text-xs text-gray-400 mt-1">{new Date(pedido.created_at).toLocaleString("pt-BR")}</p>
      </div>
      <div className="max-w-md mx-auto p-6 space-y-6">
        {isCancelado ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <XCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
            <p className="font-bold text-red-700">Pedido cancelado</p>
            {pedido.motivo_cancelamento && <p className="text-sm text-red-600 mt-1">{pedido.motivo_cancelamento}</p>}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Status do pedido</h2>
            {STATUS_CONFIG.map((s, i) => {
              const isActive = i <= statusIndex;
              const isCurrent = i === statusIndex;
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", isActive ? "bg-emerald-100" : "bg-gray-100")}>
                      <Icon className={cn("h-4 w-4", isActive ? "text-emerald-600" : "text-gray-300")} />
                    </div>
                    {i < STATUS_CONFIG.length - 1 && <div className={cn("w-0.5 h-6", i < statusIndex ? "bg-emerald-300" : "bg-gray-200")} />}
                  </div>
                  <div className="pt-1">
                    <p className={cn("text-sm font-medium", isActive ? "text-gray-800" : "text-gray-400", isCurrent && "font-bold")}>
                      {s.label}
                      {isCurrent && <span className="ml-2 inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />Agora</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Itens</h2>
          {itens.map((item: any, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-600">{item.quantidade}x {item.nome}</span>
              <span className="font-medium text-gray-800">{formatCurrencyBRL((item.preco_unitario || 0) * (item.quantidade || 1))}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-emerald-600">{formatCurrencyBRL(pedido.valor_total)}</span>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm space-y-2 text-sm text-gray-600">
          <p>📦 {pedido.tipo_entrega === "entrega" ? "Entrega" : "Retirada no local"}</p>
          {pedido.endereco_entrega && <p>📍 {pedido.endereco_entrega}</p>}
          {pedido.observacoes && <p>📝 {pedido.observacoes}</p>}
        </div>
      </div>
    </div>
  );
}
