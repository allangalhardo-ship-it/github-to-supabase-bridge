import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckoutData } from "./types";
import { BairroEntrega, Empresa } from "../types";
import { formatCurrencyBRL } from "@/lib/format";
import { MapPin, Store } from "lucide-react";

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
        .from("bairros_entrega")
        .select("*")
        .eq("empresa_id", empresa.id)
        .eq("ativo", true)
        .order("ordem");
      setBairros((bairrosData as BairroEntrega[]) || []);
      setLoading(false);
    };
    if (empresa.entrega_ativa) fetchBairros();
    else setLoading(false);
  }, [empresa.id]);

  const handleTipoEntrega = (tipo: "retirada" | "entrega") => {
    onChange({ 
      tipo_entrega: tipo, 
      taxa_entrega: 0, 
      bairro_id: "", 
      bairro_nome: "",
      endereco: "",
      complemento: "" 
    });
  };

  const handleBairroSelect = (bairro: BairroEntrega) => {
    onChange({ 
      bairro_id: bairro.id, 
      bairro_nome: bairro.nome, 
      taxa_entrega: bairro.taxa_entrega 
    });
  };

  const isValid = data.tipo_entrega === "retirada" || (
    data.tipo_entrega === "entrega" && data.bairro_id && data.endereco.trim().length > 3
  );

  const pedidoMinimoOk = data.tipo_entrega === "retirada" || subtotal >= empresa.pedido_minimo;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Como deseja receber?</h3>
        </div>

        {/* Toggle tipo entrega */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleTipoEntrega("retirada")}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              data.tipo_entrega === "retirada"
                ? "border-emerald-500 bg-emerald-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <Store className={`h-6 w-6 ${data.tipo_entrega === "retirada" ? "text-emerald-600" : "text-gray-400"}`} />
            <span className="text-sm font-semibold">Retirar no local</span>
            <span className="text-xs text-gray-400">Grátis</span>
          </button>

          {empresa.entrega_ativa && (
            <button
              onClick={() => handleTipoEntrega("entrega")}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                data.tipo_entrega === "entrega"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <MapPin className={`h-6 w-6 ${data.tipo_entrega === "entrega" ? "text-emerald-600" : "text-gray-400"}`} />
              <span className="text-sm font-semibold">Entrega</span>
              <span className="text-xs text-gray-400">{empresa.tempo_estimado_entrega || "30-50 min"}</span>
            </button>
          )}
        </div>

        {/* Entrega details */}
        {data.tipo_entrega === "entrega" && (
          <div className="space-y-4">
            {/* Bairro selection */}
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : bairros.length > 0 ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Selecione o bairro *</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {bairros.map(bairro => (
                    <button
                      key={bairro.id}
                      onClick={() => handleBairroSelect(bairro)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all text-sm ${
                        data.bairro_id === bairro.id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span>{bairro.nome}</span>
                      <span className="font-semibold text-emerald-700">
                        {bairro.taxa_entrega === 0 ? "Grátis" : formatCurrencyBRL(bairro.taxa_entrega)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                Nenhum bairro cadastrado para entrega.
              </p>
            )}

            {/* Endereço */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Endereço *</label>
              <input
                type="text"
                value={data.endereco}
                onChange={(e) => onChange({ endereco: e.target.value })}
                placeholder="Rua, número"
                className="w-full border border-gray-200 rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Complemento</label>
              <input
                type="text"
                value={data.complemento}
                onChange={(e) => onChange({ complemento: e.target.value })}
                placeholder="Apt, bloco, referência..."
                className="w-full border border-gray-200 rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                maxLength={100}
              />
            </div>

            {/* Pedido mínimo alert */}
            {!pedidoMinimoOk && empresa.pedido_minimo > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                Pedido mínimo para entrega: {formatCurrencyBRL(empresa.pedido_minimo)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t p-4 flex gap-3">
        <button onClick={onBack} className="px-6 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Voltar
        </button>
        <button
          onClick={onNext}
          disabled={!isValid || !pedidoMinimoOk}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
