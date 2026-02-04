import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface ReportCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  category: 'financeiro' | 'vendas' | 'operacional';
  onClick: () => void;
  isNew?: boolean;
  isComingSoon?: boolean;
}

const categoryColors = {
  financeiro: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  vendas: 'bg-blue-500/10 text-blue-600 border-blue-200',
  operacional: 'bg-amber-500/10 text-amber-600 border-amber-200',
};

const categoryLabels = {
  financeiro: 'Financeiro',
  vendas: 'Vendas',
  operacional: 'Operação',
};

export const ReportCard: React.FC<ReportCardProps> = ({
  title,
  description,
  icon: Icon,
  category,
  onClick,
  isNew,
  isComingSoon,
}) => {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] relative overflow-hidden',
        isComingSoon && 'opacity-60 cursor-not-allowed'
      )}
      onClick={isComingSoon ? undefined : onClick}
    >
      {isNew && (
        <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs">
          Novo
        </Badge>
      )}
      {isComingSoon && (
        <Badge className="absolute top-2 right-2 bg-muted text-muted-foreground text-xs">
          Em breve
        </Badge>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg', categoryColors[category])}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold line-clamp-1">
              {title}
            </CardTitle>
            <Badge variant="outline" className={cn('text-xs mt-1', categoryColors[category])}>
              {categoryLabels[category]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm line-clamp-2">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
};
