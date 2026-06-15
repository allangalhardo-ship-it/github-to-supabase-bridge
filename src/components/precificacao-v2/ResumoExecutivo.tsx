import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Percent, 
  AlertTriangle, 
  TrendingUp,
  Package,
  Info,
} from 'lucide-react';
import { MetricasGerais, formatCurrency, formatPercent } from './types';
import { cn } from '@/lib/utils';


interface ResumoExecutivoProps {
  metricas: MetricasGerais;
  cmvAlvo: number;
  margemAlvo: number;
  isMobile?: boolean;
}

const ResumoExecutivo: React.FC<ResumoExecutivoProps> = ({
  metricas,
  cmvAlvo,
  margemAlvo,
  isMobile,
}) => {
  const cards = [
    {
      label: 'Produtos Analisados',
      value: metricas.totalProdutos.toString(),
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      tooltip: 'Produtos com ficha técnica cadastrada (insumos + quantidades).',
    },
    {
      label: 'Margem Média',
      value: formatPercent(metricas.margemMedia),
      icon: Percent,
      color: metricas.margemMedia >= margemAlvo ? 'text-emerald-600' : 
             metricas.margemMedia >= margemAlvo * 0.7 ? 'text-amber-600' : 'text-destructive',
      bgColor: metricas.margemMedia >= margemAlvo ? 'bg-emerald-500/10' : 
               metricas.margemMedia >= margemAlvo * 0.7 ? 'bg-amber-500/10' : 'bg-destructive/10',
      tooltip:
        'Média ponderada pelo preço de venda. Já desconta custo da ficha, imposto e taxa do canal. ' +
        'A taxa de canal é ponderada pelas VENDAS REAIS dos últimos 30 dias por canal — ' +
        'se 80% das vendas vêm do iFood, a taxa do iFood pesa 80%.',
    },
    {
      label: 'Críticos',
      value: metricas.produtosCriticos.toString(),
      icon: AlertTriangle,
      color: metricas.produtosCriticos > 0 ? 'text-destructive' : 'text-emerald-600',
      bgColor: metricas.produtosCriticos > 0 ? 'bg-destructive/10' : 'bg-emerald-500/10',
      subtitle: metricas.produtosCriticos > 0 ? 'precisam de atenção' : 'tudo certo!',
      tooltip: 'Produtos com margem de contribuição negativa (vendendo abaixo do custo+imposto+taxa).',
    },
    {
      label: 'Potencial',
      value: formatCurrency(metricas.receitaPotencial),
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
      subtitle: metricas.receitaPotencial > 0 ? '/mês se ajustar preços' : '',
      tooltip: 'Receita extra estimada por mês se você aplicar o preço sugerido em todos os produtos que vendem.',
    },
  ];

  return (
    <TooltipProvider>
      <div className={cn(
        "grid gap-3",
        isMobile ? "grid-cols-2" : "grid-cols-4"
      )}>
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className={cn("p-2 rounded-full", card.bgColor)}>
                  <card.icon className={cn("h-4 w-4", card.color)} />
                </div>
                {card.tooltip && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground">
                        <Info className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px]">
                      <p className="text-xs leading-relaxed">{card.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className={cn("text-2xl font-bold mt-0.5", card.color)}>
                  {card.value}
                </p>
                {card.subtitle && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {card.subtitle}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
};

export default ResumoExecutivo;
