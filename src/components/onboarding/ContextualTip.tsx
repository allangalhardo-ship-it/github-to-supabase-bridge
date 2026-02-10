import { useState } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextualTipProps {
  tipKey: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * A dismissible contextual tip banner shown to guide new users.
 * Once dismissed, it's stored in localStorage so it won't show again.
 */
const ContextualTip = ({ tipKey, title, description, icon, className }: ContextualTipProps) => {
  const storageKey = `tip-dismissed-${tipKey}`;
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(storageKey) === 'true';
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(storageKey, 'true');
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4',
        className
      )}
    >
      <div className="shrink-0 mt-0.5 text-primary">
        {icon || <Lightbulb className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Fechar dica"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default ContextualTip;
