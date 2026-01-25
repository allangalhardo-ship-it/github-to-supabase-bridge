import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, ClipboardList } from 'lucide-react';
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

interface FichaTecnicaFormProps {
  produtoId: string;
  fichaTecnica: FichaTecnicaItem[];
}

const FichaTecnicaForm: React.FC<FichaTecnicaFormProps> = ({ produtoId, fichaTecnica }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  return (
    <div className="space-y-3 pt-2 border-t">
      {/* Lista de insumos na ficha */}
      {fichaTecnica.length > 0 && (
        <div className="space-y-2">
          {fichaTecnica.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm"
            >
              <div className="flex-1">
                <span className="font-medium">{item.insumos.nome}</span>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={item.quantidade}
                  className="w-20 h-8 text-right"
                  onBlur={(e) => {
                    const newQty = parseFloat(e.target.value);
                    if (newQty !== item.quantidade) {
                      updateQuantidadeMutation.mutate({ id: item.id, quantidade: newQty });
                    }
                  }}
                />
                <span className="text-muted-foreground w-8">{item.insumos.unidade_medida}</span>
              </div>
              <span className="text-muted-foreground w-20 text-right">
                {formatCurrency(Number(item.quantidade) * Number(item.insumos.custo_unitario))}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => removeMutation.mutate(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {insumosDisponiveis.length > 0 && (
        <div className="flex gap-2">
          <SearchableSelect
            options={insumosDisponiveis.map((insumo) => ({
              value: insumo.id,
              label: `${insumo.nome} (${insumo.unidade_medida})`,
              searchTerms: insumo.nome,
              icon: insumo.is_intermediario 
                ? <ClipboardList className="h-4 w-4 text-primary" /> 
                : <InsumoIcon nome={insumo.nome} className="h-4 w-4" />,
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
            className="w-20"
          />
          <Button
            size="icon"
            onClick={() => addMutation.mutate()}
            disabled={!novoInsumo.insumo_id || !novoInsumo.quantidade || addMutation.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {insumosDisponiveis.length === 0 && fichaTecnica.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Cadastre insumos primeiro para montar a ficha técnica.
        </p>
      )}
    </div>
  );
};

export default FichaTecnicaForm;
