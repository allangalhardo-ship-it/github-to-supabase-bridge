import { QueryClient } from '@tanstack/react-query';

/**
 * Configuração otimizada do React Query para 1000+ usuários
 * 
 * Estratégias de cache:
 * - staleTime: Dados são considerados "frescos" por X tempo (evita re-fetch)
 * - gcTime: Dados ficam em cache por X tempo após não serem usados
 * - refetchOnWindowFocus: Atualiza dados quando usuário volta à aba
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados são considerados frescos por 2 minutos
      staleTime: 2 * 60 * 1000,
      
      // Manter em cache por 15 minutos
      gcTime: 15 * 60 * 1000,
      
      // Não re-buscar automaticamente ao focar janela (economiza requests)
      refetchOnWindowFocus: false,
      
      // Apenas 1 retry em caso de erro
      retry: 1,
      
      // Delay exponencial entre retries
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Não re-buscar ao reconectar (dados em cache são suficientes)
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 1,
    },
  },
});

/**
 * Cache keys padronizados para facilitar invalidação
 */
export const QUERY_KEYS = {
  // Dashboard
  vendas: (empresaId: string, inicio: string, fim: string) => 
    ['vendas-dashboard', empresaId, inicio, fim] as const,
  topProdutos: (empresaId: string, inicio: string, fim: string) => 
    ['top-produtos', empresaId, inicio, fim] as const,
  insumosAlerta: (empresaId: string) => 
    ['insumos-alerta', empresaId] as const,
  
  // Configurações
  config: (empresaId: string) => 
    ['config-dashboard', empresaId] as const,
  custosFixos: (empresaId: string) => 
    ['custos-fixos-dashboard', empresaId] as const,
  
  // Listas
  produtos: (empresaId: string) => 
    ['produtos', empresaId] as const,
  insumos: (empresaId: string) => 
    ['insumos', empresaId] as const,
  producoes: (empresaId: string) => 
    ['producoes', empresaId] as const,
  clientes: (empresaId: string) => 
    ['clientes', empresaId] as const,
} as const;

/**
 * Função para invalidar todos os caches de uma empresa
 * Útil após operações que afetam múltiplas tabelas
 */
export function invalidateEmpresaCaches(empresaId: string) {
  // Invalida todos os caches relacionados à empresa
  queryClient.invalidateQueries({ 
    predicate: (query) => 
      query.queryKey.includes(empresaId) 
  });
}

/**
 * Função para pré-carregar dados críticos
 * Chamar no login ou entrada no dashboard
 */
export async function prefetchCriticalData(empresaId: string) {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const fim = now.toISOString().split('T')[0];
  
  // Pré-carregar em paralelo
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.config(empresaId),
      staleTime: 5 * 60 * 1000,
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.custosFixos(empresaId),
      staleTime: 5 * 60 * 1000,
    }),
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.insumosAlerta(empresaId),
      staleTime: 5 * 60 * 1000,
    }),
  ]);
}
