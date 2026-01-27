import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResumoQuadrante, QuadranteMenu } from './types';
import { cn } from '@/lib/utils';

interface QuadranteCardsProps {
  resumo: ResumoQuadrante[];
  quadranteSelecionado: QuadranteMenu | null;
  onSelectQuadrante: (quadrante: QuadranteMenu | null) => void;
  isMobile?: boolean;
}

const QuadranteCards: React.FC<QuadranteCardsProps> = ({
  resumo,
  quadranteSelecionado,
  onSelectQuadrante,
  isMobile,
}) => {
  const handleClick = (quadrante: QuadranteMenu) => {
    if (quadranteSelecionado === quadrante) {
      onSelectQuadrante(null);
    } else {
      onSelectQuadrante(quadrante);
    }
  };

  return (
    <div className={cn(
      "grid gap-3",
      isMobile ? "grid-cols-2" : "grid-cols-4"
    )}>
      {resumo.map((item) => {
        const isSelected = quadranteSelecionado === item.tipo;
        const hasItems = item.quantidade > 0;
        
        return (
          <Card
            key={item.tipo}
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-md",
              isSelected && "ring-2 ring-primary ring-offset-2",
              !hasItems && "opacity-60"
            )}
            onClick={() => handleClick(item.tipo)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className={cn("text-2xl", isMobile && "text-xl")}>
                  {item.icone}
                </div>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "font-bold text-lg px-2.5",
                    item.bgCor,
                    item.cor
                  )}
                >
                  {item.quantidade}
                </Badge>
              </div>
              
              <div className="mt-2 space-y-0.5">
                <h3 className={cn(
                  "font-semibold",
                  item.cor,
                  isMobile ? "text-sm" : "text-base"
                )}>
                  {item.label}
                </h3>
                {!isMobile && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {item.descricao}
                  </p>
                )}
              </div>

              {!isMobile && (
                <div className={cn(
                  "mt-3 pt-2 border-t text-xs",
                  item.cor
                )}>
                  💡 {item.acao}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default QuadranteCards;
