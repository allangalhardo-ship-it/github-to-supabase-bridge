import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, FlaskConical, FileText } from 'lucide-react';

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
}

const FichaTecnicaDialog: React.FC<FichaTecnicaDialogProps> = ({ produtoId, produtoNome, fichaTecnica }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [novoInsumo, setNovoInsumo] = useState({ insumo_id: '', quantidade: '' });

  // Fetch todos os insumos disponíveis (inclui intermediários)
  const { data: insumos } = useQuery({
    queryKey: ['insumos-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('id, nome, unidade_medida, custo_unitario, is_intermediario')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('fichas_tecnicas').insert({
        produto_id: produtoId,
        insumo_id: novoInsumo.insumo_id,
        quantidade: parseFloat(novoInsumo.quantidade) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      setNovoInsumo({ insumo_id: '', quantidade: '' });
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

  // Insumos que já estão na ficha técnica
  const insumosNaFicha = fichaTecnica.map(ft => ft.insumos.id);
  const insumosDisponiveis = insumos?.filter(i => !insumosNaFicha.includes(i.id)) || [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const custoTotal = fichaTecnica.reduce((sum, item) => {
    return sum + (Number(item.quantidade) * Number(item.insumos.custo_unitario));
  }, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <FileText className="mr-2 h-4 w-4" />
          Ficha Técnica ({fichaTecnica.length} itens)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Ficha Técnica - {produtoNome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Adicionar novo insumo */}
          <div className="p-4 border rounded-lg bg-muted/30">
            <p className="text-sm font-medium mb-3">Adicionar Insumo</p>
            <div className="flex gap-2">
              <SearchableSelect
                options={insumosDisponiveis.map((insumo) => ({
                  value: insumo.id,
                  label: `${insumo.nome} (${insumo.unidade_medida})`,
                  searchTerms: insumo.nome,
                  icon: insumo.is_intermediario ? <FlaskConical className="h-3 w-3 text-purple-500" /> : undefined,
                }))}
                value={novoInsumo.insumo_id}
                onValueChange={(value) => setNovoInsumo({ ...novoInsumo, insumo_id: value })}
                placeholder="Buscar insumo..."
                searchPlaceholder="Digite para buscar..."
                emptyMessage="Nenhum insumo encontrado."
                className="flex-1"
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="Qtd"
                value={novoInsumo.quantidade}
                onChange={(e) => setNovoInsumo({ ...novoInsumo, quantidade: e.target.value })}
                className="w-24"
              />
              <Button
                onClick={() => addMutation.mutate()}
                disabled={!novoInsumo.insumo_id || !novoInsumo.quantidade || addMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Lista de insumos */}
          {fichaTecnica.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                <div className="col-span-5">Insumo</div>
                <div className="col-span-2 text-center">Quantidade</div>
                <div className="col-span-2 text-center">Unidade</div>
                <div className="col-span-2 text-right">Custo</div>
                <div className="col-span-1"></div>
              </div>
              
              {fichaTecnica.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-2 items-center p-3 bg-muted/50 rounded-lg"
                >
                  <div className="col-span-5 font-medium text-sm">
                    {item.insumos.nome}
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={item.quantidade}
                      className="h-8 text-center"
                      onBlur={(e) => {
                        const newQty = parseFloat(e.target.value);
                        if (newQty !== item.quantidade) {
                          updateQuantidadeMutation.mutate({ id: item.id, quantidade: newQty });
                        }
                      }}
                    />
                  </div>
                  <div className="col-span-2 text-center text-sm text-muted-foreground">
                    {item.insumos.unidade_medida}
                  </div>
                  <div className="col-span-2 text-right text-sm font-medium">
                    {formatCurrency(Number(item.quantidade) * Number(item.insumos.custo_unitario))}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <span className="font-medium">Custo Total</span>
                <span className="font-bold text-lg">{formatCurrency(custoTotal)}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum insumo na ficha técnica.</p>
              <p className="text-sm">Adicione insumos para calcular o custo do produto.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FichaTecnicaDialog;
