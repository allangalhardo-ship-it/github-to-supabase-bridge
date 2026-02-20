import { useState, useEffect } from "react";
import { CheckoutData } from "./types";

interface IdentificacaoStepProps {
  data: CheckoutData;
  onChange: (data: Partial<CheckoutData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function IdentificacaoStep({ data, onChange, onNext, onBack }: IdentificacaoStepProps) {
  // Carregar dados salvos do localStorage
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
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Seus dados</h3>
          <p className="text-sm text-gray-500">Para enviarmos atualizações do seu pedido</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Nome *</label>
            <input
              type="text"
              value={data.nome}
              onChange={(e) => onChange({ nome: e.target.value })}
              placeholder="Seu nome"
              className="w-full border border-gray-200 rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">WhatsApp *</label>
            <input
              type="tel"
              value={data.whatsapp}
              onChange={(e) => onChange({ whatsapp: e.target.value })}
              placeholder="(00) 00000-0000"
              className="w-full border border-gray-200 rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              maxLength={20}
            />
          </div>
        </div>
      </div>

      <div className="border-t p-4 flex gap-3">
        <button onClick={onBack} className="px-6 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Voltar
        </button>
        <button
          onClick={handleNext}
          disabled={!isValid}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
