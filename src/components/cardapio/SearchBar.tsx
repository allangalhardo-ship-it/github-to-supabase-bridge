import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  totalResultados?: number;
}

export function SearchBar({ value, onChange, totalResultados }: SearchBarProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 mt-5">
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-red-500 transition-colors" />
        <input
          type="text"
          placeholder="Buscar no cardápio..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-11 pr-10 py-3 bg-gray-50 rounded-2xl border border-gray-100 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300 focus:bg-white transition-all"
        />
        <AnimatePresence>
          {value && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              onClick={() => onChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-300 transition-colors"
            >
              <X className="h-3 w-3" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {totalResultados !== undefined && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-gray-400 mt-2 px-2 font-medium"
          >
            {totalResultados} {totalResultados === 1 ? "resultado" : "resultados"}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
