import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, TrendingUp, TrendingDown } from 'lucide-react';
import { ProdutoAnalise, formatCurrency, formatPercent, ConfiguracoesPrecificacao } from './types';
import { cn } from '@/lib/utils';

interface SimuladorVisualProps {
  produtos: ProdutoAnalise[];
  config?: ConfiguracoesPrecificacao;
}

const SimuladorVisual: React.FC<SimuladorVisualProps> = ({ produtos, config }) => {
  const [ajustePercent, setAjustePercent] = useState(0);

  const impacto = useMemo(() => {
    if (produtos.length === 0) return null;
    const imposto = (config?.imposto_medio_sobre_vendas || 0) / 100;

    let margemAtualTotal = 0;
    let margemNovaTotal = 0;
    let lucroDiferencaTotal = 0;

    produtos.forEach(p => {
      const precoAtual = p.preco_venda;
      const precoNovo = precoAtual * (1 + ajustePercent / 100);
      const lucroAtual = precoAtual - p.custoInsumos - precoAtual * imposto;
      const lucroNovo = precoNovo - p.custoInsumos - precoNovo * imposto;
      const margemAtual = precoAtual > 0 ? (lucroAtual / precoAtual) * 100 : 0;
      const margemNova = precoNovo > 0 ? (lucroNovo / precoNovo) * 100 : 0;

      margemAtualTotal += margemAtual;
      margemNovaTotal += margemNova;
      lucroDiferencaTotal += (lucroNovo - lucroAtual) * (p.quantidadeVendida || 1);
    });

    const n = produtos.length;
    return {
      margemAtual: margemAtualTotal / n,
      margemNova: margemNovaTotal / n,
      lucroDiferenca: lucroDiferencaTotal,
    };
  }, [produtos, ajustePercent, config]);

  if (!impacto || produtos.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          Simulador: E se eu mudar o preço?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ajuste de preço</span>
            <Badge variant={ajustePercent > 0 ? 'default' : ajustePercent < 0 ? 'destructive' : 'secondary'}>
              {ajustePercent > 0 ? '+' : ''}{ajustePercent}%
            </Badge>
          </div>
          <Slider
            value={[ajustePercent]}
            onValueChange={(v) => setAjustePercent(v[0])}
            min={-30}
            max={30}
            step={1}
            className="py-2"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>-30%</span>
            <span>0%</span>
            <span>+30%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground">Margem Atual</p>
            <p className="text-lg font-bold">{formatPercent(impacto.margemAtual)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50 relative">
            <p className="text-[10px] text-muted-foreground">Nova Margem</p>
            <p className={cn(
              "text-lg font-bold",
              impacto.margemNova > impacto.margemAtual ? 'text-emerald-600' :
              impacto.margemNova < impacto.margemAtual ? 'text-destructive' : ''
            )}>
              {formatPercent(impacto.margemNova)}
            </p>
            {ajustePercent !== 0 && (
              <div className="absolute -top-2 -right-2">
                {impacto.margemNova > impacto.margemAtual ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
              </div>
            )}
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-[10px] text-muted-foreground">Impacto/mês</p>
            <p className={cn(
              "text-lg font-bold",
              impacto.lucroDiferenca > 0 ? 'text-emerald-600' :
              impacto.lucroDiferenca < 0 ? 'text-destructive' : ''
            )}>
              {impacto.lucroDiferenca > 0 ? '+' : ''}{formatCurrency(impacto.lucroDiferenca)}
            </p>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Simulação aplicada a {produtos.length} produto(s) com base nas vendas dos últimos 30 dias
        </p>
      </CardContent>
    </Card>
  );
};

export default SimuladorVisual;
