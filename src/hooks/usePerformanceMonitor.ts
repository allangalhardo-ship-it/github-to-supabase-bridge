import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface PerformanceMetrics {
  queryCount: number;
  avgQueryTime: number;
  cacheHitRate: number;
  renderCount: number;
}

/**
 * Hook para monitorar performance da aplicação
 * Útil para identificar gargalos durante picos de uso
 */
export function usePerformanceMonitor(componentName?: string) {
  const renderCount = useRef(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    renderCount.current += 1;
    
    // Log apenas em desenvolvimento
    if (import.meta.env.DEV && componentName) {
      console.debug(`[Perf] ${componentName} rendered ${renderCount.current}x`);
    }
  });

  const getMetrics = (): PerformanceMetrics => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const successQueries = queries.filter(q => q.state.status === 'success');
    const cacheHits = successQueries.filter(q => !q.state.dataUpdatedAt);
    
    return {
      queryCount: queries.length,
      avgQueryTime: 0, // Calculado se necessário
      cacheHitRate: successQueries.length > 0 
        ? (cacheHits.length / successQueries.length) * 100 
        : 0,
      renderCount: renderCount.current,
    };
  };

  return { getMetrics, renderCount: renderCount.current };
}

/**
 * Wrapper para medir tempo de execução de funções assíncronas
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    
    if (import.meta.env.DEV) {
      console.debug(`[Perf] ${label}: ${duration.toFixed(2)}ms`);
    }
    
    // Alerta se operação demorar muito
    if (duration > 3000) {
      console.warn(`[Perf] Slow operation: ${label} took ${duration.toFixed(0)}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`[Perf] ${label} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}
