import { ShoppingCart, Minus, Plus, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatCurrencyBRL } from "@/lib/format";
import { CarrinhoItem, DadosCliente } from "./types";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrinho: CarrinhoItem[];
  dadosCliente: DadosCliente;
  onDadosClienteChange: (dados: DadosCliente) => void;
  onAddItem: (produtoId: string) => void;
  onRemoveItem: (produtoId: string) => void;
  onDeleteItem: (produtoId: string) => void;
  onEnviarPedido: () => void;
  enviando: boolean;
}

export function CartDrawer({
  open,
  onOpenChange,
  carrinho,
  dadosCliente,
  onDadosClienteChange,
  onAddItem,
  onRemoveItem,
  onDeleteItem,
  onEnviarPedido,
  enviando
}: CartDrawerProps) {
  const totalCarrinho = carrinho.reduce(
    (total, item) => total + item.produto.preco_venda * item.quantidade,
    0
  );

  const quantidadeTotal = carrinho.reduce((total, item) => total + item.quantidade, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b bg-white flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <ShoppingCart className="h-6 w-6 text-emerald-600" />
            Seu Pedido
            {quantidadeTotal > 0 && (
              <span className="ml-auto bg-emerald-100 text-emerald-700 text-sm font-semibold px-2.5 py-0.5 rounded-full">
                {quantidadeTotal} {quantidadeTotal === 1 ? 'item' : 'itens'}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {carrinho.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
            <ShoppingCart className="h-20 w-20 mb-4 opacity-30" />
            <p className="text-lg font-medium">Seu carrinho está vazio</p>
            <p className="text-sm mt-1 text-center">Adicione produtos para fazer seu pedido</p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-5">
                {/* Itens do carrinho */}
                <div className="space-y-3">
                  {carrinho.map((item) => (
                    <div 
                      key={item.produto.id} 
                      className="bg-gray-50 rounded-xl p-4"
                    >
                      <div className="flex items-start gap-3">
                        {/* Imagem pequena */}
                        {item.produto.imagem_url && (
                          <img 
                            src={item.produto.imagem_url} 
                            alt={item.produto.nome}
                            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                          />
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-gray-800 text-sm line-clamp-2">
                              {item.produto.nome}
                            </h4>
                            <button 
                              onClick={() => onDeleteItem(item.produto.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          
                          {item.observacao && (
                            <p className="text-xs text-gray-500 mt-0.5 italic">
                              Obs: {item.observacao}
                            </p>
                          )}
                          
                          <div className="flex items-center justify-between mt-2">
                            <span className="font-bold text-emerald-600">
                              {formatCurrencyBRL(item.produto.preco_venda * item.quantidade)}
                            </span>
                            
                            <div className="flex items-center gap-1 bg-white rounded-full shadow-sm p-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 rounded-full"
                                onClick={() => onRemoveItem(item.produto.id)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-6 text-center font-semibold text-sm">
                                {item.quantidade}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 rounded-full"
                                onClick={() => onAddItem(item.produto.id)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Dados do cliente */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800">Seus dados</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="nome" className="text-sm text-gray-600">Nome *</Label>
                      <Input
                        id="nome"
                        placeholder="Seu nome completo"
                        value={dadosCliente.nome}
                        onChange={(e) => onDadosClienteChange({ ...dadosCliente, nome: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="whatsapp" className="text-sm text-gray-600">WhatsApp *</Label>
                      <Input
                        id="whatsapp"
                        placeholder="(00) 00000-0000"
                        value={dadosCliente.whatsapp}
                        onChange={(e) => onDadosClienteChange({ ...dadosCliente, whatsapp: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="endereco" className="text-sm text-gray-600">Endereço de entrega</Label>
                      <Textarea
                        id="endereco"
                        placeholder="Rua, número, bairro..."
                        value={dadosCliente.endereco}
                        onChange={(e) => onDadosClienteChange({ ...dadosCliente, endereco: e.target.value })}
                        className="mt-1 resize-none"
                        rows={2}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="obs-pedido" className="text-sm text-gray-600">Observações do pedido</Label>
                      <Textarea
                        id="obs-pedido"
                        placeholder="Alguma observação geral?"
                        value={dadosCliente.observacoes}
                        onChange={(e) => onDadosClienteChange({ ...dadosCliente, observacoes: e.target.value })}
                        className="mt-1 resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Footer com total e botão */}
            <div className="border-t bg-white p-4 flex-shrink-0 space-y-3">
              <div className="flex items-center justify-between text-lg">
                <span className="font-medium text-gray-700">Total</span>
                <span className="font-bold text-emerald-600 text-xl">
                  {formatCurrencyBRL(totalCarrinho)}
                </span>
              </div>
              
              <Button
                className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white text-base font-semibold rounded-xl shadow-lg gap-2"
                onClick={onEnviarPedido}
                disabled={enviando || !dadosCliente.nome || !dadosCliente.whatsapp}
              >
                {enviando ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Enviar pedido via WhatsApp
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
