import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invalidateEmpresaCachesAndRefetch } from '@/lib/queryConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, ClipboardList, AlertTriangle } from 'lucide-react';
import { InsumoIcon } from '@/lib/insumoIconUtils';
import { formatCurrencyBRL } from '@/lib/format';
import { calcularCustoItem, unidadesCompativeis } from '@/utils/custoFicha';

interface FichaTecnicaItem {
  id: string;
  quantidade: number;
  unidade: string | null;
  insumos: {
    id: string;
    nome: string;
    unidade_medida: string;
    custo_unitario: number;
    fator_perda?: number | null;
  } | null;
}

interface FichaTecnicaFormProps {
  produtoId: string;
  fichaTecnica: FichaTecnicaItem[];
}

const GRUPOS_UNIDADE: Record<string, string[]> = {
  massa: ['mg', 'g', 'kg'],
  volume: ['ml', 'l'],
  contagem: ['un'],
};
function unidadesDoGrupo(unidadeInsumo: string): string[] {
  const u = (unidadeInsumo || '').toLowerCase();
  for (const [, arr] of Object.entries(GRUPOS_UNIDADE)) {
    if (arr.some((x) => unidadesCompativeis(x, u))) return arr;
  }
  return [u || 'un'];
}

const FichaTecnicaForm: React.FC<FichaTecnicaFormProps> = ({ produtoId, fichaTecnica }) => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const [novoInsumo, setNovoInsumo] = useState<{ insumo_id: string; quantidade: string; unidade: string }>({
    insumo_id: '',
    quantidade: '',
    unidade: '',
  });

  const { data: insumos } = useQuery({
    queryKey: ['insumos-select', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('id, nome, unidade_medida, custo_unitario, fator_perda, is_intermediario')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const ins = insumos?.find((i) => i.id === novoInsumo.insumo_id);
      const unidade = novoInsumo.unidade || ins?.unidade_medida || null;
      const { error } = await supabase.from('fichas_tecnicas').insert({
        produto_id: produtoId,
        insumo_id: novoInsumo.insumo_id,
        quantidade: parseFloat(novoInsumo.quantidade) || 0,
        unidade,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      setNovoInsumo({ insumo_id: '', quantidade: '', unidade: '' });
      toast({ title: 'Insumo adicionado à ficha técnica!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fichas_tecnicas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast({ title: 'Insumo removido!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    },
  });

  const updateLinhaMutation = useMutation({
    mutationFn: async (input: { id: string; quantidade?: number; unidade?: string | null }) => {
      const patch: Record<string, any> = {};
      if (input.quantidade !== undefined) patch.quantidade = input.quantidade;
      if (input.unidade !== undefined) patch.unidade = input.unidade;
      const { error } = await supabase.from('fichas_tecnicas').update(patch).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateEmpresaCachesAndRefetch(usuario?.empresa_id),
  });

  const insumosNaFicha = fichaTecnica.map((ft) => ft.insumos?.id).filter(Boolean) as string[];
  const insumosDisponiveis = insumos?.filter((i) => !insumosNaFicha.includes(i.id)) || [];
  const insumoSelecionado = insumos?.find((i) => i.id === novoInsumo.insumo_id);
  const unidadesNovo = useMemo(
    () => (insumoSelecionado ? unidadesDoGrupo(insumoSelecionado.unidade_medida) : []),
    [insumoSelecionado],
  );

  return (
    <div className="space-y-3 pt-2 border-t">
      {fichaTecnica.length > 0 && (
        <div className="space-y-2">
          {fichaTecnica.map((item) => {
            if (!item.insumos) {
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/40 rounded-lg text-sm"
                >
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="flex-1 text-destructive">
                    Insumo removido do cadastro. Remova esta linha ou recadastre o insumo.
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
              );
            }
            const unidadeAtual = item.unidade || item.insumos.unidade_medida;
            const unidadesLinha = unidadesDoGrupo(item.insumos.unidade_medida);
            const custoLinha = calcularCustoItem(item as any);
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm"
              >
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block">{item.insumos.nome}</span>
                  {Number(item.insumos.fator_perda || 0) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Perda {Number(item.insumos.fator_perda).toFixed(0)}%
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={item.quantidade}
                  className="w-20 h-8 text-right"
                  onBlur={(e) => {
                    const newQty = parseFloat(e.target.value);
                    if (!Number.isNaN(newQty) && newQty !== item.quantidade) {
                      updateLinhaMutation.mutate({ id: item.id, quantidade: newQty });
                    }
                  }}
                />
                <Select
                  value={unidadeAtual}
                  onValueChange={(v) => updateLinhaMutation.mutate({ id: item.id, unidade: v })}
                >
                  <SelectTrigger className="w-[72px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unidadesLinha.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground w-20 text-right tabular-nums">
                  {formatCurrencyBRL(custoLinha)}
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
            );
          })}
        </div>
      )}

      {insumosDisponiveis.length > 0 && (
        <div className="grid grid-cols-[1fr_70px_64px_auto] gap-2 items-center">
          <div className="min-w-0">
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
              onValueChange={(value) => {
                const ins = insumos?.find((i) => i.id === value);
                setNovoInsumo({ ...novoInsumo, insumo_id: value, unidade: ins?.unidade_medida || '' });
              }}
              placeholder="Buscar insumo..."
              searchPlaceholder="Digite para buscar..."
              emptyMessage="Nenhum insumo encontrado."
              className="w-full"
            />
          </div>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="Qtd"
            value={novoInsumo.quantidade}
            onChange={(e) => setNovoInsumo({ ...novoInsumo, quantidade: e.target.value })}
            className="w-full"
          />
          {unidadesNovo.length > 0 ? (
            <Select
              value={novoInsumo.unidade}
              onValueChange={(v) => setNovoInsumo({ ...novoInsumo, unidade: v })}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="un" /></SelectTrigger>
              <SelectContent>
                {unidadesNovo.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div />
          )}
          <Button
            size="icon"
            className="shrink-0"
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
