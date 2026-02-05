import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrencyBRL } from "@/lib/format";

interface FloatingCartButtonProps {
  quantidade: number;
  total: number;
  onClick: () => void;
}

export function FloatingCartButton({ quantidade, total, onClick }: FloatingCartButtonProps) {
  if (quantidade === 0) {
    // Botão simples quando vazio
    return (
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl bg-emerald-500 hover:bg-emerald-600 text-white z-30"
        size="icon"
        onClick={onClick}
      >
        <ShoppingCart className="h-6 w-6" />
      </Button>
    );
  }

  // Barra expandida com total quando tem itens
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 left-4 right-4 max-w-md mx-auto bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-xl py-4 px-5 flex items-center justify-between z-30 transition-all active:scale-[0.98]"
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <ShoppingCart className="h-6 w-6" />
          <span className="absolute -top-2 -right-2 bg-white text-emerald-600 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {quantidade}
          </span>
        </div>
        <span className="font-medium">
          Ver carrinho
        </span>
      </div>
      <span className="font-bold text-lg">
        {formatCurrencyBRL(total)}
      </span>
    </button>
  );
}
