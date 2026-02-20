import { Produto } from "./types";
import { Plus, Star } from "lucide-react";
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      onClick={() => onOpenDetails(produto)}
      className="flex gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow text-left w-full group"
    >
      {/* Image */}
      <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        {produto.imagem_url ? (
          <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            🍽️
          </div>
        )}
        {produto.destaque && (
          <span className="absolute top-1 left-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5 fill-current" /> Destaque
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">{produto.nome}</h3>
          {(produto.descricao_cardapio || produto.observacoes_ficha) && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
              {produto.descricao_cardapio || produto.observacoes_ficha}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-emerald-700 font-bold text-sm">
            {formatCurrencyBRL(produto.preco_venda)}
          </span>
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow group-hover:scale-110 transition-transform">
            <Plus className="h-4 w-4" strokeWidth={3} />
          </div>
        </div>
      </div>
    </motion.button>
  );
}
