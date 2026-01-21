import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface OnboardingProgress {
  id: string;
  user_id: string;
  empresa_id: string;
  current_step: number;
  completed: boolean;
  first_insumo_id: string | null;
  first_produto_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useOnboarding = () => {
  const { user, usuario } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [initialStep, setInitialStep] = useState(1);

  // Buscar progresso do onboarding
  const { data: progress, isLoading, refetch } = useQuery({
    queryKey: ['onboarding-progress', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching onboarding progress:', error);
        return null;
      }

      return data as OnboardingProgress | null;
    },
    enabled: !!user?.id,
  });

  // Verificar se precisa mostrar onboarding
  useEffect(() => {
    if (isLoading || !user?.id) return;

    // Se não tem progresso, é usuário novo -> mostrar onboarding
    if (!progress) {
      setShowOnboarding(true);
      setInitialStep(1);
      return;
    }

    // Se já completou, não mostrar
    if (progress.completed) {
      setShowOnboarding(false);
      return;
    }

    // Se tem progresso mas não completou, continuar de onde parou
    setShowOnboarding(true);
    setInitialStep(progress.current_step);
  }, [progress, isLoading, user?.id]);

  const completeOnboarding = async () => {
    setShowOnboarding(false);
    await refetch();
  };

  const resetOnboarding = async () => {
    if (!user?.id) return;

    await supabase
      .from('onboarding_progress')
      .delete()
      .eq('user_id', user.id);

    await refetch();
    setShowOnboarding(true);
    setInitialStep(1);
  };

  return {
    showOnboarding,
    initialStep,
    isLoading,
    progress,
    completeOnboarding,
    resetOnboarding,
  };
};
