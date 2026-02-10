import { useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  totalResultados?: number;
}

export function SearchBar({ value, onChange, totalResultados }: SearchBarProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 py-3">
      <div
        className={cn(
          "relative flex items-center bg-white rounded-2xl border transition-all duration-200 shadow-sm",
          focused
            ? "border-rose-300 shadow-md ring-2 ring-rose-100"
            : "border-gray-200 hover:border-gray-300"
        )}
      >
        <Search className="absolute left-4 h-4.5 w-4.5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar no cardápio..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full pl-11 pr-10 py-3 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none rounded-2xl"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-3 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>
      {value && totalResultados !== undefined && (
        <p className="text-xs text-gray-500 mt-2 px-1">
          {totalResultados === 0
            ? "Nenhum produto encontrado"
            : `${totalResultados} ${totalResultados === 1 ? "produto encontrado" : "produtos encontrados"}`}
        </p>
      )}
    </div>
  );
}
