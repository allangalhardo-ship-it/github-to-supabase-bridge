import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invalidateEmpresaCachesAndRefetch } from '@/lib/queryConfig';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyBRL } from '@/lib/format';
import { format } from 'date-fns';
import { Search, Plus, Minus, ShoppingCart, X, Check, Package } from 'lucide-react';

interface VendaRapidaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CartItem {
  produto_id: string;
  nome: string;
  preco: number;
  quantidade: number;
  imagem_url?: string | null;
}

const VendaRapidaSheet = ({ open, onOpenChange }: VendaRapidaSheetProps) => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const { data: produtos } = useQuery({
    queryKey: ['produtos-venda-rapida', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, preco_venda, imagem_url, categoria')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id && open,
  });

  const produtosFiltrados = useMemo(() => {
    if (!produtos) return [];
    if (!search.trim()) return produtos;
    return produtos.filter((p) =>
      p.nome.toLowerCase().includes(search.toLowerCase())
    );
  }, [produtos, search]);

  const addToCart = (produto: typeof produtos[0]) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.produto_id === produto.id);
      if (existing) {
        return prev.map((i) =>
          i.produto_id === produto.id
            ? { ...i, quantidade: i.quantidade + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          produto_id: produto.id,
          nome: produto.nome,
          preco: produto.preco_venda,
          quantidade: 1,
          imagem_url: produto.imagem_url,
        },
      ];
    });
  };

  const updateQuantity = (produtoId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.produto_id === produtoId
            ? { ...i, quantidade: Math.max(0, i.quantidade + delta) }
            : i
        )
        .filter((i) => i.quantidade > 0)
    );
  };

  const totalItems = cart.reduce((sum, i) => sum + i.quantidade, 0);
  const totalValue = cart.reduce((sum, i) => sum + i.preco * i.quantidade, 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const inserts = cart.map((item) => ({
        empresa_id: usuario!.empresa_id,
        produto_id: item.produto_id,
        descricao_produto: item.nome,
        quantidade: item.quantidade,
        valor_total: item.preco * item.quantidade,
        canal: 'balcao',
        data_venda: hoje,
        origem: 'manual',
        tipo_venda: 'direto',
      }));

      const { error } = await supabase.from('vendas').insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast({
        title: '✅ Venda registrada!',
        description: `${totalItems} item(s) — ${formatCurrencyBRL(totalValue)}`,
      });
      setCart([]);
      setSearch('');
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Erro ao registrar venda',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getCartQty = (produtoId: string) =>
    cart.find((i) => i.produto_id === produtoId)?.quantidade || 0;

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92vh] rounded-t-2xl p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-4 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Venda Rápida</SheetTitle>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
              <X className="h-5 w-5" />
            </Button>
          </div>
          {/* Search */}
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </SheetHeader>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {produtosFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {produtosFiltrados.map((produto) => {
                const qty = getCartQty(produto.id);
                return (
                  <button
                    key={produto.id}
                    onClick={() => addToCart(produto)}
                    className={`relative flex flex-col items-center p-3 rounded-xl border-2 transition-all active:scale-95 text-left ${
                      qty > 0
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    {/* Image or placeholder */}
                    {produto.imagem_url ? (
                      <img
                        src={produto.imagem_url}
                        alt={produto.nome}
                        className="w-16 h-16 rounded-lg object-cover mb-2"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center mb-2">
                        <Package className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                    )}

                    <p className="text-xs font-medium text-foreground text-center line-clamp-2 leading-tight">
                      {produto.nome}
                    </p>
                    <p className="text-sm font-bold text-primary mt-1">
                      {formatCurrencyBRL(produto.preco_venda)}
                    </p>

                    {/* Quantity badge */}
                    {qty > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-6 w-6 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {qty}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart Footer */}
        {cart.length > 0 && (
          <div className="border-t bg-background px-4 py-3 space-y-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            {/* Cart items summary */}
            <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.produto_id} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1 text-foreground">{item.nome}</span>
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); updateQuantity(item.produto_id, -1); }}
                      className="h-7 w-7 rounded-full bg-muted flex items-center justify-center active:bg-destructive/20"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-5 text-center font-semibold text-sm">{item.quantidade}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); updateQuantity(item.produto_id, 1); }}
                      className="h-7 w-7 rounded-full bg-muted flex items-center justify-center active:bg-primary/20"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-20 text-right font-medium text-sm">
                      {formatCurrencyBRL(item.preco * item.quantidade)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total + Confirm */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCart([])}
                className="shrink-0"
              >
                Limpar
              </Button>
              <Button
                className="flex-1 h-12 text-base font-semibold gap-2"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  'Salvando...'
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Registrar {formatCurrencyBRL(totalValue)}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default VendaRapidaSheet;
