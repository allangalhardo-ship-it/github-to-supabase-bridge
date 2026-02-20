import { useRef, useEffect } from "react";

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
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm mt-4">
      <div
        ref={scrollRef}
        className="max-w-2xl mx-auto flex gap-1 overflow-x-auto scrollbar-hide px-4 py-2"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {categorias.map((cat) => {
          const isActive = cat === categoriaAtiva;
          return (
            <button
              key={cat}
              ref={isActive ? activeRef : undefined}
              onClick={() => onCategoriaChange(cat)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
