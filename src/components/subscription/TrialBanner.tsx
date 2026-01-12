import React from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const TrialBanner: React.FC = () => {
  const { subscription, hasAccess } = useSubscription();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = React.useState(false);

  // Não mostrar se já é assinante pago ou se foi dispensado
  if (subscription.subscribed && subscription.status === 'active') return null;
  if (dismissed) return null;
  if (subscription.status === 'loading') return null;

  // Mostrar apenas durante trial ou quando expirado
  if (subscription.status !== 'trialing' && subscription.status !== 'expired') return null;

  const isExpired = subscription.status === 'expired';
  const daysRemaining = subscription.trialDaysRemaining;
  const isUrgent = daysRemaining <= 2;

  return (
    <div 
      className={`
        px-4 py-2 flex items-center justify-between gap-4 text-sm flex-shrink-0
        ${isExpired 
          ? 'bg-destructive text-destructive-foreground' 
          : isUrgent 
            ? 'bg-amber-500 text-white' 
            : 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
        }
      `}
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">
          {isExpired 
            ? 'Teste expirou. Assine agora!' 
            : `${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''} de teste`
          }
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button 
          size="sm" 
          variant={isExpired ? "secondary" : "default"}
          className="h-7 text-xs whitespace-nowrap"
          onClick={() => navigate('/assinatura')}
        >
          {isExpired ? 'Assinar' : 'Ver Planos'}
        </Button>
        {!isExpired && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default TrialBanner;
