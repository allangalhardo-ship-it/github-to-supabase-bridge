import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckoutData } from "./types";
import { BairroEntrega, Empresa } from "../types";
import { formatCurrencyBRL } from "@/lib/format";
import { MapPin, Store, ArrowLeft, Bike, Check, Navigation } from "lucide-react";

interface EntregaStepProps {
  data: CheckoutData;
  empresa: Empresa;
  subtotal: number;
  onChange: (data: Partial<CheckoutData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function EntregaStep({ data, empresa, subtotal, onChange, onNext, onBack }: EntregaStepProps) {
  const [bairros, setBairros] = useState<BairroEntrega[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBairros = async () => {
      const { data: bairrosData } = await supabase
        .from("bairros_entrega").select("*").eq("empresa_id", empresa.id).eq("ativo", true).order("ordem");
      setBairros((bairrosData as BairroEntrega[]) || []);
      setLoading(false);
    };
    if (empresa.entrega_ativa) fetchBairros();
    else setLoading(false);
  }, [empresa.id]);

  const handleTipoEntrega = (tipo: "retirada" | "entrega") => {
    onChange({ tipo_entrega: tipo, taxa_entrega: 0, bairro_id: "", bairro_nome: "", endereco: "", complemento: "" });
  };

  const handleBairroSelect = (bairro: BairroEntrega) => {
    onChange({ bairro_id: bairro.id, bairro_nome: bairro.nome, taxa_entrega: bairro.taxa_entrega });
  };

  const isValid = data.tipo_entrega === "retirada" || (data.tipo_entrega === "entrega" && data.bairro_id && data.endereco.trim().length > 3);
  const pedidoMinimoOk = data.tipo_entrega === "retirada" || subtotal >= empresa.pedido_minimo;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        <div>
          <h3 className="text-xl font-black text-gray-900 tracking-tight">Como deseja receber?</h3>
        </div>

        {/* Toggle tipo entrega */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleTipoEntrega("retirada")}
            className={`flex flex-col items-center gap-2.5 p-5 rounded-2xl border-2 transition-all duration-200 ${
              data.tipo_entrega === "retirada"
                ? "border-red-400 bg-red-50/50 shadow-lg shadow-red-500/10"
                : "border-gray-100 hover:border-gray-200 bg-white"
            }`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              data.tipo_entrega === "retirada" ? "bg-red-100" : "bg-gray-100"
            }`}>
              <Store className={`h-6 w-6 ${data.tipo_entrega === "retirada" ? "text-red-500" : "text-gray-400"}`} />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">Retirar</p>
              <p className="text-[11px] text-emerald-600 font-semibold">Grátis</p>
            </div>
          </button>

          {empresa.entrega_ativa && (
            <button
              onClick={() => handleTipoEntrega("entrega")}
              className={`flex flex-col items-center gap-2.5 p-5 rounded-2xl border-2 transition-all duration-200 ${
                data.tipo_entrega === "entrega"
                  ? "border-red-400 bg-red-50/50 shadow-lg shadow-red-500/10"
                  : "border-gray-100 hover:border-gray-200 bg-white"
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                data.tipo_entrega === "entrega" ? "bg-red-100" : "bg-gray-100"
              }`}>
                <Bike className={`h-6 w-6 ${data.tipo_entrega === "entrega" ? "text-red-500" : "text-gray-400"}`} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-900">Entrega</p>
                <p className="text-[11px] text-gray-400">{empresa.tempo_estimado_entrega || "30-50 min"}</p>
              </div>
            </button>
          )}
        </div>

        {/* Entrega details */}
        {data.tipo_entrega === "entrega" && (
          <div className="space-y-5">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : bairros.length > 0 ? (
              <div className="space-y-2.5">
                <label className="text-sm font-bold text-gray-700">Selecione o bairro *</label>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {bairros.map(bairro => {
                    const isSelected = data.bairro_id === bairro.id;
                    return (
                      <button
                        key={bairro.id}
                        onClick={() => handleBairroSelect(bairro)}
                        className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? "border-red-400 bg-red-50/50"
                            : "border-gray-100 hover:border-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? "border-red-500 bg-red-500" : "border-gray-300"
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{bairro.nome}</span>
                        </div>
                        <span className={`text-sm font-bold ${bairro.taxa_entrega === 0 ? "text-emerald-600" : "text-gray-700"}`}>
                          {bairro.taxa_entrega === 0 ? "Grátis" : formatCurrencyBRL(bairro.taxa_entrega)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Nenhum bairro cadastrado para entrega.</p>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Endereço *</label>
              <div className="relative">
                <Navigation className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                <input
                  type="text" value={data.endereco}
                  onChange={(e) => onChange({ endereco: e.target.value })}
                  placeholder="Rua, número"
                  className="w-full border-2 border-gray-100 rounded-xl pl-11 pr-4 py-3.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300 focus:bg-white transition-all"
                  maxLength={200}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Complemento</label>
              <input
                type="text" value={data.complemento}
                onChange={(e) => onChange({ complemento: e.target.value })}
                placeholder="Apt, bloco, referência..."
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-3.5 text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300 focus:bg-white transition-all"
                maxLength={100}
              />
            </div>

            {!pedidoMinimoOk && empresa.pedido_minimo > 0 && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3.5 text-sm text-amber-700 font-medium">
                ⚠️ Pedido mínimo para entrega: {formatCurrencyBRL(empresa.pedido_minimo)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 p-4 flex gap-3 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <button onClick={onBack} className="w-12 h-12 rounded-xl border-2 border-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={onNext}
          disabled={!isValid || !pedidoMinimoOk}
          className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-red-500/20 disabled:shadow-none text-[15px]"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
