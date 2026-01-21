import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  Circle, 
  Settings, 
  ChevronRight,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ChecklistItem } from './types';

interface ConfigChecklistProps {
  items: ChecklistItem[];
  onDismiss?: () => void;
  isCollapsed?: boolean;
}

const ConfigChecklist: React.FC<ConfigChecklistProps> = ({ 
  items, 
  onDismiss,
  isCollapsed = false 
}) => {
  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allCompleted = completedCount === totalCount;
  const hasHighPriority = items.some(i => !i.completed && i.priority === 'high');

  if (allCompleted && isCollapsed) {
    return null;
  }

  if (allCompleted) {
    return (
      <Card className="border-success/30 bg-gradient-to-br from-success/5 to-success/10">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-success/20">
                <Sparkles className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-medium text-success">Configuração completa!</p>
                <p className="text-sm text-muted-foreground">
                  Todos os parâmetros estão configurados para cálculo preciso
                </p>
              </div>
            </div>
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Ocultar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={hasHighPriority ? 'border-warning/50 bg-warning/5' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Configure para precisão máxima</CardTitle>
              <CardDescription className="text-sm">
                {completedCount} de {totalCount} configurações completas
              </CardDescription>
            </div>
          </div>
          <Badge variant={hasHighPriority ? 'destructive' : 'secondary'}>
            {hasHighPriority ? 'Ação necessária' : 'Opcional'}
          </Badge>
        </div>
        <Progress value={progress} className="h-2 mt-3" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {items.filter(i => !i.completed).map((item) => (
            <Link
              key={item.id}
              to={item.link}
              className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                ) : (
                  <Circle className={`h-5 w-5 shrink-0 ${
                    item.priority === 'high' ? 'text-warning' : 'text-muted-foreground'
                  }`} />
                )}
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    {item.label}
                    {item.priority === 'high' && !item.completed && (
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          ))}
        </div>
        
        {items.some(i => i.completed) && (
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              Ver itens configurados ({completedCount})
            </summary>
            <div className="mt-2 space-y-1">
              {items.filter(i => i.completed).map((item) => (
                <div key={item.id} className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {item.label}
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
};

export default ConfigChecklist;
