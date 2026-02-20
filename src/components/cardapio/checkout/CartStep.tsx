import { CarrinhoItem } from "../types";
import { formatCurrencyBRL } from "@/lib/format";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <ShoppingBag className="h-5 w-5 text-red-500" />
          <h3 className="text-lg font-black text-gray-900">Sua sacola</h3>
          <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{carrinho.length} {carrinho.length === 1 ? "item" : "itens"}</span>
        </div>
        
        <AnimatePresence>
          {carrinho.map((item) => {
            const opTotal = item.opcionais.reduce((s, o) => s + o.preco_adicional, 0);
            const itemTotal = (item.produto.preco_venda + opTotal) * item.quantidade;
            return (
              <motion.div
                key={item.carrinhoKey}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm"
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {item.produto.imagem_url ? (
                    <img src={item.produto.imagem_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl bg-gray-50">🍽️</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-bold text-gray-900 line-clamp-1 pr-2">{item.produto.nome}</h4>
                    <button onClick={() => onDelete(item.carrinhoKey)} className="text-gray-300 hover:text-red-500 p-1 -mr-1 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {item.opcionais.length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">
                      {item.opcionais.map(o => o.nome).join(", ")}
                    </p>
                  )}
                  {item.observacao && (
                    <p className="text-[11px] text-gray-400 italic line-clamp-1">📝 {item.observacao}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-0 bg-gray-50 rounded-full border border-gray-100 p-0.5">
                      <button onClick={() => onRemove(item.carrinhoKey)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white transition-colors active:scale-90">
                        <Minus className="h-3 w-3 text-red-500" />
                      </button>
                      <span className="text-sm font-black w-6 text-center text-gray-900">{item.quantidade}</span>
                      <button onClick={() => onAdd(item.carrinhoKey)} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white transition-colors active:scale-90">
                        <Plus className="h-3 w-3 text-red-500" />
                      </button>
                    </div>
                    <span className="text-sm font-extrabold text-gray-900">{formatCurrencyBRL(itemTotal)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="border-t border-gray-100 p-4 space-y-3 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Subtotal</span>
          <span className="text-lg font-black text-gray-900">{formatCurrencyBRL(subtotal)}</span>
        </div>
        <button
          onClick={onNext}
          className="w-full bg-red-500 hover:bg-red-600 active:scale-[0.98] text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-red-500/20 text-[15px]"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
