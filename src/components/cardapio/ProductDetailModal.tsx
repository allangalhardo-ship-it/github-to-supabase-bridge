import { useState, useEffect } from "react";
import { Minus, Plus, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatCurrencyBRL } from "@/lib/format";
import { Produto } from "./types";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ProductDetailModalProps {
  produto: Produto | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (produto: Produto, quantidade: number, observacao: string) => void;
  quantidadeInicial?: number;
  observacaoInicial?: string;
}

export function ProductDetailModal({ 
  produto, 
  open, 
  onClose, 
  onAddToCart,
  quantidadeInicial = 1,
  observacaoInicial = ""
}: ProductDetailModalProps) {
  const [quantidade, setQuantidade] = useState(quantidadeInicial);
  const [observacao, setObservacao] = useState(observacaoInicial);

  useEffect(() => {
    if (open) {
      setQuantidade(quantidadeInicial);
      setObservacao(observacaoInicial);
    }
  }, [open, quantidadeInicial, observacaoInicial]);

  if (!produto) return null;

  const subtotal = produto.preco_venda * quantidade;

  const handleAdd = () => {
    onAddToCart(produto, quantidade, observacao);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <VisuallyHidden>
          <DialogTitle>{produto.nome}</DialogTitle>
        </VisuallyHidden>
        
        {/* Botão fechar */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-white transition-colors"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>
        
        {/* Imagem grande */}
        <div className="relative aspect-[4/3] bg-gray-50 flex-shrink-0">
          {produto.imagem_url ? (
            <img
              src={produto.imagem_url}
              alt={produto.nome}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
              <ImageIcon className="h-20 w-20 text-gray-300" />
            </div>
          )}
        </div>
        
        {/* Conteúdo */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Nome e descrição */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {produto.nome}
            </h2>
            {produto.observacoes_ficha && (
              <p className="text-gray-500 text-sm">
                {produto.observacoes_ficha}
              </p>
            )}
          </div>
          
          {/* Preço */}
          <div className="text-2xl font-bold text-emerald-600">
            {formatCurrencyBRL(produto.preco_venda)}
          </div>
          
          {/* Seletor de quantidade */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
            <span className="text-sm font-medium text-gray-700">Quantidade</span>
            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant="outline"
                className="h-10 w-10 rounded-full border-gray-300"
                onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
                disabled={quantidade <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-bold text-lg">
                {quantidade}
              </span>
              <Button
                size="icon"
                className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-600"
                onClick={() => setQuantidade(quantidade + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Campo de observações */}
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
        
        {/* Botão de adicionar fixo no rodapé */}
        <div className="p-4 border-t bg-white flex-shrink-0">
          <Button
            className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-semibold rounded-xl shadow-lg"
            onClick={handleAdd}
          >
            Adicionar • {formatCurrencyBRL(subtotal)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
