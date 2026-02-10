import { useState, useEffect, useMemo } from "react";
import { Minus, Plus, ImageIcon, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatCurrencyBRL } from "@/lib/format";
import { Produto, OpcionalSelecionado } from "./types";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";

interface ProductDetailModalProps {
  produto: Produto | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (produto: Produto, quantidade: number, observacao: string, opcionais: OpcionalSelecionado[]) => void;
  quantidadeInicial?: number;
  observacaoInicial?: string;
  opcionaisIniciais?: OpcionalSelecionado[];
}

export function ProductDetailModal({ 
  produto, 
  open, 
  onClose, 
  onAddToCart,
  quantidadeInicial = 1,
  observacaoInicial = "",
  opcionaisIniciais = []
}: ProductDetailModalProps) {
  const [quantidade, setQuantidade] = useState(quantidadeInicial);
  const [observacao, setObservacao] = useState(observacaoInicial);
  const [opcionaisSelecionados, setOpcionaisSelecionados] = useState<OpcionalSelecionado[]>(opcionaisIniciais);

  useEffect(() => {
    if (open) {
      setQuantidade(quantidadeInicial);
      setObservacao(observacaoInicial);
      setOpcionaisSelecionados(opcionaisIniciais);
    }
  }, [open, quantidadeInicial, observacaoInicial, opcionaisIniciais]);

  const grupos = produto?.grupos_opcionais || [];

  const totalOpcionais = useMemo(() => 
    opcionaisSelecionados.reduce((sum, op) => sum + op.preco_adicional, 0),
    [opcionaisSelecionados]
  );

  const subtotal = produto ? (produto.preco_venda + totalOpcionais) * quantidade : 0;

  // Check if all required groups are satisfied
  const gruposValidos = useMemo(() => {
    return grupos.every(grupo => {
      if (grupo.min_selecao === 0) return true;
      const selecionados = opcionaisSelecionados.filter(op => 
        grupo.itens.some(item => item.id === op.item_id)
      );
      return selecionados.length >= grupo.min_selecao;
    });
  }, [grupos, opcionaisSelecionados]);

  const toggleOpcional = (grupoId: string, grupoNome: string, item: { id: string; nome: string; preco_adicional: number }, maxSelecao: number) => {
    setOpcionaisSelecionados(prev => {
      const grupo = grupos.find(g => g.id === grupoId);
      if (!grupo) return prev;

      const jaExiste = prev.find(op => op.item_id === item.id);
      
      if (jaExiste) {
        // Deselect
        return prev.filter(op => op.item_id !== item.id);
      }

      // For single-select (radio), remove other selections from this group
      if (maxSelecao === 1) {
        const semGrupo = prev.filter(op => 
          !grupo.itens.some(gi => gi.id === op.item_id)
        );
        return [...semGrupo, { grupo_nome: grupoNome, item_id: item.id, item_nome: item.nome, preco_adicional: item.preco_adicional }];
      }

      // Multi-select: check max
      const qtdGrupo = prev.filter(op => grupo.itens.some(gi => gi.id === op.item_id)).length;
      if (qtdGrupo >= maxSelecao) return prev;

      return [...prev, { grupo_nome: grupoNome, item_id: item.id, item_nome: item.nome, preco_adicional: item.preco_adicional }];
    });
  };

  if (!produto) return null;

  const handleAdd = () => {
    onAddToCart(produto, quantidade, observacao, opcionaisSelecionados);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <VisuallyHidden>
          <DialogTitle>{produto.nome}</DialogTitle>
        </VisuallyHidden>
        
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-white transition-colors"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>
        
        {/* Imagem */}
        <div className="relative aspect-[4/3] bg-gray-50 flex-shrink-0">
          {produto.imagem_url ? (
            <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
              <ImageIcon className="h-20 w-20 text-gray-300" />
            </div>
          )}
        </div>
        
        {/* Conteúdo */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{produto.nome}</h2>
            {produto.observacoes_ficha && (
              <p className="text-gray-500 text-sm">{produto.observacoes_ficha}</p>
            )}
          </div>
          
          <div className="text-2xl font-bold text-emerald-600">
            {formatCurrencyBRL(produto.preco_venda)}
          </div>

          {/* Grupos de opcionais */}
          {grupos.filter(g => g.itens.length > 0).sort((a, b) => a.ordem - b.ordem).map(grupo => {
            const qtdSelecionada = opcionaisSelecionados.filter(op => 
              grupo.itens.some(gi => gi.id === op.item_id)
            ).length;

            return (
              <div key={grupo.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-800 text-sm">{grupo.nome}</span>
                    <span className="text-xs text-gray-500 ml-2">
                      {grupo.min_selecao > 0 ? `Obrigatório` : `Opcional`}
                      {grupo.max_selecao > 1 ? ` • Até ${grupo.max_selecao}` : ''}
                    </span>
                  </div>
                  {grupo.min_selecao > 0 && qtdSelecionada < grupo.min_selecao && (
                    <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-medium">
                      Escolha {grupo.min_selecao}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {grupo.itens.filter(i => i.ativo).sort((a, b) => a.ordem - b.ordem).map(item => {
                    const selecionado = opcionaisSelecionados.some(op => op.item_id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleOpcional(grupo.id, grupo.nome, item, grupo.max_selecao)}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left",
                          selecionado 
                            ? "border-emerald-400 bg-emerald-50" 
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                            selecionado ? "border-emerald-500 bg-emerald-500" : "border-gray-300"
                          )}>
                            {selecionado && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <span className="text-sm text-gray-800">{item.nome}</span>
                        </div>
                        {item.preco_adicional > 0 && (
                          <span className="text-sm font-medium text-emerald-600">
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
          
          {/* Quantidade */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
            <span className="text-sm font-medium text-gray-700">Quantidade</span>
            <div className="flex items-center gap-3">
              <Button
                size="icon" variant="outline"
                className="h-10 w-10 rounded-full border-gray-300"
                onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
                disabled={quantidade <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-bold text-lg">{quantidade}</span>
              <Button
                size="icon"
                className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-600"
                onClick={() => setQuantidade(quantidade + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="obs" className="text-sm font-medium text-gray-700">
              Alguma observação? (opcional)
            </Label>
            <Textarea
              id="obs"
              placeholder="Ex: Sem cebola, ponto da carne..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="resize-none"
              rows={2}
            />
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t bg-white flex-shrink-0">
          <Button
            className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-semibold rounded-xl shadow-lg"
            onClick={handleAdd}
            disabled={!gruposValidos}
          >
            Adicionar • {formatCurrencyBRL(subtotal)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
