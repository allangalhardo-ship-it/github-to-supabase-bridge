import { CheckoutData } from "./types";
import { Empresa } from "../types";
import { formatCurrencyBRL } from "@/lib/format";
import { QrCode, Banknote, CreditCard, ArrowLeft, Check, Copy } from "lucide-react";
import { toast } from "sonner";

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
  { key: "cartao", label: "Cartão", icon: CreditCard, desc: "Débito ou crédito" },
];

export function PagamentoStep({ data, empresa, subtotal, onChange, onNext, onBack }: PagamentoStepProps) {
  const total = subtotal + data.taxa_entrega;
  const isValid = !!data.forma_pagamento;

  const copiarPix = () => {
    if (empresa.chave_pix) {
      navigator.clipboard.writeText(empresa.chave_pix);
      toast.success("Chave PIX copiada!");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        <div>
          <h3 className="text-xl font-black text-gray-900 tracking-tight">Forma de pagamento</h3>
        </div>

        <div className="space-y-2.5">
          {formasPagamento.map((forma) => {
            const isSelected = data.forma_pagamento === forma.key;
            const Icon = forma.icon;
            return (
              <div key={forma.key}>
                <button
                  onClick={() => onChange({ forma_pagamento: forma.key, troco_para: null })}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left duration-200 ${
                    isSelected
                      ? "border-red-400 bg-red-50/50 shadow-lg shadow-red-500/10"
                      : "border-gray-100 hover:border-gray-200 bg-white"
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "bg-red-100" : "bg-gray-100"
                  }`}>
                    <Icon className={`h-5 w-5 ${isSelected ? "text-red-500" : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{forma.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{forma.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? "border-red-500 bg-red-500" : "border-gray-300"
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>

                {/* PIX chave */}
                {isSelected && forma.key === "pix" && empresa.chave_pix && (
                  <div className="mt-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500 font-semibold mb-2">Chave PIX</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono text-gray-800 flex-1 break-all bg-white rounded-lg px-3 py-2 border border-gray-100">{empresa.chave_pix}</p>
                      <button onClick={copiarPix} className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50 active:scale-95">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">Realize o pagamento após confirmar o pedido</p>
                  </div>
                )}

                {/* Troco */}
                {isSelected && forma.key === "dinheiro" && (
                  <div className="mt-2 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                    <label className="text-xs text-gray-500 font-semibold">Precisa de troco para?</label>
                    <input
                      type="number"
                      value={data.troco_para || ""}
                      onChange={(e) => onChange({ troco_para: e.target.value ? Number(e.target.value) : null })}
                      placeholder="Ex: 50"
                      className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300 transition-all"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Resumo */}
        <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5 text-sm border border-gray-100">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span className="font-medium">{formatCurrencyBRL(subtotal)}</span>
          </div>
          {data.taxa_entrega > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Taxa de entrega</span>
              <span className="font-medium">{formatCurrencyBRL(data.taxa_entrega)}</span>
            </div>
          )}
          {data.taxa_entrega === 0 && data.tipo_entrega === "retirada" && (
            <div className="flex justify-between text-emerald-600">
              <span>Entrega</span>
              <span className="font-bold">Grátis</span>
            </div>
          )}
          <div className="flex justify-between font-black text-gray-900 text-lg pt-2.5 border-t border-gray-200">
            <span>Total</span>
            <span>{formatCurrencyBRL(total)}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 p-4 flex gap-3 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <button onClick={onBack} className="w-12 h-12 rounded-xl border-2 border-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-red-500/20 disabled:shadow-none text-[15px]"
        >
          Revisar pedido
        </button>
      </div>
    </div>
  );
}
