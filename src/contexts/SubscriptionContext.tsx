import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type PlanType = 'standard' | 'pro' | null;

interface SubscriptionStatus {
  subscribed: boolean;
  status: 'active' | 'trialing' | 'expired' | 'canceled' | 'loading';
  plan: PlanType;
  trialDaysRemaining: number;
  subscriptionEnd: string | null;
  trialEnd: string | null;
}

interface SubscriptionContextType {
  subscription: SubscriptionStatus;
  loading: boolean;
  checkSubscription: () => Promise<void>;
  openCustomerPortal: () => Promise<{ subscriptions: any[]; pendingPayments: any[] }>;
  cancelSubscription: () => Promise<void>;
  hasAccess: boolean;
  isPro: boolean;
  isAdmin: boolean;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    subscribed: false,
    status: 'loading',
    plan: null,
    trialDaysRemaining: 7,
    subscriptionEnd: null,
    trialEnd: null,
  });

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        setIsAdmin(!!data && !error);
      } catch (err) {
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [user?.id]);

  // Use a ref to track the last checked token to avoid duplicate calls
  const lastCheckedTokenRef = React.useRef<string | null>(null);

  const checkSubscription = useCallback(async (force = false) => {
    // If user isn't available yet, we can't determine access.
    if (!user) {
      setSubscription({
        subscribed: false,
        status: 'expired',
        plan: null,
        trialDaysRemaining: 0,
        subscriptionEnd: null,
        trialEnd: null,
      });
      setLoading(false);
      return;
    }

    // Session can lag behind user during auth state changes.
    if (!session?.access_token) {
      setSubscription((prev) => ({ ...prev, status: 'loading' }));
      setLoading(true);
      return;
    }

    // Skip if we already checked with this token (prevents duplicate calls on token refresh)
    if (!force && lastCheckedTokenRef.current === session.access_token) {
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
            plan: null,
            trialDaysRemaining,
            subscriptionEnd: null,
            trialEnd: null,
          };
        }
      }

      return {
        subscribed: false,
        status: 'trialing',
        plan: null,
        trialDaysRemaining: 7,
        subscriptionEnd: null,
        trialEnd: null,
      };
    };

    setLoading(true);

    try {
      lastCheckedTokenRef.current = session.access_token;
      const { data, error } = await supabase.functions.invoke('check-subscription');

      if (error) {
        console.error('Error checking subscription:', error);
        setSubscription(computeTrialFallback());
        return;
      }

      setSubscription({
        subscribed: Boolean(data.subscribed),
        status: data.status,
        plan: data.plan || null,
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

  const openCustomerPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('asaas-customer-portal');

      if (error) {
        console.error('Error opening customer portal:', error);
        throw error;
      }

      return {
        subscriptions: data?.subscriptions || [],
        pendingPayments: data?.pendingPayments || [],
      };
    } catch (err) {
      console.error('Error opening customer portal:', err);
      throw err;
    }
  };

  const cancelSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('asaas-cancel-subscription');

      if (error) {
        console.error('Error canceling subscription:', error);
        throw error;
      }

      // Refresh subscription status
      await checkSubscription();
      
      return data;
    } catch (err) {
      console.error('Error canceling subscription:', err);
      throw err;
    }
  };

  // Check subscription on mount and when user/session changes
  useEffect(() => {
    if (user && session?.access_token) {
      checkSubscription();
    } else if (!user) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]);

  // Auto-refresh subscription status every 5 minutes
  useEffect(() => {
    if (!user || !session?.access_token) return;

    const interval = setInterval(() => {
      checkSubscription(true); // force bypass token cache
    }, 300000); // 5 minutes

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, session?.access_token]);

  // Check if user is a test user (bypass subscription check)
  const { usuario } = useAuth();
  const isTestUser = usuario?.is_test_user === true;

  // User has access if: admin OR test user OR subscribed OR in trial period OR still loading (prevent flicker redirect)
  const hasAccess = isAdmin || isTestUser || loading || subscription.subscribed || subscription.status === 'trialing';

  // User is Pro ONLY if has Pro plan OR is admin (admins get Pro features)
  const isPro = subscription.plan === 'pro' || isAdmin;

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        checkSubscription,
        openCustomerPortal,
        cancelSubscription,
        hasAccess,
        isPro,
        isAdmin,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
