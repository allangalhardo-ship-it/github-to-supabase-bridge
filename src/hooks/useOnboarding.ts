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
  const [checkedExistingData, setCheckedExistingData] = useState(false);

  const userId = user?.id;
  const empresaId = usuario?.empresa_id;

  // Buscar progresso do onboarding - SEMPRE chamado
  const { data: progress, isLoading: progressLoading, refetch } = useQuery({
    queryKey: ['onboarding-progress', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching onboarding progress:', error);
        return null;
      }

      return data as OnboardingProgress | null;
    },
    enabled: !!userId,
  });

  // Verificar se usuário já tem dados cadastrados - SEMPRE chamado
  const { data: existingData, isLoading: dataLoading } = useQuery({
    queryKey: ['onboarding-existing-data', empresaId],
    queryFn: async () => {
      if (!empresaId) return { hasInsumos: false, hasProdutos: false };

      // Buscar contagem de insumos e produtos
      const [insumosResult, produtosResult] = await Promise.all([
        supabase
          .from('insumos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId),
        supabase
          .from('produtos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId),
      ]);

      return {
        hasInsumos: (insumosResult.count || 0) > 0,
        hasProdutos: (produtosResult.count || 0) > 0,
      };
    },
    enabled: !!empresaId,
  });

  const isLoading = progressLoading || dataLoading || !checkedExistingData;

  // Marcar onboarding como completo (para usuários existentes)
  const markOnboardingComplete = async () => {
    if (!userId || !empresaId) return;

    try {
      await supabase
        .from('onboarding_progress')
        .upsert({
          user_id: userId,
          empresa_id: empresaId,
          current_step: 6,
          completed: true,
        }, { onConflict: 'user_id' });
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
    }
  };

  // Verificar se precisa mostrar onboarding
  useEffect(() => {
    // Aguardar dados carregarem
    if (progressLoading || dataLoading) return;
    if (!userId) {
      setCheckedExistingData(true);
      return;
    }

    // Se já completou o onboarding, não mostrar
    if (progress?.completed) {
      setShowOnboarding(false);
      setCheckedExistingData(true);
      return;
    }

    // Se usuário já tem dados cadastrados, marcar onboarding como completo
    if (existingData?.hasInsumos && existingData?.hasProdutos) {
      markOnboardingComplete();
      setShowOnboarding(false);
      setCheckedExistingData(true);
      return;
    }

    // Se não tem progresso e não tem dados, é usuário novo -> mostrar onboarding
    if (!progress) {
      setShowOnboarding(true);
      setInitialStep(1);
      setCheckedExistingData(true);
      return;
    }

    // Se tem progresso mas não completou, continuar de onde parou
    setShowOnboarding(true);
    setInitialStep(progress.current_step);
    setCheckedExistingData(true);
  }, [progress, existingData, progressLoading, dataLoading, userId, empresaId]);

  const completeOnboarding = async () => {
    setShowOnboarding(false);
    await refetch();
  };

  const resetOnboarding = async () => {
    if (!userId) return;

    await supabase
      .from('onboarding_progress')
      .delete()
      .eq('user_id', userId);

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
