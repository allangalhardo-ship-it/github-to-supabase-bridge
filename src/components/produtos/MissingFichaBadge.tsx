import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MissingFichaBadgeProps {
  className?: string;
}

const MissingFichaBadge: React.FC<MissingFichaBadgeProps> = ({ className }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={`gap-1 text-warning border-warning bg-warning/10 cursor-help ${className || ''}`}
        >
          <AlertTriangle className="h-3 w-3" />
          <span className="text-[10px]">Sem ficha</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">Ficha técnica não cadastrada</p>
        <p className="text-xs text-muted-foreground">
          Adicione os ingredientes para calcular custos e lucros reais
        </p>
      </TooltipContent>
    </Tooltip>
  );
};

export default MissingFichaBadge;
