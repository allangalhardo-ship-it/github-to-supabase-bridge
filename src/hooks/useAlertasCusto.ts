import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface AlertaCusto {
  id: string;
  empresa_id: string;
  insumo_id: string;
  produto_id: string;
  custo_anterior: number;
  custo_novo: number;
  variacao_pct: number;
  custo_ficha_anterior: number;
  custo_ficha_novo: number;
  margem_antes: number | null;
  margem_depois: number | null;
  margem_meta: number | null;
  canal_pior: string | null;
  status: 'ativo' | 'dispensado' | 'resolvido';
  created_at: string;
  resolved_at: string | null;
  insumos?: { nome: string } | null;
  produtos?: { nome: string } | null;
}

export function useAlertasCusto() {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: alertas, isLoading } = useQuery({
    queryKey: ['alertas-custo', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alertas_custo')
        .select('*, insumos:insumo_id(nome), produtos:produto_id(nome)')
        .eq('status', 'ativo')
        .order('variacao_pct', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as AlertaCusto[];
    },
    enabled: !!usuario?.empresa_id,
  });

  const dispensarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('alertas_custo')
        .update({ status: 'dispensado', resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas-custo'] });
      toast({ title: 'Alerta dispensado' });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao dispensar', description: e.message, variant: 'destructive' });
    },
  });

  return {
    alertas: alertas || [],
    isLoading,
    qtdAtivos: alertas?.length || 0,
    dispensar: dispensarMutation.mutate,
    isDispensando: dispensarMutation.isPending,
  };
}
