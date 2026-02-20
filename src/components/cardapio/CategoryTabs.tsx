import { useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface CategoryTabsProps {
  categorias: string[];
  categoriaAtiva: string;
  onCategoriaChange: (cat: string) => void;
}

export function CategoryTabs({ categorias, categoriaAtiva, onCategoriaChange }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = activeRef.current;
      const left = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left, behavior: "smooth" });
    }
  }, [categoriaAtiva]);

  if (categorias.length <= 1) return null;

  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-lg border-b border-gray-100 mt-5">
      <div
        ref={scrollRef}
        className="max-w-2xl mx-auto flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {categorias.map((cat) => {
          const isActive = cat === categoriaAtiva;
          return (
            <button
              key={cat}
              ref={isActive ? activeRef : undefined}
              onClick={() => onCategoriaChange(cat)}
              className={`relative flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/25"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
