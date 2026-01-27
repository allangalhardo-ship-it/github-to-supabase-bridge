import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface TaxaCanal {
  id: string;
  canal_id: string;
  nome: string;
  percentual: number;
  created_at: string;
}

export interface CanalVenda {
  id: string;
  empresa_id: string;
  nome: string;
  tipo: 'presencial' | 'app_delivery' | 'proprio';
  ativo: boolean;
  created_at: string;
  updated_at: string;
  taxas?: TaxaCanal[];
}

export interface CanalComTaxaTotal extends CanalVenda {
  taxaTotal: number;
}

export function useCanaisVenda() {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar canais com suas taxas
  const { data: canais, isLoading } = useQuery({
    queryKey: ['canais_venda', usuario?.empresa_id],
    queryFn: async () => {
      // Buscar canais
      const { data: canaisData, error: canaisError } = await supabase
        .from('canais_venda')
        .select('*')
        .order('tipo')
        .order('nome');

      if (canaisError) throw canaisError;

      // Buscar taxas de todos os canais
      const { data: taxasData, error: taxasError } = await supabase
        .from('taxas_canais')
        .select('*')
        .order('created_at');

      if (taxasError) throw taxasError;

      // Agrupar taxas por canal e calcular total
      const canaisComTaxas: CanalComTaxaTotal[] = (canaisData || []).map(canal => {
        const taxasDoCanal = (taxasData || []).filter(t => t.canal_id === canal.id);
        const taxaTotal = taxasDoCanal.reduce((sum, t) => sum + Number(t.percentual), 0);
        return {
          ...canal,
          tipo: canal.tipo as 'presencial' | 'app_delivery' | 'proprio',
          taxas: taxasDoCanal,
          taxaTotal,
        };
      });

      return canaisComTaxas;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Criar canal
  const createCanalMutation = useMutation({
    mutationFn: async (data: { nome: string; tipo: string }) => {
      const { data: canal, error } = await supabase
        .from('canais_venda')
        .insert({
          empresa_id: usuario!.empresa_id,
          nome: data.nome,
          tipo: data.tipo,
        })
        .select()
        .single();

      if (error) throw error;
      return canal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canais_venda'] });
      toast({ title: 'Canal criado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar canal', description: error.message, variant: 'destructive' });
    },
  });

  // Atualizar canal
  const updateCanalMutation = useMutation({
    mutationFn: async (data: { id: string; nome: string; tipo: string }) => {
      const { error } = await supabase
        .from('canais_venda')
        .update({ nome: data.nome, tipo: data.tipo })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canais_venda'] });
      toast({ title: 'Canal atualizado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle ativo
  const toggleCanalMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('canais_venda')
        .update({ ativo })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canais_venda'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  // Deletar canal
  const deleteCanalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('canais_venda')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canais_venda'] });
      toast({ title: 'Canal removido!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    },
  });

  // Adicionar taxa a um canal
  const addTaxaMutation = useMutation({
    mutationFn: async (data: { canal_id: string; nome: string; percentual: number }) => {
      const { error } = await supabase
        .from('taxas_canais')
        .insert(data);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canais_venda'] });
      toast({ title: 'Taxa adicionada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao adicionar taxa', description: error.message, variant: 'destructive' });
    },
  });

  // Atualizar taxa
  const updateTaxaMutation = useMutation({
    mutationFn: async (data: { id: string; nome: string; percentual: number }) => {
      const { error } = await supabase
        .from('taxas_canais')
        .update({ nome: data.nome, percentual: data.percentual })
        .eq('id', data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canais_venda'] });
      toast({ title: 'Taxa atualizada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar taxa', description: error.message, variant: 'destructive' });
    },
  });

  // Deletar taxa
  const deleteTaxaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('taxas_canais')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canais_venda'] });
      toast({ title: 'Taxa removida!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover taxa', description: error.message, variant: 'destructive' });
    },
  });

  // Canais ativos para usar em selects
  const canaisAtivos = canais?.filter(c => c.ativo) || [];

  // Agrupar por tipo
  const canaisPorTipo = {
    presencial: canais?.filter(c => c.tipo === 'presencial') || [],
    app_delivery: canais?.filter(c => c.tipo === 'app_delivery') || [],
    proprio: canais?.filter(c => c.tipo === 'proprio') || [],
  };

  return {
    canais,
    canaisAtivos,
    canaisPorTipo,
    isLoading,
    createCanal: createCanalMutation.mutate,
    updateCanal: updateCanalMutation.mutate,
    toggleCanal: toggleCanalMutation.mutate,
    deleteCanal: deleteCanalMutation.mutate,
    addTaxa: addTaxaMutation.mutate,
    updateTaxa: updateTaxaMutation.mutate,
    deleteTaxa: deleteTaxaMutation.mutate,
    isCreating: createCanalMutation.isPending,
    isUpdating: updateCanalMutation.isPending,
  };
}
