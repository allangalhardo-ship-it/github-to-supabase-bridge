import { Plus, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrencyBRL } from "@/lib/format";
import { Produto, CarrinhoItem } from "./types";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  produto: Produto;
  itemCarrinho?: CarrinhoItem;
  onAddToCart: (produto: Produto) => void;
  onOpenDetails: (produto: Produto) => void;
}

export function ProductCard({ produto, itemCarrinho, onAddToCart, onOpenDetails }: ProductCardProps) {
  const quantidade = itemCarrinho?.quantidade || 0;

  return (
    <Card 
      className={cn(
        "overflow-hidden bg-white border border-gray-100 hover:shadow-lg transition-all cursor-pointer group",
        quantidade > 0 && "ring-2 ring-emerald-500/50"
      )}
      onClick={() => onOpenDetails(produto)}
    >
      {/* Imagem do produto */}
      <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
        {produto.imagem_url ? (
          <img
            src={produto.imagem_url}
            alt={produto.nome}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
            <ImageIcon className="h-12 w-12 text-gray-300" />
          </div>
        )}
        
        {/* Badge de quantidade no carrinho */}
        {quantidade > 0 && (
          <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
            {quantidade}x
          </div>
        )}
      </div>
      
      {/* Info do produto */}
      <div className="p-3 md:p-4">
        <h3 className="font-semibold text-gray-800 text-sm md:text-base line-clamp-1 mb-1">
          {produto.nome}
        </h3>
        
        {produto.observacoes_ficha && (
          <p className="text-xs md:text-sm text-gray-500 line-clamp-2 mb-3 min-h-[2.5rem]">
            {produto.observacoes_ficha}
          </p>
        )}
        
        <div className="flex items-center justify-between mt-auto">
          <span className="font-bold text-emerald-600 text-base md:text-lg">
            {formatCurrencyBRL(produto.preco_venda)}
          </span>
          
          <Button
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full h-9 w-9 p-0 shadow-md"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart(produto);
            }}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
