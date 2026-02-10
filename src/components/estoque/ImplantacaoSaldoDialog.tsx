import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { Search, PackageOpen, Check, Loader2 } from 'lucide-react';
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
}

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
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id && open,
  });

  const insumosFiltrados = useMemo(() => {
    if (!insumos) return [];
    if (!busca.trim()) return insumos;
    return insumos.filter(i =>
      i.nome.toLowerCase().includes(busca.toLowerCase())
    );
  }, [insumos, busca]);

  const itensAlterados = useMemo(() => {
    return Object.entries(saldos).filter(([_, item]) => item.alterado && (parseFloat(item.quantidade.replace(',', '.')) > 0 || parseFloat(item.custo.replace(',', '.')) > 0));
  }, [saldos]);

  const updateSaldo = (insumoId: string, field: 'quantidade' | 'custo', value: string) => {
    setSaldos(prev => ({
      ...prev,
      [insumoId]: {
        ...prev[insumoId] || { quantidade: '', custo: '', alterado: false },
        [field]: value,
        alterado: true,
      },
    }));
  };

  const implantarMutation = useMutation({
    mutationFn: async () => {
      if (!usuario?.empresa_id) throw new Error('Empresa não encontrada');

      const itens = itensAlterados.map(([insumoId, item]) => ({
        insumoId,
        quantidade: parseFloat(item.quantidade.replace(',', '.')) || 0,
        custo: parseFloat(item.custo.replace(',', '.')) || 0,
      })).filter(i => i.quantidade > 0);

      if (itens.length === 0) throw new Error('Nenhum item com quantidade para implantar');

      // Para cada insumo: criar movimentação + atualizar custo unitário
      for (const item of itens) {
        // 1. Criar movimentação de entrada com origem 'implantacao'
        await inserirMovimentoEstoque({
          empresa_id: usuario.empresa_id,
          insumo_id: item.insumoId,
          tipo: 'entrada',
          quantidade: item.quantidade,
          origem: 'implantacao',
          observacao: 'Implantação de saldo inicial',
          custo_total: item.custo > 0 ? item.custo * item.quantidade : null,
        });

        // 2. Atualizar custo unitário se informado
        if (item.custo > 0) {
          const { error } = await supabase
            .from('insumos')
            .update({ custo_unitario: item.custo })
            .eq('id', item.insumoId);
          if (error) console.error('Erro ao atualizar custo:', error);
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
          Informe a <strong>quantidade em estoque</strong> e o <strong>custo unitário</strong> atual de cada insumo. 
          Isso cria uma entrada de estoque sem gerar despesa no caixa.
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
        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1">
            <Check className="h-3 w-3" />
            {itensAlterados.length} insumo(s) preenchido(s)
          </Badge>
        </div>
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
            const saldo = saldos[insumo.id];
            const temValor = saldo?.alterado;

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
                  <span className="text-[10px] text-muted-foreground uppercase">{insumo.unidade_medida}</span>
                </div>

                {/* Campos inline: quantidade e custo */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">
                      Quantidade
                    </Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={saldo?.quantidade || ''}
                      onChange={(e) => updateSaldo(insumo.id, 'quantidade', e.target.value)}
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
                      value={saldo?.custo || ''}
                      onChange={(e) => updateSaldo(insumo.id, 'custo', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Info atual (se já tem estoque) */}
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
