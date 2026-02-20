import { useState, useEffect } from "react";
import { Produto, OpcionalSelecionado } from "./types";
import { formatCurrencyBRL } from "@/lib/format";
import { Minus, Plus, X, Check } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { motion } from "framer-motion";

interface Props {
  produto: Produto | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (produto: Produto, qtd: number, obs: string, opcionais: OpcionalSelecionado[]) => void;
}

export function ProductDetailModal({ produto, open, onClose, onAddToCart }: Props) {
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState("");
  const [opcionaisSelecionados, setOpcionaisSelecionados] = useState<OpcionalSelecionado[]>([]);

  useEffect(() => {
    if (open) {
      setQuantidade(1);
      setObservacao("");
      setOpcionaisSelecionados([]);
    }
  }, [open, produto?.id]);

  if (!produto) return null;

  const grupos = produto.grupos_opcionais || [];

  const toggleOpcional = (grupoId: string, item: { id: string; nome: string; preco_adicional: number }, maxSelecao: number) => {
    setOpcionaisSelecionados(prev => {
      const exists = prev.find(o => o.item_id === item.id);
      if (exists) return prev.filter(o => o.item_id !== item.id);
      const grupoCount = prev.filter(o => o.grupo_id === grupoId).length;
      if (grupoCount >= maxSelecao) {
        const withoutOldest = prev.filter(o => o.grupo_id !== grupoId).concat(prev.filter(o => o.grupo_id === grupoId).slice(1));
        return [...withoutOldest, { grupo_id: grupoId, item_id: item.id, nome: item.nome, preco_adicional: item.preco_adicional }];
      }
      return [...prev, { grupo_id: grupoId, item_id: item.id, nome: item.nome, preco_adicional: item.preco_adicional }];
    });
  };

  const totalOpcionais = opcionaisSelecionados.reduce((s, o) => s + o.preco_adicional, 0);
  const precoTotal = (produto.preco_venda + totalOpcionais) * quantidade;

  const gruposObrigatorios = grupos.filter(g => g.min_selecao > 0);
  const todosObrigatoriosSatisfeitos = gruposObrigatorios.every(g => {
    const count = opcionaisSelecionados.filter(o => o.grupo_id === g.id).length;
    return count >= g.min_selecao;
  });

  const handleAdd = () => {
    onAddToCart(produto, quantidade, observacao, opcionaisSelecionados);
    onClose();
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[92vh]">
        <div className="overflow-y-auto max-h-[85vh]">
          {/* Image */}
          <div className="relative h-56 sm:h-72 bg-gray-100">
            {produto.imagem_url ? (
              <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 text-7xl">
                🍽️
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/50 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* Info */}
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">{produto.nome}</h2>
              {(produto.descricao_cardapio || produto.observacoes_ficha) && (
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{produto.descricao_cardapio || produto.observacoes_ficha}</p>
              )}
              <p className="text-xl font-black text-gray-900 mt-3">
                {formatCurrencyBRL(produto.preco_venda)}
              </p>
            </div>

            {/* Opcionais */}
            {grupos.map(grupo => {
              const selectedCount = opcionaisSelecionados.filter(o => o.grupo_id === grupo.id).length;
              const isRequired = grupo.min_selecao > 0;
              const isFulfilled = selectedCount >= grupo.min_selecao;
              return (
                <div key={grupo.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-[15px] text-gray-900">{grupo.nome}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {isRequired ? `Escolha ${grupo.min_selecao}` : "Opcional"}
                        {grupo.max_selecao > 1 ? ` até ${grupo.max_selecao}` : ""}
                      </p>
                    </div>
                    {isRequired && (
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        isFulfilled
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-600"
                      }`}>
                        {isFulfilled ? "✓ OK" : "Obrigatório"}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {grupo.itens.map(item => {
                      const selected = opcionaisSelecionados.some(o => o.item_id === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleOpcional(grupo.id, item, grupo.max_selecao)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition-all duration-150 ${
                            selected
                              ? "border-red-400 bg-red-50/50"
                              : "border-gray-100 hover:border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              selected ? "border-red-500 bg-red-500" : "border-gray-300"
                            }`}>
                              {selected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={`text-sm ${selected ? "text-gray-900 font-semibold" : "text-gray-700"}`}>{item.nome}</span>
                          </div>
                          {item.preco_adicional > 0 && (
                            <span className="text-xs font-semibold text-gray-500">
                              +{formatCurrencyBRL(item.preco_adicional)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Observação */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Alguma observação?</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: sem cebola, bem passado..."
                className="w-full border-2 border-gray-100 rounded-xl p-3.5 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300 transition-all bg-gray-50/50 placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Footer fixo */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex items-center gap-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          {/* Quantity */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
              className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 active:scale-90 transition-transform"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-base font-black w-8 text-center text-gray-900">{quantidade}</span>
            <button
              onClick={() => setQuantidade(quantidade + 1)}
              className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 active:scale-90 transition-transform"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Add button */}
          <button
            onClick={handleAdd}
            disabled={!todosObrigatoriosSatisfeitos}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-[15px] shadow-lg shadow-red-500/20 disabled:shadow-none"
          >
            Adicionar • {formatCurrencyBRL(precoTotal)}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
