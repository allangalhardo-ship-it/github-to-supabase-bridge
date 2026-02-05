import { Plus, ImageIcon, Flame, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyBRL } from "@/lib/format";
import { Produto, CarrinhoItem } from "./types";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  produto: Produto;
  itemCarrinho?: CarrinhoItem;
  onAddToCart: (produto: Produto) => void;
  onOpenDetails: (produto: Produto) => void;
  badge?: 'mais_vendido' | 'favorito' | 'novidade' | null;
  index?: number;
}

const badges = {
  mais_vendido: {
    icon: Flame,
    text: 'Mais Vendido',
    className: 'bg-gradient-to-r from-red-500 to-orange-500 text-white',
  },
  favorito: {
    icon: Star,
    text: 'Favorito',
    className: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white',
  },
  novidade: {
    icon: Sparkles,
    text: 'Novidade',
    className: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white',
  },
};

export function ProductCard({ 
  produto, 
  itemCarrinho, 
  onAddToCart, 
  onOpenDetails, 
  badge,
  index = 0 
}: ProductCardProps) {
  const quantidade = itemCarrinho?.quantidade || 0;
  const badgeConfig = badge ? badges[badge] : null;

  return (
    <div 
      className={cn(
        "group overflow-hidden bg-white rounded-2xl shadow-md hover:shadow-xl",
        "transition-all duration-300 ease-out cursor-pointer",
        "hover:scale-[1.02] hover:-translate-y-1",
        "border border-gray-100/50",
        quantidade > 0 && "ring-2 ring-rose-400/50",
        "animate-fade-in"
      )}
      style={{ 
        animationDelay: `${index * 50}ms`,
        animationFillMode: 'backwards'
      }}
      onClick={() => onOpenDetails(produto)}
    >
      {/* Imagem do produto */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
        {produto.imagem_url ? (
          <img
            src={produto.imagem_url}
            alt={produto.nome}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-gray-200" />
          </div>
        )}
        
        {/* Badge de categoria/destaque */}
        {badgeConfig && (
          <div className={cn(
            "absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-lg",
            badgeConfig.className
          )}>
            <badgeConfig.icon className="h-3 w-3" />
            {badgeConfig.text}
          </div>
        )}
        
        {/* Badge de quantidade no carrinho */}
        {quantidade > 0 && (
          <div className="absolute top-3 right-3 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg animate-scale-in">
            {quantidade}x
          </div>
        )}
      </div>
      
      {/* Info do produto */}
      <div className="p-4 md:p-5">
        <h3 className="font-semibold text-gray-800 text-sm md:text-base line-clamp-1 mb-1.5">
          {produto.nome}
        </h3>
        
        {/* Descrição curta */}
        <p className="text-xs md:text-sm text-gray-500 line-clamp-2 mb-4 min-h-[2.5rem] leading-relaxed">
          {produto.observacoes_ficha || "Delicioso produto artesanal feito com ingredientes selecionados."}
        </p>
        
        <div className="flex items-center justify-between">
          <span className="font-bold text-rose-500 text-lg md:text-xl">
            {formatCurrencyBRL(produto.preco_venda)}
          </span>
          
          <Button
            size="sm"
            className={cn(
              "rounded-full h-10 w-10 p-0 shadow-lg",
              "bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600",
              "transition-all duration-200 hover:scale-110 active:scale-95"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(produto);
            }}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
