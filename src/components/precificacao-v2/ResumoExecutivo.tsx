import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Percent, 
  AlertTriangle, 
  TrendingUp,
  Package
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
    },
    {
      label: 'Margem Média',
      value: formatPercent(metricas.margemMedia),
      icon: Percent,
      color: metricas.margemMedia >= margemAlvo ? 'text-emerald-600' : 
             metricas.margemMedia >= margemAlvo * 0.7 ? 'text-amber-600' : 'text-destructive',
      bgColor: metricas.margemMedia >= margemAlvo ? 'bg-emerald-500/10' : 
               metricas.margemMedia >= margemAlvo * 0.7 ? 'bg-amber-500/10' : 'bg-destructive/10',
    },
    {
      label: 'Críticos',
      value: metricas.produtosCriticos.toString(),
      icon: AlertTriangle,
      color: metricas.produtosCriticos > 0 ? 'text-destructive' : 'text-emerald-600',
      bgColor: metricas.produtosCriticos > 0 ? 'bg-destructive/10' : 'bg-emerald-500/10',
      subtitle: metricas.produtosCriticos > 0 ? 'precisam de atenção' : 'tudo certo!',
    },
    {
      label: 'Potencial',
      value: formatCurrency(metricas.receitaPotencial),
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
      subtitle: metricas.receitaPotencial > 0 ? '/mês se ajustar preços' : '',
    },
  ];

  return (
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
  );
};

export default ResumoExecutivo;
