import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PercentInput } from '@/components/ui/percent-input';
import { calcularCustoFicha } from '@/utils/custoFicha';
import { calcularPrecoPorCmvAlvo } from '@/lib/precificacaoUtils';
import { precoEfetivo, type CanalBasico, type PrecoCanalBasico } from '@/lib/precoCanalUtils';
import { invalidateAndRefetch } from '@/lib/queryConfig';

interface Props {
  canal: { id: string; nome: string; tipo: string } | null;
  onClose: () => void;
}

type Opcao = 'copiar' | 'sugerido' | 'depois';

const NovoCanalPrecosDialog: React.FC<Props> = ({ canal, onClose }) => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const empresaId = usuario?.empresa_id;
  const open = !!canal;
  const [opcao, setOpcao] = useState<Opcao>('copiar');
  const [canalOrigem, setCanalOrigem] = useState('');
  const [taxa, setTaxa] = useState<number>(0);
  const [salvando, setSalvando] = useState(false);

  const precisaTaxa = canal?.tipo === 'app_delivery';

  const { data } = useQuery({
    queryKey: ['novo-canal-precos', empresaId, canal?.id],
    enabled: open && !!empresaId,
    queryFn: async () => {
      const [canaisR, precosR, produtosR, configR] = await Promise.all([
        supabase.from('canais_venda').select('id, nome, tipo, ativo, created_at').eq('empresa_id', empresaId!).eq('ativo', true),
        supabase.from('precos_canais').select('produto_id, canal, preco').eq('empresa_id', empresaId!),
        supabase.from('produtos')
          .select('id, nome, preco_venda, rendimento_padrao, fichas_tecnicas (quantidade, unidade, insumo_id, insumos (id, nome, custo_unitario, unidade_medida, fator_perda))')
          .eq('empresa_id', empresaId!).eq('ativo', true),
        supabase.from('configuracoes').select('cmv_alvo, imposto_medio_sobre_vendas').eq('empresa_id', empresaId!).maybeSingle(),
      ]);
      return {
        canais: (canaisR.data || []) as CanalBasico[],
        precos: (precosR.data || []) as PrecoCanalBasico[],
        produtos: (produtosR.data || []) as any[],
        config: configR.data,
      };
    },
  });

  const outrosCanais = useMemo(() => (data?.canais || []).filter(c => c.id !== canal?.id), [data, canal]);

  const salvar = async () => {
    if (!canal || !empresaId || !data) return;
    if (opcao === 'depois') { onClose(); return; }
    if (opcao === 'copiar' && !canalOrigem) {
      toast({ title: 'Escolha de qual canal copiar os preços', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      let semFicha = 0;
      const registros: { empresa_id: string; produto_id: string; canal: string; preco: number }[] = [];
      for (const p of data.produtos) {
        let preco = 0;
        if (opcao === 'copiar') {
          preco = precoEfetivo(p, data.precos, data.canais, canalOrigem);
        } else {
          const custo = calcularCustoFicha(p.fichas_tecnicas, p.rendimento_padrao || 1);
          const r = calcularPrecoPorCmvAlvo(
            custo,
            Number(data.config?.cmv_alvo) || 35,
            precisaTaxa ? taxa : 0,
            Number(data.config?.imposto_medio_sobre_vendas) || 0,
          );
          if (!r.viavel) { semFicha++; continue; }
          preco = Math.round(r.preco * 100) / 100;
        }
        if (preco > 0) registros.push({ empresa_id: empresaId, produto_id: p.id, canal: canal.id, preco });
      }
      if (opcao === 'sugerido' && precisaTaxa && taxa > 0) {
        const { error } = await supabase.from('taxas_canais').insert({ canal_id: canal.id, nome: 'Comissão', percentual: taxa });
        if (error) throw error;
      }
      if (registros.length) {
        const { error } = await supabase.from('precos_canais').upsert(registros, { onConflict: 'produto_id,canal,empresa_id' });
        if (error) throw error;
      }
      invalidateAndRefetch([['precos-canais'], ['todos-precos-canais'], ['precos-canais-todos'], ['produtos-menu-engineering'], ['canais_venda'], ['canais-configurados']]);
      toast({
        title: `${registros.length} preço${registros.length === 1 ? '' : 's'} definido${registros.length === 1 ? '' : 's'} no ${canal.nome}`,
        description: semFicha > 0 ? `${semFicha} produto(s) sem ficha técnica ficaram sem preço. Revise na Precificação.` : undefined,
      });
      onClose();
    } catch (e: any) {
      toast({ title: 'Erro ao definir preços', description: e.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preços no canal {canal?.nome}</DialogTitle>
          <DialogDescription>Como você quer definir o preço dos seus produtos nesse canal?</DialogDescription>
        </DialogHeader>
        <RadioGroup value={opcao} onValueChange={(v) => setOpcao(v as Opcao)} className="space-y-3">
          <div className="flex items-start gap-2">
            <RadioGroupItem value="copiar" id="op-copiar" className="mt-1" />
            <div className="flex-1 space-y-2">
              <Label htmlFor="op-copiar">Copiar os preços de outro canal</Label>
              {opcao === 'copiar' && (
                <Select value={canalOrigem} onValueChange={setCanalOrigem}>
                  <SelectTrigger><SelectValue placeholder="Escolha o canal" /></SelectTrigger>
                  <SelectContent>
                    {outrosCanais.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="sugerido" id="op-sugerido" className="mt-1" />
            <div className="flex-1 space-y-2">
              <Label htmlFor="op-sugerido">Usar o preço sugerido pela meta de custo</Label>
              <p className="text-xs text-muted-foreground">
                {precisaTaxa ? 'Considera a taxa do aplicativo e o imposto.' : 'Canal sem taxa: a conta usa só o imposto.'}
              </p>
              {opcao === 'sugerido' && precisaTaxa && (
                <div className="space-y-1">
                  <Label className="text-xs">Taxa do aplicativo (%)</Label>
                  <PercentInput value={taxa} onChange={(v: number) => setTaxa(v || 0)} />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="depois" id="op-depois" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="op-depois">Definir depois</Label>
              <p className="text-xs text-muted-foreground">A Precificação vai avisar quais produtos ainda estão sem preço nesse canal.</p>
            </div>
          </div>
        </RadioGroup>
        <DialogFooter>
          <Button onClick={salvar} disabled={salvando || !data}>{salvando ? 'Salvando...' : 'Confirmar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NovoCanalPrecosDialog;
