import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, FileText, Search } from 'lucide-react';
import BuscarInsumoDialog from './BuscarInsumoDialog';
import { InsumoIcon } from '@/lib/insumoIconUtils';

interface FichaTecnicaItem {
  id: string;
  quantidade: number;
  insumos: {
    id: string;
    nome: string;
    unidade_medida: string;
    custo_unitario: number;
  };
}

interface FichaTecnicaDialogProps {
  produtoId: string;
  produtoNome: string;
  fichaTecnica: FichaTecnicaItem[];
  trigger?: React.ReactNode;
}

interface InsumoSelecionado {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
}

const FichaTecnicaDialog: React.FC<FichaTecnicaDialogProps> = ({ produtoId, produtoNome, fichaTecnica, trigger }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [buscaOpen, setBuscaOpen] = useState(false);
  const [insumoSelecionado, setInsumoSelecionado] = useState<InsumoSelecionado | null>(null);
  const [quantidade, setQuantidade] = useState('');

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!insumoSelecionado) return;
      const { error } = await supabase.from('fichas_tecnicas').insert({
        produto_id: produtoId,
        insumo_id: insumoSelecionado.id,
        quantidade: parseFloat(quantidade) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setInsumoSelecionado(null);
      setQuantidade('');
      toast({ title: 'Insumo adicionado à ficha técnica!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fichas_tecnicas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast({ title: 'Insumo removido!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    },
  });

  const updateQuantidadeMutation = useMutation({
    mutationFn: async ({ id, quantidade }: { id: string; quantidade: number }) => {
      const { error } = await supabase
        .from('fichas_tecnicas')
        .update({ quantidade })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
    },
  });

  const insumosNaFicha = fichaTecnica.map(ft => ft.insumos.id);

  const formatCurrency = (value: number) => {
    const safe = Number.isFinite(value) ? value : 0;
    const abs = Math.abs(safe);
    let maximumFractionDigits = 2;
    if (abs > 0 && abs < 0.001) maximumFractionDigits = 6;
    else if (abs > 0 && abs < 0.01) maximumFractionDigits = 4;

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits,
    }).format(safe);
  };

  const custoTotal = fichaTecnica.reduce((sum, item) => {
    return sum + (Number(item.quantidade) * Number(item.insumos.custo_unitario));
  }, 0);

  const handleInsumoSelect = (insumo: InsumoSelecionado) => {
    setInsumoSelecionado(insumo);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="secondary" size="sm" className="justify-center gap-2">
              <FileText className="h-4 w-4" />
              Ficha Técnica ({fichaTecnica.length})
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 pb-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              {produtoNome}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Adicionar novo insumo - Compacto */}
            <div className="p-3 border-b bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-2">Adicionar Insumo</p>
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBuscaOpen(true)}
                  className="flex-1 justify-start gap-2 h-9 text-sm font-normal"
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate text-muted-foreground">
                    {insumoSelecionado ? insumoSelecionado.nome : 'Buscar insumo...'}
                  </span>
                </Button>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Qtd"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className="w-16 h-9 text-center text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => addMutation.mutate()}
                  disabled={!insumoSelecionado || !quantidade || addMutation.isPending}
                  className="h-9 px-3"
                >
                  +
                </Button>
              </div>
              {/* Preview do custo em tempo real */}
              {insumoSelecionado && quantidade && parseFloat(quantidade) > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs bg-primary/5 rounded px-2 py-1.5">
                  <span className="text-muted-foreground">
                    {parseFloat(quantidade)} × {formatCurrency(insumoSelecionado.custo_unitario)}
                  </span>
                  <span className="font-semibold text-primary">
                    = {formatCurrency(parseFloat(quantidade) * insumoSelecionado.custo_unitario)}
                  </span>
                </div>
              )}
            </div>

            {/* Lista de insumos */}
            {fichaTecnica.length > 0 ? (
              <div className="divide-y">
                {fichaTecnica.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate flex items-center gap-1.5">
                        <InsumoIcon nome={item.insumos.nome} className="h-3.5 w-3.5 shrink-0" />
                        {item.insumos.nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.insumos.unidade_medida} • {formatCurrency(item.insumos.custo_unitario)}/un
                      </p>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={item.quantidade}
                      className="w-16 h-8 text-center text-sm"
                      onBlur={(e) => {
                        const newQty = parseFloat(e.target.value);
                        if (newQty !== item.quantidade) {
                          updateQuantidadeMutation.mutate({ id: item.id, quantidade: newQty });
                        }
                      }}
                    />
                    <span className="w-20 text-right text-sm font-medium">
                      {formatCurrency(Number(item.quantidade) * Number(item.insumos.custo_unitario))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                      onClick={() => removeMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum insumo na ficha técnica.</p>
                <p className="text-xs">Clique em buscar para adicionar.</p>
              </div>
            )}
          </div>

          {/* Total fixo no rodapé */}
          {fichaTecnica.length > 0 && (
            <div className="flex justify-between items-center p-4 bg-primary/10 border-t flex-shrink-0">
              <span className="font-medium text-sm">Custo Total</span>
              <span className="font-bold text-lg">{formatCurrency(custoTotal)}</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BuscarInsumoDialog
        open={buscaOpen}
        onOpenChange={setBuscaOpen}
        onSelect={handleInsumoSelect}
        insumosExcluidos={insumosNaFicha}
      />
    </>
  );
};

export default FichaTecnicaDialog;
