import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Search, PackageOpen, Check, Loader2, ArrowRight, Plus } from 'lucide-react';
import { InsumoIcon } from '@/lib/insumoIconUtils';
import { inserirMovimentoEstoque } from '@/lib/estoqueUtils';
import { cn } from '@/lib/utils';

interface ImplantacaoSaldoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SaldoItem {
  quantidade: string;
  custo: string;
  alterado: boolean;
  unidade_compra_id: string;
  fator_conversao_manual: string;
  nova_unidade_nome: string;
  showNovaUnidade: boolean;
}

const emptySaldo: SaldoItem = {
  quantidade: '',
  custo: '',
  alterado: false,
  unidade_compra_id: '',
  fator_conversao_manual: '',
  nova_unidade_nome: '',
  showNovaUnidade: false,
};

const ImplantacaoSaldoDialog: React.FC<ImplantacaoSaldoDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [saldos, setSaldos] = useState<Record<string, SaldoItem>>({});

  const { data: insumos, isLoading } = useQuery({
    queryKey: ['insumos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .eq('is_intermediario', false)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id && open,
  });

  // Fetch all unidades_compra for all insumos at once
  const { data: todasUnidades } = useQuery({
    queryKey: ['unidades-compra-all', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades_compra')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id && open,
  });

  // Group unidades by insumo_id
  const unidadesPorInsumo = useMemo(() => {
    if (!todasUnidades) return {};
    const map: Record<string, typeof todasUnidades> = {};
    todasUnidades.forEach(u => {
      if (!map[u.insumo_id]) map[u.insumo_id] = [];
      map[u.insumo_id].push(u);
    });
    return map;
  }, [todasUnidades]);

  const insumosFiltrados = useMemo(() => {
    if (!insumos) return [];
    if (!busca.trim()) return insumos;
    return insumos.filter(i =>
      i.nome.toLowerCase().includes(busca.toLowerCase())
    );
  }, [insumos, busca]);

  const getSaldo = (insumoId: string): SaldoItem => saldos[insumoId] || emptySaldo;

  const updateSaldo = (insumoId: string, updates: Partial<SaldoItem>) => {
    setSaldos(prev => ({
      ...prev,
      [insumoId]: {
        ...(prev[insumoId] || emptySaldo),
        ...updates,
        alterado: true,
      },
    }));
  };

  // Get fator_conversao for a given insumo
  const getFatorConversao = (insumoId: string): number => {
    const saldo = getSaldo(insumoId);
    if (saldo.fator_conversao_manual) {
      return parseFloat(saldo.fator_conversao_manual.replace(',', '.')) || 0;
    }
    if (saldo.unidade_compra_id) {
      const unidade = unidadesPorInsumo[insumoId]?.find(u => u.id === saldo.unidade_compra_id);
      return unidade?.fator_conversao || 0;
    }
    return 0;
  };

  // Check if insumo is using conversion
  const isUsandoConversao = (insumoId: string): boolean => {
    const saldo = getSaldo(insumoId);
    return !!(saldo.unidade_compra_id || saldo.showNovaUnidade);
  };

  // Get converted quantity
  const getQuantidadeConvertida = (insumoId: string): number => {
    const saldo = getSaldo(insumoId);
    const qtd = parseFloat(saldo.quantidade.replace(',', '.')) || 0;
    if (!isUsandoConversao(insumoId)) return qtd;
    const fator = getFatorConversao(insumoId);
    return fator > 0 ? qtd * fator : 0;
  };

  const itensAlterados = useMemo(() => {
    return Object.entries(saldos).filter(([id, item]) => {
      if (!item.alterado) return false;
      const qtd = parseFloat(item.quantidade.replace(',', '.')) || 0;
      if (qtd <= 0) return false;
      // If using conversion, must have valid fator
      if (item.unidade_compra_id || item.showNovaUnidade) {
        const fator = getFatorConversao(id);
        if (fator <= 0) return false;
      }
      return true;
    });
  }, [saldos, unidadesPorInsumo]);

  // Create new unidade_compra
  const createUnidadeMutation = useMutation({
    mutationFn: async ({ insumoId, nome, fator }: { insumoId: string; nome: string; fator: number }) => {
      const { data, error } = await supabase
        .from('unidades_compra')
        .insert({
          empresa_id: usuario!.empresa_id,
          insumo_id: insumoId,
          nome,
          fator_conversao: fator,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unidades-compra-all'] });
    },
  });

  const implantarMutation = useMutation({
    mutationFn: async () => {
      if (!usuario?.empresa_id) throw new Error('Empresa não encontrada');

      const itens = itensAlterados.map(([insumoId, item]) => {
        const qtdOriginal = parseFloat(item.quantidade.replace(',', '.')) || 0;
        const custo = parseFloat(item.custo.replace(',', '.')) || 0;
        const usandoConversao = !!(item.unidade_compra_id || item.showNovaUnidade);
        const fator = getFatorConversao(insumoId);
        const qtdConvertida = usandoConversao && fator > 0 ? qtdOriginal * fator : qtdOriginal;
        const unidade = item.unidade_compra_id
          ? unidadesPorInsumo[insumoId]?.find(u => u.id === item.unidade_compra_id)
          : null;

        return {
          insumoId,
          qtdOriginal,
          qtdConvertida,
          custo,
          usandoConversao,
          fator,
          unidadeNome: unidade?.nome || item.nova_unidade_nome || null,
          novaUnidade: item.showNovaUnidade ? { nome: item.nova_unidade_nome, fator } : null,
        };
      }).filter(i => i.qtdConvertida > 0);

      if (itens.length === 0) throw new Error('Nenhum item válido para implantar');

      for (const item of itens) {
        // Save new unidade if needed
        if (item.novaUnidade && item.novaUnidade.nome && item.novaUnidade.fator > 0) {
          try {
            await createUnidadeMutation.mutateAsync({
              insumoId: item.insumoId,
              nome: item.novaUnidade.nome,
              fator: item.novaUnidade.fator,
            });
          } catch (e) {
            console.error('Erro ao salvar unidade:', e);
          }
        }

        // Calculate converted unit cost (cost per production unit)
        const custoUnitarioConvertido = item.usandoConversao && item.fator > 0
          ? item.custo / item.fator
          : item.custo;
        // Total cost = cost per purchase unit * quantity in purchase units
        const custoTotal = item.custo > 0 ? item.custo * item.qtdOriginal : null;

        // Create stock movement
        await inserirMovimentoEstoque({
          empresa_id: usuario.empresa_id,
          insumo_id: item.insumoId,
          tipo: 'entrada',
          quantidade: item.qtdConvertida,
          origem: 'implantacao',
          observacao: 'Implantação de saldo inicial',
          custo_total: custoTotal,
          quantidade_original: item.usandoConversao ? item.qtdOriginal : null,
          unidade_compra: item.unidadeNome,
          fator_conversao: item.usandoConversao ? item.fator : null,
        });

        // Update unit cost converted to production unit
        if (item.custo > 0) {
          await supabase
            .from('insumos')
            .update({ custo_unitario: custoUnitarioConvertido })
            .eq('id', item.insumoId);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentos'] });
      toast({
        title: 'Saldo implantado!',
        description: `${itensAlterados.length} insumo(s) atualizados com sucesso.`,
      });
      setSaldos({});
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Erro na implantação',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const conteudo = (
    <div className="flex flex-col gap-4 p-4">
      {/* Explicação */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-sm text-foreground">
          Informe a <strong>quantidade em estoque</strong> e o <strong>custo unitário</strong> de cada insumo.
          Se a unidade armazenada for diferente da de produção, use a <strong>conversão de unidade</strong>.
        </p>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar insumo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Contador */}
      {itensAlterados.length > 0 && (
        <Badge variant="default" className="gap-1 w-fit">
          <Check className="h-3 w-3" />
          {itensAlterados.length} insumo(s) preenchido(s)
        </Badge>
      )}

      {/* Lista de insumos */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando insumos...</div>
        ) : insumosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {busca ? 'Nenhum insumo encontrado' : 'Nenhum insumo cadastrado'}
          </div>
        ) : (
          insumosFiltrados.map(insumo => {
            const saldo = getSaldo(insumo.id);
            const temValor = saldo.alterado;
            const unidades = unidadesPorInsumo[insumo.id] || [];
            const temUnidades = unidades.length > 0;
            const usandoConversao = isUsandoConversao(insumo.id);
            const qtdConvertida = getQuantidadeConvertida(insumo.id);
            const fator = getFatorConversao(insumo.id);
            const qtdOriginal = parseFloat(saldo.quantidade.replace(',', '.')) || 0;

            return (
              <div
                key={insumo.id}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  temValor ? "border-primary/30 bg-primary/5" : "bg-muted/30"
                )}
              >
                {/* Nome do insumo */}
                <div className="flex items-center gap-2 mb-2">
                  <InsumoIcon nome={insumo.nome} className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-semibold truncate flex-1">{insumo.nome}</span>
                  <span className="text-[10px] text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                    {insumo.unidade_medida}
                  </span>
                </div>

                {/* Unidade de compra/armazenamento */}
                <div className="mb-2">
                  {!saldo.showNovaUnidade ? (
                    <Select
                      value={saldo.unidade_compra_id || 'producao'}
                      onValueChange={(value) => {
                        if (value === 'nova') {
                          updateSaldo(insumo.id, {
                            showNovaUnidade: true,
                            unidade_compra_id: '',
                          });
                        } else if (value === 'producao') {
                          updateSaldo(insumo.id, {
                            unidade_compra_id: '',
                            fator_conversao_manual: '',
                          });
                        } else {
                          updateSaldo(insumo.id, {
                            unidade_compra_id: value,
                            fator_conversao_manual: '',
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Unidade..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="producao" className="text-xs">
                          {insumo.unidade_medida} (unidade de produção)
                        </SelectItem>
                        {unidades.map(u => (
                          <SelectItem key={u.id} value={u.id} className="text-xs">
                            {u.nome} (1 = {u.fator_conversao} {insumo.unidade_medida})
                          </SelectItem>
                        ))}
                        <SelectItem value="nova" className="text-xs text-primary font-medium">
                          <span className="flex items-center gap-1">
                            <Plus className="h-3 w-3" />
                            Nova unidade...
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2 p-2 border rounded bg-muted/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Nova Unidade</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => updateSaldo(insumo.id, {
                            showNovaUnidade: false,
                            fator_conversao_manual: '',
                            nova_unidade_nome: '',
                          })}
                          className="h-6 text-[10px] px-2"
                        >
                          Cancelar
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Nome</Label>
                          <Input
                            placeholder="Ex: pacote 500g"
                            value={saldo.nova_unidade_nome}
                            onChange={(e) => updateSaldo(insumo.id, { nova_unidade_nome: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">
                            1 un = X {insumo.unidade_medida}
                          </Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="Ex: 500"
                            value={saldo.fator_conversao_manual}
                            onChange={(e) => updateSaldo(insumo.id, { fator_conversao_manual: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Campos: quantidade e custo */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">
                      Quantidade
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={saldo.quantidade}
                      onChange={(e) => updateSaldo(insumo.id, { quantidade: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">
                      Custo unit. (R$)
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder={Number(insumo.custo_unitario).toFixed(2).replace('.', ',')}
                      value={saldo.custo}
                      onChange={(e) => updateSaldo(insumo.id, { custo: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Resumo da conversão */}
                {usandoConversao && fator > 0 && qtdOriginal > 0 && (
                  <div className="mt-2 p-2 rounded bg-muted/50 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{qtdOriginal} {saldo.unidade_compra_id
                      ? unidades.find(u => u.id === saldo.unidade_compra_id)?.nome || ''
                      : saldo.nova_unidade_nome || 'un'}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span className="font-semibold text-foreground">
                      {qtdConvertida.toFixed(2)} {insumo.unidade_medida}
                    </span>
                  </div>
                )}

                {/* Info estoque atual */}
                {Number(insumo.estoque_atual) > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Estoque atual: {Number(insumo.estoque_atual).toFixed(2)} {insumo.unidade_medida}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const rodape = (
    <div className="border-t bg-background p-3 flex gap-2">
      <Button
        className="flex-1 gap-2"
        size="lg"
        onClick={() => implantarMutation.mutate()}
        disabled={implantarMutation.isPending || itensAlterados.length === 0}
      >
        {implantarMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <PackageOpen className="h-4 w-4" />
        )}
        Implantar Saldo ({itensAlterados.length})
      </Button>
      <Button size="lg" variant="outline" onClick={() => onOpenChange(false)}>
        Cancelar
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92vh] flex flex-col">
          <DrawerHeader className="border-b pb-3 shrink-0">
            <DrawerTitle className="flex items-center gap-2">
              <PackageOpen className="h-5 w-5" />
              Implantação de Saldo
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1">
            {conteudo}
          </div>
          {rodape}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5" />
            Implantação de Saldo
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1">
          {conteudo}
        </div>
        {rodape}
      </DialogContent>
    </Dialog>
  );
};

export default ImplantacaoSaldoDialog;
