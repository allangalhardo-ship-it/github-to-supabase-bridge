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
  const { data: progress, isLoading: progressLoading, refetch } = useQuery({
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

  // Verificar se usuário já tem dados cadastrados (insumos, produtos, fichas)
  const { data: existingData, isLoading: dataLoading } = useQuery({
    queryKey: ['onboarding-existing-data', usuario?.empresa_id],
    queryFn: async () => {
      if (!usuario?.empresa_id) return null;

      // Buscar contagem de insumos, produtos e fichas técnicas
      const [insumosResult, produtosResult, fichasResult] = await Promise.all([
        supabase
          .from('insumos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id),
        supabase
          .from('produtos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', usuario.empresa_id),
        supabase
          .from('fichas_tecnicas')
          .select('id', { count: 'exact', head: true })
          .eq('produto_id', usuario.empresa_id), // This will be filtered by RLS
      ]);

      // Buscar fichas com join correto
      const { count: fichasCount } = await supabase
        .from('produtos')
        .select('fichas_tecnicas(id)', { count: 'exact', head: true })
        .eq('empresa_id', usuario.empresa_id)
        .not('fichas_tecnicas', 'is', null);

      return {
        hasInsumos: (insumosResult.count || 0) > 0,
        hasProdutos: (produtosResult.count || 0) > 0,
        hasFichas: (fichasCount || 0) > 0,
        insumosCount: insumosResult.count || 0,
        produtosCount: produtosResult.count || 0,
      };
    },
    enabled: !!usuario?.empresa_id,
  });

  const isLoading = progressLoading || dataLoading;

  // Verificar se precisa mostrar onboarding
  useEffect(() => {
    if (isLoading || !user?.id) return;

    // Se já completou o onboarding, não mostrar
    if (progress?.completed) {
      setShowOnboarding(false);
      return;
    }

    // Se usuário já tem dados cadastrados, marcar onboarding como completo
    if (existingData?.hasInsumos && existingData?.hasProdutos) {
      // Usuário já tem insumos e produtos - pular onboarding
      markOnboardingComplete();
      setShowOnboarding(false);
      return;
    }

    // Se não tem progresso e não tem dados, é usuário novo -> mostrar onboarding
    if (!progress) {
      setShowOnboarding(true);
      setInitialStep(1);
      return;
    }

    // Se tem progresso mas não completou, continuar de onde parou
    setShowOnboarding(true);
    setInitialStep(progress.current_step);
  }, [progress, existingData, isLoading, user?.id]);

  // Marcar onboarding como completo (para usuários existentes)
  const markOnboardingComplete = async () => {
    if (!user?.id || !usuario?.empresa_id) return;

    try {
      await supabase
        .from('onboarding_progress')
        .upsert({
          user_id: user.id,
          empresa_id: usuario.empresa_id,
          current_step: 6,
          completed: true,
        }, { onConflict: 'user_id' });
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
    }
  };

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
