import { MapPin, Store, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DadosEntrega, TipoEntrega } from "./types";

interface DeliveryStepProps {
  dados: DadosEntrega;
  onChange: (dados: DadosEntrega) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DeliveryStep({ dados, onChange, onNext, onBack }: DeliveryStepProps) {
  const isValid = dados.nome.trim() && dados.whatsapp.trim() && (dados.tipo === 'retirada' || dados.endereco.trim());

  return (
    <>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Tipo de entrega */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-800">Como deseja receber?</Label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { tipo: 'retirada' as TipoEntrega, icon: Store, label: 'Retirar no local' },
              { tipo: 'entrega' as TipoEntrega, icon: MapPin, label: 'Entrega' },
            ]).map(({ tipo, icon: Icon, label }) => (
              <button
                key={tipo}
                onClick={() => onChange({ ...dados, tipo })}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  dados.tipo === tipo
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dados pessoais */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-800">Seus dados</Label>
          <div>
            <Label htmlFor="nome" className="text-xs text-gray-500">Nome *</Label>
            <Input
              id="nome"
              placeholder="Seu nome completo"
              value={dados.nome}
              onChange={(e) => onChange({ ...dados, nome: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="whatsapp" className="text-xs text-gray-500">WhatsApp *</Label>
            <Input
              id="whatsapp"
              placeholder="(00) 00000-0000"
              value={dados.whatsapp}
              onChange={(e) => onChange({ ...dados, whatsapp: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>

        {/* Endereço (apenas para entrega) */}
        {dados.tipo === 'entrega' && (
          <div className="space-y-2">
            <Label htmlFor="endereco" className="text-xs text-gray-500">Endereço de entrega *</Label>
            <Textarea
              id="endereco"
              placeholder="Rua, número, bairro, complemento..."
              value={dados.endereco}
              onChange={(e) => onChange({ ...dados, endereco: e.target.value })}
              className="mt-1 resize-none"
              rows={3}
            />
          </div>
        )}
      </div>

      <div className="border-t bg-white p-4 flex-shrink-0 space-y-2">
        <Button
          className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-semibold rounded-xl shadow-lg"
          onClick={onNext}
          disabled={!isValid}
        >
          Continuar para pagamento
        </Button>
        <Button variant="ghost" className="w-full gap-2 text-gray-500" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Voltar ao carrinho
        </Button>
      </div>
    </>
  );
}
