import { useState, useEffect } from "react";
import { CheckoutData } from "./types";
import { User, Phone, ArrowLeft } from "lucide-react";

interface IdentificacaoStepProps {
  data: CheckoutData;
  onChange: (data: Partial<CheckoutData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function IdentificacaoStep({ data, onChange, onNext, onBack }: IdentificacaoStepProps) {
  useEffect(() => {
    const saved = localStorage.getItem("cardapio_cliente");
    if (saved) {
      try {
        const { nome, whatsapp } = JSON.parse(saved);
        if (nome && !data.nome) onChange({ nome });
        if (whatsapp && !data.whatsapp) onChange({ whatsapp });
      } catch {}
    }
  }, []);

  const isValid = data.nome.trim().length >= 2 && data.whatsapp.replace(/\D/g, "").length >= 10;

  const handleNext = () => {
    localStorage.setItem("cardapio_cliente", JSON.stringify({ nome: data.nome, whatsapp: data.whatsapp }));
    onNext();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        <div>
          <h3 className="text-xl font-black text-gray-900 tracking-tight">Seus dados</h3>
          <p className="text-sm text-gray-400 mt-1">Para enviarmos atualizações do pedido</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Nome *</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={data.nome}
                onChange={(e) => onChange({ nome: e.target.value })}
                placeholder="Seu nome completo"
                className="w-full border-2 border-gray-100 rounded-xl pl-11 pr-4 py-3.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300 focus:bg-white transition-all placeholder:text-gray-400"
                maxLength={100}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">WhatsApp *</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="tel"
                value={data.whatsapp}
                onChange={(e) => onChange({ whatsapp: e.target.value })}
                placeholder="(00) 00000-0000"
                className="w-full border-2 border-gray-100 rounded-xl pl-11 pr-4 py-3.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300 focus:bg-white transition-all placeholder:text-gray-400"
                maxLength={20}
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
          <p className="text-xs text-gray-500 leading-relaxed">
            🔒 Seus dados são usados apenas para o pedido e não serão compartilhados.
          </p>
        </div>
      </div>

      <div className="border-t border-gray-100 p-4 flex gap-3 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <button onClick={onBack} className="w-12 h-12 rounded-xl border-2 border-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={handleNext}
          disabled={!isValid}
          className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-red-500/20 disabled:shadow-none text-[15px]"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
