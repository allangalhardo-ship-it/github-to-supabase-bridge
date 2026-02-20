import { ShoppingCart, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrencyBRL } from "@/lib/format";
import { CarrinhoItem } from "../types";

interface CartStepProps {
  carrinho: CarrinhoItem[];
  onAddItem: (carrinhoKey: string) => void;
  onRemoveItem: (carrinhoKey: string) => void;
  onDeleteItem: (carrinhoKey: string) => void;
  onNext: () => void;
}

function calcularPrecoItem(item: CarrinhoItem) {
  const totalOpcionais = item.opcionais.reduce((sum, op) => sum + op.preco_adicional, 0);
  return (item.produto.preco_venda + totalOpcionais) * item.quantidade;
}

export function CartStep({ carrinho, onAddItem, onRemoveItem, onDeleteItem, onNext }: CartStepProps) {
  const totalCarrinho = carrinho.reduce((total, item) => total + calcularPrecoItem(item), 0);

  if (carrinho.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
        <ShoppingCart className="h-20 w-20 mb-4 opacity-30" />
        <p className="text-lg font-medium">Seu carrinho está vazio</p>
        <p className="text-sm mt-1 text-center">Adicione produtos para fazer seu pedido</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {carrinho.map((item) => (
            <div key={item.carrinhoKey} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                {item.produto.imagem_url && (
                  <img
                    src={item.produto.imagem_url}
                    alt={item.produto.nome}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-gray-800 text-sm line-clamp-2">
                      {item.produto.nome}
                    </h4>
                    <button
                      onClick={() => onDeleteItem(item.carrinhoKey)}
                      className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {item.opcionais.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {item.opcionais.map((op) => (
                        <p key={op.item_id} className="text-xs text-gray-500">
                          + {op.item_nome}
                          {op.preco_adicional > 0 && (
                            <span className="text-emerald-600 ml-1">
                              ({formatCurrencyBRL(op.preco_adicional)})
                            </span>
                          )}
                        </p>
                      ))}
                    </div>
                  )}

                  {item.observacao && (
                    <p className="text-xs text-gray-500 mt-0.5 italic">Obs: {item.observacao}</p>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-emerald-600">
                      {formatCurrencyBRL(calcularPrecoItem(item))}
                    </span>
                    <div className="flex items-center gap-1 bg-white rounded-full shadow-sm p-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => onRemoveItem(item.carrinhoKey)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center font-semibold text-sm">{item.quantidade}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => onAddItem(item.carrinhoKey)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t bg-white p-4 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between text-lg">
          <span className="font-medium text-gray-700">Total</span>
          <span className="font-bold text-emerald-600 text-xl">{formatCurrencyBRL(totalCarrinho)}</span>
        </div>
        <Button
          className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-semibold rounded-xl shadow-lg"
          onClick={onNext}
        >
          Continuar
        </Button>
      </div>
    </>
  );
}
