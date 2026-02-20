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
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-6 left-4 right-4 z-50 max-w-lg mx-auto"
        >
          <button
            onClick={onClick}
            className="w-full bg-red-500 hover:bg-red-600 active:scale-[0.98] text-white rounded-2xl py-4 px-6 flex items-center justify-between shadow-2xl shadow-red-500/30 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingBag className="h-6 w-6" />
                <motion.span
                  key={quantidade}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2.5 bg-white text-red-600 text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                >
                  {quantidade}
                </motion.span>
              </div>
              <span className="font-bold text-[15px]">Ver sacola</span>
            </div>
            <span className="font-black text-lg">{formatCurrencyBRL(total)}</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
