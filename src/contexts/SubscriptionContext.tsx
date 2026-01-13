import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionStatus {
  subscribed: boolean;
  status: 'active' | 'trialing' | 'expired' | 'canceled' | 'loading';
  trialDaysRemaining: number;
  subscriptionEnd: string | null;
  trialEnd: string | null;
}

interface SubscriptionContextType {
  subscription: SubscriptionStatus;
  loading: boolean;
  checkSubscription: () => Promise<void>;
  openCheckout: () => Promise<void>;
  openCustomerPortal: () => Promise<void>;
  hasAccess: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    subscribed: false,
    status: 'loading',
    trialDaysRemaining: 7,
    subscriptionEnd: null,
    trialEnd: null,
  });

  const checkSubscription = useCallback(async () => {
    // If user isn't available yet, we can't determine access.
    if (!user) {
      setSubscription({
        subscribed: false,
        status: 'expired',
        trialDaysRemaining: 0,
        subscriptionEnd: null,
        trialEnd: null,
      });
      setLoading(false);
      return;
    }

    // Session can lag behind user during auth state changes.
    // In that case, keep loading so the paywall doesn't incorrectly redirect.
    if (!session?.access_token) {
      setSubscription((prev) => ({ ...prev, status: 'loading' }));
      setLoading(true);
      return;
    }

    const computeTrialFallback = (): SubscriptionStatus => {
      const createdAtStr = (user as any)?.created_at as string | undefined;
      if (createdAtStr) {
        const createdAt = new Date(createdAtStr);
        if (!isNaN(createdAt.getTime())) {
          const now = new Date();
          const daysSinceCreation = Math.floor(
            (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          const trialDaysRemaining = Math.max(0, 7 - daysSinceCreation);
          return {
            subscribed: false,
            status: trialDaysRemaining > 0 ? 'trialing' : 'expired',
            trialDaysRemaining,
            subscriptionEnd: null,
            trialEnd: null,
          };
        }
      }

      // If we can't read created_at for some reason, default to allowing the trial.
      return {
        subscribed: false,
        status: 'trialing',
        trialDaysRemaining: 7,
        subscriptionEnd: null,
        trialEnd: null,
      };
    };

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');

      if (error) {
        console.error('Error checking subscription:', error);
        setSubscription(computeTrialFallback());
        return;
      }

      setSubscription({
        subscribed: Boolean(data.subscribed),
        status: data.status,
        trialDaysRemaining: data.trial_days_remaining || 0,
        subscriptionEnd: data.subscription_end,
        trialEnd: data.trial_end,
      });
    } catch (err) {
      console.error('Error checking subscription:', err);
      setSubscription(computeTrialFallback());
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, user]);

  const openCheckout = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout');

      if (error) {
        console.error('Error creating checkout:', error);
        throw error;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error opening checkout:', err);
      throw err;
    }
  };

  const openCustomerPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) {
        console.error('Error opening customer portal:', error);
        throw error;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error opening customer portal:', err);
      throw err;
    }
  };

  // Check subscription on mount and when user changes
  useEffect(() => {
    if (user) {
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, [user, checkSubscription]);

  // Auto-refresh subscription status every 60 seconds
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      checkSubscription();
    }, 60000);

    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  // Check if user is a test user (bypass subscription check)
  const { usuario } = useAuth();
  const isTestUser = usuario?.is_test_user === true;

  // User has access if: test user OR subscribed OR in trial period OR still loading (prevent flicker redirect)
  const hasAccess = isTestUser || loading || subscription.subscribed || subscription.status === 'trialing';

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        checkSubscription,
        openCheckout,
        openCustomerPortal,
        hasAccess,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
