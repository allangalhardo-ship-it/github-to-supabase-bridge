import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/useOnboarding';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { Loader2 } from 'lucide-react';

interface PaywallGuardProps {
  children: React.ReactNode;
}

const PaywallGuard: React.FC<PaywallGuardProps> = ({ children }) => {
  const { hasAccess, loading: subscriptionLoading, subscription } = useSubscription();
  const { user } = useAuth();
  const location = useLocation();
  const { 
    showOnboarding, 
    initialStep, 
    isLoading: onboardingLoading, 
    completeOnboarding 
  } = useOnboarding();

  // Loading state combinado
  const isLoading = subscriptionLoading || onboardingLoading;

  if (isLoading) {
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

  // Mostrar onboarding para novos usuários (exceto se estiver na página de assinatura)
  if (showOnboarding && user && location.pathname !== '/assinatura') {
    return <OnboardingWizard onComplete={completeOnboarding} initialStep={initialStep} />;
  }

  return <>{children}</>;
};

export default PaywallGuard;
