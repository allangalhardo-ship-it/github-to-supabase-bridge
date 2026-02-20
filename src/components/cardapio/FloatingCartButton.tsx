import { ShoppingBag } from "lucide-react";
import { formatCurrencyBRL } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingCartButtonProps {
  quantidade: number;
  total: number;
  onClick: () => void;
}

export function FloatingCartButton({ quantidade, total, onClick }: FloatingCartButtonProps) {
  return (
    <AnimatePresence>
      {quantidade > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-4 right-4 z-50 max-w-lg mx-auto"
        >
          <button
            onClick={onClick}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-4 px-6 flex items-center justify-between shadow-xl shadow-emerald-900/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingBag className="h-6 w-6" />
                <span className="absolute -top-2 -right-2 bg-white text-emerald-700 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {quantidade}
                </span>
              </div>
              <span className="font-semibold">Ver carrinho</span>
            </div>
            <span className="font-bold text-lg">{formatCurrencyBRL(total)}</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
