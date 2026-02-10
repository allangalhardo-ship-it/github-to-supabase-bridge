import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, TrendingUp, TrendingDown, Building2 } from 'lucide-react';
import { ProdutoAnalise, formatCurrency, ConfiguracoesPrecificacao } from './types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SimuladorVisualProps {
  produtos: ProdutoAnalise[];
  config?: ConfiguracoesPrecificacao;
}

const SimuladorVisual: React.FC<SimuladorVisualProps> = ({ produtos, config }) => {
  const { usuario } = useAuth();
  const [ajustePercent, setAjustePercent] = useState(0);

  // Buscar custos fixos totais
  const { data: custosFixos } = useQuery({
    queryKey: ['custos-fixos-total', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custos_fixos')
        .select('nome, valor_mensal, categoria')
        .eq('empresa_id', usuario?.empresa_id!);

      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id,
  });

  const simulacao = useMemo(() => {
    if (!custosFixos || custosFixos.length === 0 || produtos.length === 0) return null;

    const custoFixoAtual = custosFixos.reduce((sum, c) => sum + Number(c.valor_mensal), 0);
    const custoFixoNovo = custoFixoAtual * (1 + ajustePercent / 100);
    const diferencaMensal = custoFixoNovo - custoFixoAtual;

    // Faturamento mensal com base nas vendas dos últimos 30 dias
    const faturamentoMensal = produtos.reduce((sum, p) => sum + p.receitaTotal, 0);

    // Lucro bruto mensal (receita - custo de insumos)
    const lucroBrutoMensal = produtos.reduce((sum, p) => {
      const lucroUnit = p.preco_venda - p.custoInsumos;
      return sum + lucroUnit * (p.quantidadeVendida || 0);
    }, 0);

    // Margem de contribuição atual (descontando custos fixos)
    const lucroLiquidoAtual = lucroBrutoMensal - custoFixoAtual;
    const lucroLiquidoNovo = lucroBrutoMensal - custoFixoNovo;

    // Quanto precisa faturar a mais para cobrir
    // Se margem bruta média = lucroBruto / faturamento, 
    // então faturamento extra = diferença / margemBruta%
    const margemBrutaPct = faturamentoMensal > 0 ? lucroBrutoMensal / faturamentoMensal : 0;
    const faturamentoExtraNecessario = margemBrutaPct > 0 ? diferencaMensal / margemBrutaPct : 0;

    // Top categorias de custo fixo
    const porCategoria = custosFixos.reduce((acc, c) => {
      const cat = c.categoria || 'Outros';
      acc[cat] = (acc[cat] || 0) + Number(c.valor_mensal);
      return acc;
    }, {} as Record<string, number>);

    const topCategorias = Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      custoFixoAtual,
      custoFixoNovo,
      diferencaMensal,
      faturamentoMensal,
      lucroLiquidoAtual,
      lucroLiquidoNovo,
      faturamentoExtraNecessario,
      topCategorias,
    };
  }, [custosFixos, produtos, ajustePercent]);

  if (!simulacao) return null;

  const isAumento = ajustePercent > 0;
  const isReducao = ajustePercent < 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-5 w-5 text-primary" />
          E se meus custos fixos mudarem?
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Simule o impacto de reajustes no aluguel, funcionários e outros custos fixos no seu resultado mensal.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Variação dos custos fixos</span>
            <Badge variant={isAumento ? 'destructive' : isReducao ? 'default' : 'secondary'}>
              {ajustePercent > 0 ? '+' : ''}{ajustePercent}%
            </Badge>
          </div>
          <Slider
            value={[ajustePercent]}
            onValueChange={(v) => setAjustePercent(v[0])}
            min={-30}
            max={30}
            step={5}
            className="py-2"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>-30%</span>
            <span>0%</span>
            <span>+30%</span>
          </div>
        </div>

        {/* Resultados */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase">Custos fixos/mês</p>
            <p className="text-sm font-bold">{formatCurrency(simulacao.custoFixoAtual)}</p>
            {ajustePercent !== 0 && (
              <p className={cn(
                "text-xs font-semibold",
                isAumento ? "text-destructive" : "text-emerald-600"
              )}>
                → {formatCurrency(simulacao.custoFixoNovo)}
                <span className="ml-1 text-[10px] font-normal">
                  ({isAumento ? '+' : ''}{formatCurrency(simulacao.diferencaMensal)})
                </span>
              </p>
            )}
          </div>

          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase">Lucro líquido/mês</p>
            <p className={cn(
              "text-sm font-bold",
              simulacao.lucroLiquidoAtual < 0 ? "text-destructive" : ""
            )}>
              {formatCurrency(simulacao.lucroLiquidoAtual)}
            </p>
            {ajustePercent !== 0 && (
              <p className={cn(
                "text-xs font-semibold",
                simulacao.lucroLiquidoNovo < simulacao.lucroLiquidoAtual ? "text-destructive" : "text-emerald-600"
              )}>
                → {formatCurrency(simulacao.lucroLiquidoNovo)}
                {simulacao.lucroLiquidoNovo < 0 && (
                  <Badge variant="destructive" className="ml-1 text-[9px] px-1 h-4">
                    Prejuízo
                  </Badge>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Insight principal */}
        {ajustePercent > 0 && simulacao.faturamentoExtraNecessario > 0 && (
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1">
            <p className="text-xs font-semibold text-foreground">
              💡 Para manter seu lucro, você precisaria faturar mais{' '}
              <span className="text-amber-600 font-bold">
                {formatCurrency(simulacao.faturamentoExtraNecessario)}
              </span>
              {' '}por mês.
            </p>
            {simulacao.faturamentoMensal > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Isso é {((simulacao.faturamentoExtraNecessario / simulacao.faturamentoMensal) * 100).toFixed(1)}% a mais do que seu faturamento atual de {formatCurrency(simulacao.faturamentoMensal)}.
              </p>
            )}
          </div>
        )}

        {ajustePercent < 0 && (
          <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
            <p className="text-xs font-semibold text-foreground">
              ✅ Ao reduzir custos fixos, você economiza{' '}
              <span className="text-emerald-600 font-bold">
                {formatCurrency(Math.abs(simulacao.diferencaMensal))}
              </span>
              {' '}por mês — direto no lucro.
            </p>
          </div>
        )}

        {/* Top custos fixos */}
        {simulacao.topCategorias.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {simulacao.topCategorias.map(([cat, valor]) => (
              <Badge key={cat} variant="outline" className="text-[10px]">
                {cat}: {formatCurrency(valor)}/mês
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimuladorVisual;
