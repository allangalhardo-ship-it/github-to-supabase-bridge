import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  totalResultados?: number;
}

export function SearchBar({ value, onChange, totalResultados }: SearchBarProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 mt-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar no cardápio..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-10 py-3 bg-white rounded-xl border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {totalResultados !== undefined && (
        <p className="text-xs text-gray-400 mt-1 px-1">
          {totalResultados} {totalResultados === 1 ? "resultado" : "resultados"}
        </p>
      )}
    </div>
  );
}
