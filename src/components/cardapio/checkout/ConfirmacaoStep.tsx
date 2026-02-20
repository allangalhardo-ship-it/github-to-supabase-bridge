import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CarrinhoItem, Empresa } from "../types";
import { CheckoutData } from "./types";
import { formatCurrencyBRL } from "@/lib/format";
import { Loader2, MapPin, CreditCard, User } from "lucide-react";

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
        opcionais: item.opcionais.map(o => ({
          nome: o.nome,
          preco_adicional: o.preco_adicional,
        })),
      }));

      const enderecoCompleto = data.tipo_entrega === "entrega"
        ? `${data.endereco}${data.complemento ? ` - ${data.complemento}` : ""}${data.bairro_nome ? ` (${data.bairro_nome})` : ""}`
        : null;

      const { data: pedido, error } = await supabase
        .from("pedidos")
        .insert({
          empresa_id: empresa.id,
          itens: itensJson,
          valor_total: total,
          subtotal: subtotal,
          taxa_entrega: data.taxa_entrega,
          tipo_entrega: data.tipo_entrega,
          bairro_entrega: data.bairro_nome || null,
          endereco_entrega: enderecoCompleto,
          forma_pagamento: data.forma_pagamento,
          troco_para: data.troco_para,
          cliente_nome: data.nome.trim(),
          cliente_whatsapp: data.whatsapp.replace(/\D/g, ""),
          observacoes: data.observacoes || null,
          origem: "cardapio",
          status: "pendente",
        })
        .select("id, numero_pedido")
        .single();

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
        <h3 className="text-lg font-bold text-gray-900">Confirmar pedido</h3>

        {/* Dados do cliente */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <User className="h-5 w-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">{data.nome}</p>
            <p className="text-xs text-gray-500">{data.whatsapp}</p>
          </div>
        </div>

        {/* Entrega */}
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
          <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {data.tipo_entrega === "retirada" ? "Retirar no local" : "Entrega"}
            </p>
            {data.tipo_entrega === "entrega" && (
              <>
                <p className="text-xs text-gray-500">{data.endereco}{data.complemento ? ` - ${data.complemento}` : ""}</p>
                {data.bairro_nome && <p className="text-xs text-gray-400">{data.bairro_nome} • Frete: {formatCurrencyBRL(data.taxa_entrega)}</p>}
              </>
            )}
          </div>
        </div>

        {/* Pagamento */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <CreditCard className="h-5 w-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">{formasPagLabel[data.forma_pagamento] || data.forma_pagamento}</p>
            {data.troco_para && <p className="text-xs text-gray-500">Troco para {formatCurrencyBRL(data.troco_para)}</p>}
          </div>
        </div>

        {/* Itens */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Itens</h4>
          {carrinho.map(item => {
            const opTotal = item.opcionais.reduce((s, o) => s + o.preco_adicional, 0);
            return (
              <div key={item.carrinhoKey} className="flex justify-between text-sm py-1">
                <span className="text-gray-600">
                  {item.quantidade}x {item.produto.nome}
                  {item.opcionais.length > 0 && (
                    <span className="text-xs text-gray-400 block">{item.opcionais.map(o => o.nome).join(", ")}</span>
                  )}
                </span>
                <span className="font-medium text-gray-800">
                  {formatCurrencyBRL((item.produto.preco_venda + opTotal) * item.quantidade)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="bg-emerald-50 rounded-xl p-4 space-y-1">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrencyBRL(subtotal)}</span>
          </div>
          {data.taxa_entrega > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Entrega</span>
              <span>{formatCurrencyBRL(data.taxa_entrega)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg text-emerald-800 pt-2 border-t border-emerald-200">
            <span>Total</span>
            <span>{formatCurrencyBRL(total)}</span>
          </div>
        </div>
      </div>

      <div className="border-t p-4 flex gap-3">
        <button onClick={onBack} disabled={enviando} className="px-6 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Voltar
        </button>
        <button
          onClick={confirmarPedido}
          disabled={enviando}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {enviando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            `Confirmar pedido • ${formatCurrencyBRL(total)}`
          )}
        </button>
      </div>
    </div>
  );
}
