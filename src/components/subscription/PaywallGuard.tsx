import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface PaywallGuardProps {
  children: React.ReactNode;
}

const PaywallGuard: React.FC<PaywallGuardProps> = ({ children }) => {
  const { hasAccess, loading, subscription } = useSubscription();
  const { user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Só redireciona para assinatura se:
  // 1. Usuário está logado (user existe)
  // 2. Trial expirou (status === 'expired') e não é assinante
  const shouldRedirectToSubscription = user && !hasAccess && subscription.status === 'expired';

  if (shouldRedirectToSubscription) {
    return <Navigate to="/assinatura" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default PaywallGuard;
