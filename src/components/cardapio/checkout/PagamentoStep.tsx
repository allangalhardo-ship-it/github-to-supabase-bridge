import { CheckoutData } from "./types";
import { Empresa } from "../types";
import { formatCurrencyBRL } from "@/lib/format";
import { QrCode, Banknote, CreditCard, Smartphone } from "lucide-react";

interface PagamentoStepProps {
  data: CheckoutData;
  empresa: Empresa;
  subtotal: number;
  onChange: (data: Partial<CheckoutData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const formasPagamento = [
  { key: "pix", label: "PIX", icon: QrCode, desc: "Transferência instantânea" },
  { key: "dinheiro", label: "Dinheiro", icon: Banknote, desc: "Pague na entrega/retirada" },
  { key: "cartao", label: "Cartão", icon: CreditCard, desc: "Débito ou crédito na entrega" },
];

export function PagamentoStep({ data, empresa, subtotal, onChange, onNext, onBack }: PagamentoStepProps) {
  const total = subtotal + data.taxa_entrega;
  const isValid = !!data.forma_pagamento;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Forma de pagamento</h3>
        </div>

        <div className="space-y-3">
          {formasPagamento.map((forma) => {
            const isSelected = data.forma_pagamento === forma.key;
            const Icon = forma.icon;
            return (
              <div key={forma.key}>
                <button
                  onClick={() => onChange({ forma_pagamento: forma.key, troco_para: null })}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Icon className={`h-6 w-6 flex-shrink-0 ${isSelected ? "text-emerald-600" : "text-gray-400"}`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{forma.label}</p>
                    <p className="text-xs text-gray-400">{forma.desc}</p>
                  </div>
                </button>

                {/* PIX chave */}
                {isSelected && forma.key === "pix" && empresa.chave_pix && (
                  <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <p className="text-xs text-emerald-700 font-medium">Chave PIX:</p>
                    <p className="text-sm font-mono text-emerald-800 mt-1 break-all">{empresa.chave_pix}</p>
                    <p className="text-[11px] text-emerald-600 mt-1">Realize o pagamento após confirmar o pedido</p>
                  </div>
                )}

                {/* Troco */}
                {isSelected && forma.key === "dinheiro" && (
                  <div className="mt-2 space-y-2">
                    <label className="text-sm text-gray-600">Precisa de troco para quanto?</label>
                    <input
                      type="number"
                      value={data.troco_para || ""}
                      onChange={(e) => onChange({ troco_para: e.target.value ? Number(e.target.value) : null })}
                      placeholder="Ex: 50"
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Resumo */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>{formatCurrencyBRL(subtotal)}</span>
          </div>
          {data.taxa_entrega > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Taxa de entrega</span>
              <span>{formatCurrencyBRL(data.taxa_entrega)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 text-base pt-2 border-t">
            <span>Total</span>
            <span className="text-emerald-700">{formatCurrencyBRL(total)}</span>
          </div>
        </div>
      </div>

      <div className="border-t p-4 flex gap-3">
        <button onClick={onBack} className="px-6 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Voltar
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Revisar pedido
        </button>
      </div>
    </div>
  );
}
