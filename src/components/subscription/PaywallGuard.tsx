import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Loader2 } from 'lucide-react';

interface PaywallGuardProps {
  children: React.ReactNode;
}

const PaywallGuard: React.FC<PaywallGuardProps> = ({ children }) => {
  const { hasAccess, loading } = useSubscription();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se não tem acesso (trial expirado e não assinante), redireciona para página de assinatura
  if (!hasAccess) {
    return <Navigate to="/assinatura" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default PaywallGuard;
