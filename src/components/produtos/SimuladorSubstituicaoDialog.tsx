import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Search, Replace, TrendingDown, TrendingUp, Minus, AlertTriangle } from 'lucide-react';
import { formatCurrencyBRL, formatCurrencySmartBRL } from '@/lib/format';
import { calcularCustoItem, unidadesCompativeis } from '@/utils/custoFicha';
import { InsumoIcon } from '@/lib/insumoIconUtils';
import BuscarInsumoDialog from './BuscarInsumoDialog';

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

export interface InsumoBasico {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  fator_perda?: number | null;
}

export interface SimItem {
  tempId: string;
  insumo: InsumoBasico;
  quantidade: number;
  unidade: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Item alvo da substituição */
  itemAtual: SimItem | null;
  /** Lista completa da ficha (para recalcular custo total) */
  todosItens: SimItem[];
  /** Rendimento da ficha (divide custo total) */
  rendimento?: number | null;
  /** Preço base (Balcão) para mostrar impacto na margem */
  precoBase?: number;
  /** Aplica a substituição no estado do pai */
  onAplicar: (tempId: string, novoInsumo: InsumoBasico, novaQuantidade: number, novaUnidade: string) => void;
}

const SimuladorSubstituicaoDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  itemAtual,
  todosItens,
  rendimento,
  precoBase = 0,
  onAplicar,
}) => {
  const [novoInsumo, setNovoInsumo] = useState<InsumoBasico | null>(null);
  const [novaQtd, setNovaQtd] = useState<string>('');
  const [novaUnidade, setNovaUnidade] = useState<string>('');
  const [buscaOpen, setBuscaOpen] = useState(false);

  useEffect(() => {
    if (open && itemAtual) {
      setNovoInsumo(null);
      setNovaQtd(String(itemAtual.quantidade));
      setNovaUnidade(itemAtual.unidade);
    }
  }, [open, itemAtual]);

  // Quando seleciona novo insumo, sugere mesma qtd/unidade (se compatível)
  useEffect(() => {
    if (novoInsumo) {
      const unidadesNovo = unidadesDoGrupo(novoInsumo.unidade_medida);
      if (!unidadesNovo.includes(novaUnidade)) {
        setNovaUnidade(novoInsumo.unidade_medida);
      }
    }
  }, [novoInsumo]);

  const rend = Number(rendimento) || 1;

  const custoAtualLinha = useMemo(() => {
    if (!itemAtual) return 0;
    return calcularCustoItem({
      quantidade: itemAtual.quantidade,
      unidade: itemAtual.unidade,
      insumos: itemAtual.insumo,
    });
  }, [itemAtual]);

  const custoNovoLinha = useMemo(() => {
    if (!novoInsumo) return 0;
    const q = parseFloat(novaQtd) || 0;
    return calcularCustoItem({
      quantidade: q,
      unidade: novaUnidade || novoInsumo.unidade_medida,
      insumos: novoInsumo,
    });
  }, [novoInsumo, novaQtd, novaUnidade]);

  const custoFichaAtual = useMemo(() => {
    return todosItens.reduce(
      (s, it) =>
        s +
        calcularCustoItem({
          quantidade: it.quantidade,
          unidade: it.unidade,
          insumos: it.insumo,
        }),
      0,
    ) / (rend > 0 ? rend : 1);
  }, [todosItens, rend]);

  const custoFichaSimulado = useMemo(() => {
    if (!itemAtual || !novoInsumo) return custoFichaAtual;
    const total = todosItens.reduce((s, it) => {
      if (it.tempId === itemAtual.tempId) {
        return s + custoNovoLinha;
      }
      return (
        s +
        calcularCustoItem({
          quantidade: it.quantidade,
          unidade: it.unidade,
          insumos: it.insumo,
        })
      );
    }, 0);
    return total / (rend > 0 ? rend : 1);
  }, [todosItens, itemAtual, novoInsumo, custoNovoLinha, custoFichaAtual, rend]);

  const deltaLinha = custoNovoLinha - custoAtualLinha;
  const deltaFicha = custoFichaSimulado - custoFichaAtual;
  const deltaPct = custoFichaAtual > 0 ? (deltaFicha / custoFichaAtual) * 100 : 0;

  const cmvAtualPct = precoBase > 0 ? (custoFichaAtual / precoBase) * 100 : 0;
  const cmvNovoPct = precoBase > 0 ? (custoFichaSimulado / precoBase) * 100 : 0;

  const unidadeIncompativel =
    novoInsumo && !unidadesCompativeis(novaUnidade || novoInsumo.unidade_medida, novoInsumo.unidade_medida);

  const podeAplicar =
    !!novoInsumo &&
    parseFloat(novaQtd) > 0 &&
    !unidadeIncompativel &&
    novoInsumo.id !== itemAtual?.insumo.id;

  const handleAplicar = () => {
    if (!itemAtual || !novoInsumo || !podeAplicar) return;
    onAplicar(itemAtual.tempId, novoInsumo, parseFloat(novaQtd), novaUnidade || novoInsumo.unidade_medida);
    onOpenChange(false);
  };

  const DeltaIcon = deltaFicha < 0 ? TrendingDown : deltaFicha > 0 ? TrendingUp : Minus;
  const deltaColor = deltaFicha < 0 ? 'text-success' : deltaFicha > 0 ? 'text-destructive' : 'text-muted-foreground';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Replace className="h-4 w-4" />
              Simular substituição de ingrediente
            </DialogTitle>
          </DialogHeader>

          {itemAtual && (
            <div className="space-y-4">
              {/* Ingrediente atual */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-1">Trocar este ingrediente:</p>
                <div className="flex items-center gap-2">
                  <InsumoIcon nome={itemAtual.insumo.nome} className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm flex-1 truncate">{itemAtual.insumo.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {itemAtual.quantidade} {itemAtual.unidade}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrencyBRL(custoAtualLinha)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Novo ingrediente */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Substituir por:</Label>
                {novoInsumo ? (
                  <div className="rounded-lg border p-3 bg-accent/30 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <InsumoIcon nome={novoInsumo.nome} className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm truncate">{novoInsumo.nome}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrencySmartBRL(novoInsumo.custo_unitario)} por {novoInsumo.unidade_medida}
                          {Number(novoInsumo.fator_perda || 0) > 0 && (
                            <> • perda {Number(novoInsumo.fator_perda).toFixed(0)}%</>
                          )}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setNovoInsumo(null)}
                      >
                        Trocar
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Quantidade:</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={novaQtd}
                        onChange={(e) => setNovaQtd(e.target.value)}
                        className="w-20 h-8 text-center"
                      />
                      <Select value={novaUnidade || novoInsumo.unidade_medida} onValueChange={setNovaUnidade}>
                        <SelectTrigger className="w-[72px] h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {unidadesDoGrupo(novoInsumo.unidade_medida).map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex-1 text-right text-sm font-semibold tabular-nums">
                        {formatCurrencyBRL(custoNovoLinha)}
                      </div>
                    </div>

                    {unidadeIncompativel && (
                      <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 rounded p-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>Unidade incompatível com o insumo escolhido.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBuscaOpen(true)}
                    className="w-full justify-start gap-2 h-10"
                  >
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Buscar insumo substituto...</span>
                  </Button>
                )}
              </div>

              {/* Comparativo de impacto */}
              {novoInsumo && (
                <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-3">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Impacto na ficha</p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Custo da ficha (atual):</span>
                      <span className="font-medium tabular-nums">{formatCurrencyBRL(custoFichaAtual)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Custo da ficha (simulado):</span>
                      <span className="font-semibold tabular-nums">{formatCurrencyBRL(custoFichaSimulado)}</span>
                    </div>
                    <div className="border-t pt-2 flex items-center justify-between">
                      <span className="font-medium flex items-center gap-1.5">
                        <DeltaIcon className={`h-4 w-4 ${deltaColor}`} />
                        Variação:
                      </span>
                      <span className={`font-bold tabular-nums ${deltaColor}`}>
                        {deltaFicha >= 0 ? '+' : ''}
                        {formatCurrencyBRL(deltaFicha)} ({deltaPct >= 0 ? '+' : ''}
                        {deltaPct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  {precoBase > 0 && (
                    <div className="border-t pt-2 space-y-1 text-xs">
                      <p className="text-muted-foreground">
                        CMV no preço Balcão ({formatCurrencyBRL(precoBase)}):
                      </p>
                      <div className="flex items-center justify-between">
                        <span>Atual:</span>
                        <span className="font-medium tabular-nums">{cmvAtualPct.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Simulado:</span>
                        <span className={`font-semibold tabular-nums ${deltaColor}`}>
                          {cmvNovoPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAplicar} disabled={!podeAplicar}>
              Aplicar substituição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BuscarInsumoDialog
        open={buscaOpen}
        onOpenChange={setBuscaOpen}
        onSelect={(ins) => setNovoInsumo(ins as InsumoBasico)}
        insumosExistentes={itemAtual ? [itemAtual.insumo.id] : []}
      />
    </>
  );
};

export default SimuladorSubstituicaoDialog;
