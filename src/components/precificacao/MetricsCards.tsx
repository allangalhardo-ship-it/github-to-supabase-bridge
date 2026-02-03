import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Percent, 
  TrendingDown, 
  TrendingUp, 
  CheckCircle2,
  Package
} from 'lucide-react';

interface MetricsCardsProps {
  margemMedia: number;
  produtosAbaixo: number;
  produtosIdeais: number;
  produtosAcima: number;
  totalProdutos: number;
  isMobile?: boolean;
}

const MetricsCards: React.FC<MetricsCardsProps> = ({
  margemMedia,
  produtosAbaixo,
  produtosIdeais,
  produtosAcima,
  totalProdutos,
  isMobile
}) => {
  const metrics = [
    {
      label: 'Margem Média',
      value: `${margemMedia.toFixed(1)}%`,
      icon: Percent,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Abaixo',
      value: produtosAbaixo,
      icon: TrendingDown,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      label: 'Ideal',
      value: produtosIdeais,
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Acima',
      value: produtosAcima,
      icon: TrendingUp,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
  ];

  if (isMobile) {
    // Mobile: 2x2 grid with larger touch targets
    return (
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => (
          <Card key={metric.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-full ${metric.bgColor}`}>
                  <metric.icon className={`h-5 w-5 ${metric.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className={`text-xl font-bold ${metric.color}`}>{metric.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Desktop: horizontal row
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardContent className="pt-4 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${metric.bgColor}`}>
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className={`text-xl font-bold ${metric.color}`}>{metric.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MetricsCards;
