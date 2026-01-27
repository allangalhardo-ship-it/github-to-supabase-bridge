import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface PrecoCanal {
  id: string;
  produto_id: string;
  canal: string; // 'balcao' ou ID do taxas_apps
  preco: number;
}

export interface CanalConfig {
  id: string;
  nome: string;
  taxa: number;
  isBalcao: boolean;
}

export function usePrecosCanais(produtoId?: string) {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar todos os canais configurados (Balcão + Apps)
  const { data: canaisConfigurados } = useQuery({
    queryKey: ['canais-configurados', usuario?.empresa_id],
    queryFn: async () => {
      const { data: taxasApps, error } = await supabase
        .from('taxas_apps')
        .select('id, nome_app, taxa_percentual, ativo')
        .eq('ativo', true)
        .order('nome_app');

      if (error) throw error;

      const canais: CanalConfig[] = [
        { id: 'balcao', nome: 'Balcão', taxa: 0, isBalcao: true },
        ...(taxasApps || []).map(app => ({
          id: app.id,
          nome: app.nome_app,
          taxa: app.taxa_percentual,
          isBalcao: false,
        })),
      ];

      return canais;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar preços de um produto específico
  const { data: precosProduto, isLoading: isLoadingPrecos } = useQuery({
    queryKey: ['precos-canais', produtoId],
    queryFn: async () => {
      if (!produtoId) return [];
      
      const { data, error } = await supabase
        .from('precos_canais')
        .select('*')
        .eq('produto_id', produtoId);

      if (error) throw error;
      return data as PrecoCanal[];
    },
    enabled: !!produtoId,
  });

  // Buscar todos os preços da empresa (para vendas)
  const { data: todosPrecos } = useQuery({
    queryKey: ['todos-precos-canais', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precos_canais')
        .select('*');

      if (error) throw error;
      return data as PrecoCanal[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Atualizar ou criar preço de um canal
  const upsertPrecoMutation = useMutation({
    mutationFn: async ({ 
      produtoId, 
      canal, 
      preco 
    }: { 
      produtoId: string; 
      canal: string; 
      preco: number;
    }) => {
      if (!usuario?.empresa_id) throw new Error('Empresa não encontrada');

      const { error } = await supabase
        .from('precos_canais')
        .upsert({
          empresa_id: usuario.empresa_id,
          produto_id: produtoId,
          canal,
          preco,
        }, {
          onConflict: 'produto_id,canal',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['precos-canais'] });
      queryClient.invalidateQueries({ queryKey: ['todos-precos-canais'] });
    },
    onError: (error) => {
      toast({ 
        title: 'Erro ao salvar preço', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Atualizar múltiplos preços de uma vez
  const upsertMultiplosPrecosMutation = useMutation({
    mutationFn: async (precos: { produtoId: string; canal: string; preco: number }[]) => {
      if (!usuario?.empresa_id) throw new Error('Empresa não encontrada');

      const registros = precos.map(p => ({
        empresa_id: usuario.empresa_id,
        produto_id: p.produtoId,
        canal: p.canal,
        preco: p.preco,
      }));

      const { error } = await supabase
        .from('precos_canais')
        .upsert(registros, {
          onConflict: 'produto_id,canal',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['precos-canais'] });
      queryClient.invalidateQueries({ queryKey: ['todos-precos-canais'] });
      toast({ title: 'Preços salvos com sucesso!' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erro ao salvar preços', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Função auxiliar para obter preço de um produto em um canal específico
  const getPrecoCanal = (produtoId: string, canal: string, precoBase: number): number => {
    const precoCanal = todosPrecos?.find(
      p => p.produto_id === produtoId && p.canal === canal
    );
    return precoCanal?.preco ?? precoBase;
  };

  // Mapear preços do produto para um objeto por canal
  const precosMap = (precosProduto || []).reduce((acc, p) => {
    acc[p.canal] = p.preco;
    return acc;
  }, {} as Record<string, number>);

  return {
    canaisConfigurados,
    precosProduto,
    precosMap,
    todosPrecos,
    isLoadingPrecos,
    upsertPreco: upsertPrecoMutation.mutate,
    upsertMultiplosPrecos: upsertMultiplosPrecosMutation.mutate,
    isSaving: upsertPrecoMutation.isPending || upsertMultiplosPrecosMutation.isPending,
    getPrecoCanal,
  };
}
