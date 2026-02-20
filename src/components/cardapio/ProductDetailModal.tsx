import { useState, useEffect } from "react";
import { Produto, OpcionalSelecionado } from "./types";
import { formatCurrencyBRL } from "@/lib/format";
import { Minus, Plus, X } from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";

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
      if (exists) {
        return prev.filter(o => o.item_id !== item.id);
      }
      const grupoCount = prev.filter(o => o.grupo_id === grupoId).length;
      if (grupoCount >= maxSelecao) {
        // Replace oldest selection in this group
        const withoutOldest = prev.filter(o => o.grupo_id !== grupoId).concat(
          prev.filter(o => o.grupo_id === grupoId).slice(1)
        );
        return [...withoutOldest, { grupo_id: grupoId, item_id: item.id, nome: item.nome, preco_adicional: item.preco_adicional }];
      }
      return [...prev, { grupo_id: grupoId, item_id: item.id, nome: item.nome, preco_adicional: item.preco_adicional }];
    });
  };

  const totalOpcionais = opcionaisSelecionados.reduce((s, o) => s + o.preco_adicional, 0);
  const precoTotal = (produto.preco_venda + totalOpcionais) * quantidade;

  // Check if required groups are fulfilled
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
          <div className="relative h-48 sm:h-64 bg-gray-100">
            {produto.imagem_url ? (
              <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-emerald-50 to-emerald-100">
                🍽️
              </div>
            )}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Info */}
            <div>
              <h2 className="text-xl font-bold text-gray-900">{produto.nome}</h2>
              {(produto.descricao_cardapio || produto.observacoes_ficha) && (
                <p className="text-sm text-gray-500 mt-1">{produto.descricao_cardapio || produto.observacoes_ficha}</p>
              )}
              <p className="text-lg font-bold text-emerald-700 mt-2">
                {formatCurrencyBRL(produto.preco_venda)}
              </p>
            </div>

            {/* Opcionais */}
            {grupos.map(grupo => {
              const selectedCount = opcionaisSelecionados.filter(o => o.grupo_id === grupo.id).length;
              return (
                <div key={grupo.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm text-gray-800">{grupo.nome}</h3>
                      <p className="text-xs text-gray-400">
                        {grupo.min_selecao > 0 ? `Escolha ${grupo.min_selecao}` : "Opcional"}
                        {grupo.max_selecao > 1 ? ` até ${grupo.max_selecao}` : ""}
                      </p>
                    </div>
                    {grupo.min_selecao > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedCount >= grupo.min_selecao
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {selectedCount >= grupo.min_selecao ? "✓" : "Obrigatório"}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {grupo.itens.map(item => {
                      const selected = opcionaisSelecionados.some(o => o.item_id === item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleOpcional(grupo.id, item, grupo.max_selecao)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                            selected
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selected ? "border-emerald-500 bg-emerald-500" : "border-gray-300"
                            }`}>
                              {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <span className="text-sm text-gray-700">{item.nome}</span>
                          </div>
                          {item.preco_adicional > 0 && (
                            <span className="text-xs font-medium text-gray-500">
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
              <label className="text-sm font-medium text-gray-700">Alguma observação?</label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: sem cebola, bem passado..."
                className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>
        </div>

        {/* Footer fixo */}
        <div className="sticky bottom-0 bg-white border-t p-4 flex items-center gap-4">
          {/* Quantity */}
          <div className="flex items-center gap-3 bg-gray-100 rounded-full px-1 py-1">
            <button
              onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="text-base font-bold w-6 text-center">{quantidade}</span>
            <button
              onClick={() => setQuantidade(quantidade + 1)}
              className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Add button */}
          <button
            onClick={handleAdd}
            disabled={!todosObrigatoriosSatisfeitos}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            Adicionar {formatCurrencyBRL(precoTotal)}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
