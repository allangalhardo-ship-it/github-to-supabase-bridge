import { ArrowLeft, MapPin, Store, CreditCard, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrencyBRL } from "@/lib/format";
import { CarrinhoItem } from "../types";
import { DadosEntrega, DadosPagamento, FORMAS_PAGAMENTO_LABELS } from "./types";

interface ConfirmationStepProps {
  carrinho: CarrinhoItem[];
  entrega: DadosEntrega;
  pagamento: DadosPagamento;
  observacoes: string;
  onObservacoesChange: (obs: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  enviando: boolean;
}

function calcularPrecoItem(item: CarrinhoItem) {
  const totalOpcionais = item.opcionais.reduce((sum, op) => sum + op.preco_adicional, 0);
  return (item.produto.preco_venda + totalOpcionais) * item.quantidade;
}

export function ConfirmationStep({
  carrinho, entrega, pagamento, observacoes, onObservacoesChange, onConfirm, onBack, enviando
}: ConfirmationStepProps) {
  const total = carrinho.reduce((sum, item) => sum + calcularPrecoItem(item), 0);

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-4">
          {/* Itens resumo */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">Itens do pedido</h3>
            {carrinho.map((item) => (
              <div key={item.carrinhoKey} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {item.quantidade}x {item.produto.nome}
                  {item.opcionais.length > 0 && (
                    <span className="text-xs text-gray-400 block">
                      {item.opcionais.map(o => o.item_nome).join(', ')}
                    </span>
                  )}
                </span>
                <span className="font-medium text-gray-800 flex-shrink-0 ml-2">
                  {formatCurrencyBRL(calcularPrecoItem(item))}
                </span>
              </div>
            ))}
          </div>

          {/* Entrega */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              {entrega.tipo === 'retirada' ? <Store className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
              {entrega.tipo === 'retirada' ? 'Retirada no local' : 'Entrega'}
            </div>
            <div className="text-sm text-gray-600 space-y-0.5">
              <p>👤 {entrega.nome}</p>
              <p>📱 {entrega.whatsapp}</p>
              {entrega.tipo === 'entrega' && entrega.endereco && (
                <p>📍 {entrega.endereco}</p>
              )}
            </div>
          </div>

          {/* Pagamento */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <CreditCard className="h-4 w-4" />
              Pagamento
            </div>
            <p className="text-sm text-gray-600">{FORMAS_PAGAMENTO_LABELS[pagamento.forma]}</p>
            {pagamento.forma === 'dinheiro' && pagamento.troco_para && (
              <p className="text-xs text-amber-700">
                Troco para {formatCurrencyBRL(pagamento.troco_para)} → Troco: {formatCurrencyBRL(pagamento.troco_para - total)}
              </p>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-800">Observações do pedido (opcional)</Label>
            <Textarea
              placeholder="Alguma observação geral?"
              value={observacoes}
              onChange={(e) => onObservacoesChange(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>

          {/* Total */}
          <div className="border-t pt-3 flex justify-between text-xl font-bold">
            <span className="text-gray-800">Total</span>
            <span className="text-emerald-600">{formatCurrencyBRL(total)}</span>
          </div>
        </div>
      </ScrollArea>

      <div className="border-t bg-white p-4 flex-shrink-0 space-y-2">
        <Button
          className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-semibold rounded-xl shadow-lg gap-2"
          onClick={onConfirm}
          disabled={enviando}
        >
          {enviando ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              Confirmar pedido
            </>
          )}
        </Button>
        <Button variant="ghost" className="w-full gap-2 text-gray-500" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
      </div>
    </>
  );
}
