import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { subDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, ChefHat, Scale, Factory } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPercent } from './types';
import type { PeriodoBCG } from './useMenuEngineering';

interface KpisAvancadosProps {
  cmvTeorico: number;        // % — média ponderada dos custos da ficha (já vem do useMenuEngineering.metricas.cmvMedio)
  cmvAlvo: number;           // %
  margemAlvo: number;        // %
  periodo: PeriodoBCG;
  isMobile?: boolean;
}

/**
 * KPIs avançados de precificação:
 *  - Food Cost Real: SUM(custo_snapshot) / SUM(valor_total) das vendas do período
 *  - Food Cost Teórico: vem da ficha técnica (cmvMedio)
 *  - Prime Cost: CMV Real + (mão de obra mensal / faturamento mensal)
 */
const KpisAvancados: React.FC<KpisAvancadosProps> = ({
  cmvTeorico,
  cmvAlvo,
  margemAlvo,
  periodo,
  isMobile,
}) => {
  const { usuario } = useAuth();

  // Food Cost REAL — usa snapshot de custo já gravado em cada venda
  const { data: foodCostReal } = useQuery({
    queryKey: ['food-cost-real', usuario?.empresa_id, periodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), periodo).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('vendas')
        .select('valor_total, custo_snapshot')
        .eq('empresa_id', usuario?.empresa_id)
        .gte('data_venda', dataInicio)
        .not('custo_snapshot', 'is', null);

      if (error) throw error;

      const somaReceita = (data || []).reduce((a, v) => a + Number(v.valor_total || 0), 0);
      const somaCusto = (data || []).reduce((a, v) => a + Number(v.custo_snapshot || 0), 0);
      const pct = somaReceita > 0 ? (somaCusto / somaReceita) * 100 : 0;
      return { pct, temDados: somaReceita > 0 };
    },
    enabled: !!usuario?.empresa_id,
  });

  // Mão de obra mensal (custos_fixos com categoria de pessoal)
  const { data: maoObraInfo } = useQuery({
    queryKey: ['mao-obra-config', usuario?.empresa_id],
    queryFn: async () => {
      const [{ data: custos }, { data: cfg }] = await Promise.all([
        supabase
          .from('custos_fixos')
          .select('valor_mensal, categoria, nome')
          .eq('empresa_id', usuario?.empresa_id),
        supabase
          .from('configuracoes')
          .select('faturamento_mensal')
          .eq('empresa_id', usuario?.empresa_id)
          .maybeSingle(),
      ]);

      // Categorias consideradas mão de obra
      const padroesMO = ['mao', 'mão', 'pessoal', 'salário', 'salario', 'funcionário', 'funcionario', 'pro labore', 'pró labore'];
      const isMaoObra = (c?: string | null, n?: string | null) => {
        const text = `${c || ''} ${n || ''}`.toLowerCase();
        return padroesMO.some(p => text.includes(p));
      };

      const totalMO = (custos || [])
        .filter(c => isMaoObra(c.categoria, c.nome))
        .reduce((a, c) => a + Number(c.valor_mensal || 0), 0);

      return { totalMO, faturamento: Number(cfg?.faturamento_mensal || 0) };
    },
    enabled: !!usuario?.empresa_id,
  });

  const cmvReal = foodCostReal?.pct ?? 0;
  const temVendas = foodCostReal?.temDados ?? false;
  const moPct = maoObraInfo && maoObraInfo.faturamento > 0
    ? (maoObraInfo.totalMO / maoObraInfo.faturamento) * 100
    : 0;
  const primeCost = cmvReal + moPct;
  const primeCostAlvo = cmvAlvo + 25; // benchmark gastronômico: prime cost ≤ 60-65%

  const corCmv = (pct: number, alvo: number) =>
    pct === 0 ? 'text-muted-foreground' :
    pct <= alvo ? 'text-emerald-600' :
    pct <= alvo + 5 ? 'text-amber-600' : 'text-destructive';

  const bgCmv = (pct: number, alvo: number) =>
    pct === 0 ? 'bg-muted/40' :
    pct <= alvo ? 'bg-emerald-500/10' :
    pct <= alvo + 5 ? 'bg-amber-500/10' : 'bg-destructive/10';

  const variacaoTeoricoReal = cmvReal > 0 && cmvTeorico > 0 ? cmvReal - cmvTeorico : 0;

  const cards = [
    {
      label: 'Food Cost Teórico',
      value: cmvTeorico > 0 ? formatPercent(cmvTeorico) : '—',
      icon: ChefHat,
      cor: corCmv(cmvTeorico, cmvAlvo),
      bg: bgCmv(cmvTeorico, cmvAlvo),
      subtitle: `Meta: ${cmvAlvo.toFixed(0)}%`,
      tooltip: 'CMV calculado pela ficha técnica de cada produto, ponderado pelo preço de venda. É o "deveria ser".',
    },
    {
      label: 'Food Cost Real',
      value: temVendas ? formatPercent(cmvReal) : '—',
      icon: Scale,
      cor: corCmv(cmvReal, cmvAlvo),
      bg: bgCmv(cmvReal, cmvAlvo),
      subtitle: temVendas
        ? (Math.abs(variacaoTeoricoReal) < 0.5
            ? 'igual ao teórico ✓'
            : `${variacaoTeoricoReal > 0 ? '+' : ''}${variacaoTeoricoReal.toFixed(1)}pp vs teórico`)
        : 'sem vendas no período',
      tooltip:
        'CMV real das vendas do período (custo congelado na hora da venda ÷ receita). ' +
        'Se muito maior que o teórico → desperdício, porcionamento errado ou roubo. ' +
        'Se menor → ficha técnica subestimando custo ou produtos vendidos com cupom de margem maior.',
    },
    {
      label: 'Prime Cost',
      value: temVendas && moPct > 0 ? formatPercent(primeCost) : '—',
      icon: Factory,
      cor: corCmv(primeCost, primeCostAlvo),
      bg: bgCmv(primeCost, primeCostAlvo),
      subtitle: moPct > 0
        ? `CMV ${cmvReal.toFixed(0)}% + Mão de obra ${moPct.toFixed(0)}%`
        : 'cadastre mão de obra em Custos Fixos',
      tooltip:
        'Prime Cost = CMV + Mão de Obra. É o indicador-chave da gastronomia: ' +
        'o ideal é ficar entre 55% e 65% do faturamento. Acima de 70% o negócio sufoca.',
    },
  ];

  return (
    <TooltipProvider>
      <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
        {cards.map(card => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className={cn('p-2 rounded-full', card.bg)}>
                  <card.icon className={cn('h-4 w-4', card.cor)} />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px]">
                    <p className="text-xs leading-relaxed">{card.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className={cn('text-2xl font-bold mt-0.5', card.cor)}>{card.value}</p>
                {card.subtitle && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{card.subtitle}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
};

export default KpisAvancados;
