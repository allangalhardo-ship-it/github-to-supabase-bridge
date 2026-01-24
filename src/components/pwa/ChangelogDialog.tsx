import { useState } from 'react';
import { History, Sparkles, Wrench, Bug, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { changelog, changeTypeLabels, type ChangelogEntry } from '@/lib/changelog';
import { cn } from '@/lib/utils';

const typeIcons = {
  feature: Sparkles,
  improvement: Wrench,
  fix: Bug,
  security: Shield,
};

interface ChangelogItemProps {
  entry: ChangelogEntry;
  isLatest?: boolean;
  defaultExpanded?: boolean;
}

const ChangelogItem = ({ entry, isLatest, defaultExpanded = false }: ChangelogItemProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={cn(
      "border rounded-lg overflow-hidden",
      isLatest ? "border-primary/50 bg-primary/5" : "border-border"
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full",
            isLatest ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            <History className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">v{entry.version}</span>
              {isLatest && (
                <Badge className="bg-primary text-primary-foreground text-xs">
                  Atual
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{entry.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">
            {new Date(entry.date).toLocaleDateString('pt-BR')}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {entry.changes.map((change, idx) => {
            const Icon = typeIcons[change.type];
            const typeInfo = changeTypeLabels[change.type];
            
            return (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <Badge 
                  variant="secondary" 
                  className={cn("text-white text-xs shrink-0", typeInfo.color)}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {typeInfo.label}
                </Badge>
                <span className="text-muted-foreground">{change.description}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface ChangelogDialogProps {
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
}

export const ChangelogDialog = ({ trigger, defaultOpen }: ChangelogDialogProps) => {
  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            Novidades
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Versões
          </DialogTitle>
          <DialogDescription>
            Veja o que mudou em cada atualização do aplicativo.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-3">
            {changelog.map((entry, idx) => (
              <ChangelogItem 
                key={entry.version} 
                entry={entry} 
                isLatest={idx === 0}
                defaultExpanded={idx === 0}
              />
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ChangelogDialog;
