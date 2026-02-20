import { ArrowLeft, Banknote, CreditCard, QrCode, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DadosPagamento, FormaPagamento } from "./types";
import { formatCurrencyBRL } from "@/lib/format";

interface PaymentStepProps {
  dados: DadosPagamento;
  total: number;
  onChange: (dados: DadosPagamento) => void;
  onNext: () => void;
  onBack: () => void;
}

const FORMAS = [
  { forma: 'pix' as FormaPagamento, icon: QrCode, label: 'PIX' },
  { forma: 'dinheiro' as FormaPagamento, icon: Banknote, label: 'Dinheiro' },
  { forma: 'cartao_credito' as FormaPagamento, icon: CreditCard, label: 'Crédito' },
  { forma: 'cartao_debito' as FormaPagamento, icon: Wallet, label: 'Débito' },
];

export function PaymentStep({ dados, total, onChange, onNext, onBack }: PaymentStepProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-gray-800">Forma de pagamento</Label>
          <div className="grid grid-cols-2 gap-3">
            {FORMAS.map(({ forma, icon: Icon, label }) => (
              <button
                key={forma}
                onClick={() => onChange({ ...dados, forma, troco_para: undefined })}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  dados.forma === forma
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

        {dados.forma === 'dinheiro' && (
          <div className="space-y-2 bg-amber-50 p-4 rounded-xl border border-amber-200">
            <Label htmlFor="troco" className="text-sm font-medium text-amber-800">
              Precisa de troco? (Total: {formatCurrencyBRL(total)})
            </Label>
            <Input
              id="troco"
              type="number"
              placeholder="Troco para quanto?"
              value={dados.troco_para || ''}
              onChange={(e) => onChange({ ...dados, troco_para: e.target.value ? Number(e.target.value) : undefined })}
              className="mt-1"
            />
            {dados.troco_para && dados.troco_para > total && (
              <p className="text-xs text-amber-700">
                Troco: {formatCurrencyBRL(dados.troco_para - total)}
              </p>
            )}
          </div>
        )}

        {/* Resumo */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrencyBRL(total)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between text-lg font-bold text-gray-800">
            <span>Total</span>
            <span className="text-emerald-600">{formatCurrencyBRL(total)}</span>
          </div>
        </div>
      </div>

      <div className="border-t bg-white p-4 flex-shrink-0 space-y-2">
        <Button
          className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-semibold rounded-xl shadow-lg"
          onClick={onNext}
        >
          Revisar pedido
        </Button>
        <Button variant="ghost" className="w-full gap-2 text-gray-500" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      </div>
    </>
  );
}
