import { Produto } from "./types";
import { Plus, Star, Flame } from "lucide-react";
import { formatCurrencyBRL } from "@/lib/format";
import { motion } from "framer-motion";

interface ProductCardProps {
  produto: Produto;
  onOpenDetails: (produto: Produto) => void;
  index: number;
}

export function ProductCard({ produto, onOpenDetails, index }: ProductCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: "easeOut" }}
      onClick={() => onOpenDetails(produto)}
      className="flex gap-3 p-3 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/80 transition-all duration-200 text-left w-full group active:scale-[0.98]"
    >
      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            {produto.destaque && (
              <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                <Flame className="h-2.5 w-2.5" /> Popular
              </span>
            )}
          </div>
          <h3 className="font-bold text-gray-900 text-[15px] line-clamp-2 leading-snug">{produto.nome}</h3>
          {(produto.descricao_cardapio || produto.observacoes_ficha) && (
            <p className="text-[13px] text-gray-400 mt-1 line-clamp-2 leading-relaxed">
              {produto.descricao_cardapio || produto.observacoes_ficha}
            </p>
          )}
        </div>
        <div className="flex items-end justify-between mt-2.5">
          <div>
            <span className="text-[15px] font-extrabold text-gray-900">
              {formatCurrencyBRL(produto.preco_venda)}
            </span>
          </div>
        </div>
      </div>

      {/* Image */}
      <div className="relative w-[108px] h-[108px] flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
        {produto.imagem_url ? (
          <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 text-3xl">
            🍽️
          </div>
        )}
        {/* Add button overlapping image */}
        <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/30 group-hover:scale-110 transition-transform duration-200">
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </div>
      </div>
    </motion.button>
  );
}
