import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CarrinhoItem, Empresa } from "../types";
import { CheckoutData } from "./types";
import { formatCurrencyBRL } from "@/lib/format";
import { Loader2, MapPin, CreditCard, User, ShoppingBag, ArrowLeft, Send } from "lucide-react";

interface ConfirmacaoStepProps {
  carrinho: CarrinhoItem[];
  data: CheckoutData;
  empresa: Empresa;
  subtotal: number;
  onBack: () => void;
  onSuccess: (pedidoId: string, numeroPedido: number) => void;
}

const formasPagLabel: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
};

export function ConfirmacaoStep({ carrinho, data, empresa, subtotal, onBack, onSuccess }: ConfirmacaoStepProps) {
  const [enviando, setEnviando] = useState(false);
  const total = subtotal + data.taxa_entrega;

  const confirmarPedido = async () => {
    setEnviando(true);
    try {
      const itensJson = carrinho.map(item => ({
        produto_id: item.produto.id,
        nome: item.produto.nome,
        quantidade: item.quantidade,
        preco_unitario: item.produto.preco_venda,
        observacao: item.observacao || null,
        opcionais: item.opcionais.map(o => ({ nome: o.nome, preco_adicional: o.preco_adicional })),
      }));

      const enderecoCompleto = data.tipo_entrega === "entrega"
        ? `${data.endereco}${data.complemento ? ` - ${data.complemento}` : ""}${data.bairro_nome ? ` (${data.bairro_nome})` : ""}`
        : null;

      const { data: pedido, error } = await supabase
        .from("pedidos")
        .insert({
          empresa_id: empresa.id, itens: itensJson, valor_total: total,
          subtotal, taxa_entrega: data.taxa_entrega, tipo_entrega: data.tipo_entrega,
          bairro_entrega: data.bairro_nome || null, endereco_entrega: enderecoCompleto,
          forma_pagamento: data.forma_pagamento, troco_para: data.troco_para,
          cliente_nome: data.nome.trim(), cliente_whatsapp: data.whatsapp.replace(/\D/g, ""),
          observacoes: data.observacoes || null, origem: "cardapio", status: "pendente",
        })
        .select("id, numero_pedido").single();

      if (error) throw error;
      onSuccess(pedido.id, pedido.numero_pedido);
    } catch (error: any) {
      console.error("Erro ao enviar pedido:", error);
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        <h3 className="text-xl font-black text-gray-900 tracking-tight">Confirmar pedido</h3>

        {/* Summary cards */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center border border-gray-100">
              <User className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{data.nome}</p>
              <p className="text-xs text-gray-400">{data.whatsapp}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center border border-gray-100 mt-0.5">
              <MapPin className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {data.tipo_entrega === "retirada" ? "Retirar no local" : "Entrega"}
              </p>
              {data.tipo_entrega === "entrega" && (
                <>
                  <p className="text-xs text-gray-400">{data.endereco}{data.complemento ? ` - ${data.complemento}` : ""}</p>
                  {data.bairro_nome && <p className="text-xs text-gray-400">{data.bairro_nome} • Frete: {formatCurrencyBRL(data.taxa_entrega)}</p>}
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center border border-gray-100">
              <CreditCard className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{formasPagLabel[data.forma_pagamento] || data.forma_pagamento}</p>
              {data.troco_para && <p className="text-xs text-gray-400">Troco para {formatCurrencyBRL(data.troco_para)}</p>}
            </div>
          </div>
        </div>

        {/* Itens */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-gray-400" />
            <h4 className="text-sm font-bold text-gray-700">Itens do pedido</h4>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {carrinho.map(item => {
              const opTotal = item.opcionais.reduce((s, o) => s + o.preco_adicional, 0);
              return (
                <div key={item.carrinhoKey} className="flex justify-between p-3.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-800">
                      {item.quantidade}x {item.produto.nome}
                    </span>
                    {item.opcionais.length > 0 && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{item.opcionais.map(o => o.nome).join(", ")}</p>
                    )}
                  </div>
                  <span className="font-bold text-gray-800 ml-3">
                    {formatCurrencyBRL((item.produto.preco_venda + opTotal) * item.quantidade)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total */}
        <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-4 space-y-1.5 border border-red-100">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span className="font-medium">{formatCurrencyBRL(subtotal)}</span>
          </div>
          {data.taxa_entrega > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Entrega</span>
              <span className="font-medium">{formatCurrencyBRL(data.taxa_entrega)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-xl text-gray-900 pt-2 border-t border-red-200/50">
            <span>Total</span>
            <span>{formatCurrencyBRL(total)}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 p-4 flex gap-3 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <button onClick={onBack} disabled={enviando} className="w-12 h-12 rounded-xl border-2 border-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={confirmarPedido}
          disabled={enviando}
          className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-400 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 text-[15px] shadow-xl shadow-red-500/25"
        >
          {enviando ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Confirmar • {formatCurrencyBRL(total)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
