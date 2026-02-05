import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  categorias: string[];
  categoriaAtiva: string;
  onCategoriaChange: (categoria: string) => void;
}

export function CategoryTabs({ categorias, categoriaAtiva, onCategoriaChange }: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Detecta se a barra está "stickada"
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      setIsSticky(scrollTop > 200);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll para o tab ativo
  useEffect(() => {
    if (scrollRef.current) {
      const activeTab = scrollRef.current.querySelector(`[data-categoria="${categoriaAtiva}"]`);
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [categoriaAtiva]);

  if (categorias.length <= 1) return null;

  return (
    <div 
      className={cn(
        "sticky top-0 z-30 border-b transition-all duration-300",
        isSticky 
          ? "bg-white/95 backdrop-blur-md shadow-lg" 
          : "bg-[#faf9f7]"
      )}
    >
      <div className="max-w-4xl mx-auto">
        <div
          ref={scrollRef}
          className="flex overflow-x-auto scrollbar-hide py-4 px-4 gap-3"
        >
          {categorias.map((categoria) => (
            <button
              key={categoria}
              data-categoria={categoria}
              onClick={() => onCategoriaChange(categoria)}
              className={cn(
                "flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                categoriaAtiva === categoria
                  ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg scale-105"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 hover:border-rose-200 hover:text-rose-500"
              )}
            >
              {categoria}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
