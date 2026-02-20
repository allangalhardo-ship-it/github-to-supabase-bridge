import { CarrinhoItem } from "../types";
import { formatCurrencyBRL } from "@/lib/format";
import { Minus, Plus, Trash2 } from "lucide-react";

interface CartStepProps {
  carrinho: CarrinhoItem[];
  onAdd: (key: string) => void;
  onRemove: (key: string) => void;
  onDelete: (key: string) => void;
  onNext: () => void;
}

export function CartStep({ carrinho, onAdd, onRemove, onDelete, onNext }: CartStepProps) {
  const subtotal = carrinho.reduce((t, item) => {
    const opTotal = item.opcionais.reduce((s, o) => s + o.preco_adicional, 0);
    return t + (item.produto.preco_venda + opTotal) * item.quantidade;
  }, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {carrinho.map((item) => {
          const opTotal = item.opcionais.reduce((s, o) => s + o.preco_adicional, 0);
          const itemTotal = (item.produto.preco_venda + opTotal) * item.quantidade;
          return (
            <div key={item.carrinhoKey} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                {item.produto.imagem_url ? (
                  <img src={item.produto.imagem_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-semibold text-gray-900 truncate pr-2">{item.produto.nome}</h4>
                  <button onClick={() => onDelete(item.carrinhoKey)} className="text-gray-400 hover:text-red-500 p-0.5">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {item.opcionais.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {item.opcionais.map(o => o.nome).join(", ")}
                  </p>
                )}
                {item.observacao && (
                  <p className="text-[11px] text-gray-400 italic">📝 {item.observacao}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2 bg-white rounded-full border px-1 py-0.5">
                    <button onClick={() => onRemove(item.carrinhoKey)} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-bold w-4 text-center">{item.quantidade}</span>
                    <button onClick={() => onAdd(item.carrinhoKey)} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-sm font-bold text-emerald-700">{formatCurrencyBRL(itemTotal)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Subtotal</span>
          <span className="font-bold text-gray-900">{formatCurrencyBRL(subtotal)}</span>
        </div>
        <button
          onClick={onNext}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-colors"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
