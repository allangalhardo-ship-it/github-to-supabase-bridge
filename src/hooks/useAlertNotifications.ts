import { useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from './useNotifications';
import { differenceInDays, parseISO } from 'date-fns';

interface AlertConfig {
  checkIntervalMinutes: number;
  lowStockEnabled: boolean;
  expirationEnabled: boolean;
}

const DEFAULT_CONFIG: AlertConfig = {
  checkIntervalMinutes: 30,
  lowStockEnabled: true,
  expirationEnabled: true,
};

// Track shown notifications to avoid duplicates
const shownNotifications = new Set<string>();

export function useAlertNotifications(config: Partial<AlertConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { usuario } = useAuth();
  const { showNotification, isEnabled, requestPermission } = useNotifications();
  const lastCheckRef = useRef<Date | null>(null);

  // Query for low stock insumos
  const { data: lowStockInsumos } = useQuery({
    queryKey: ['low-stock-insumos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('id, nome, estoque_atual, estoque_minimo');
      
      if (error) throw error;
      return (data || []).filter(i => i.estoque_atual <= i.estoque_minimo && i.estoque_minimo > 0);
    },
    enabled: !!usuario && finalConfig.lowStockEnabled,
    refetchInterval: finalConfig.checkIntervalMinutes * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  // Query for expiring productions
  const { data: expiringProductions } = useQuery({
    queryKey: ['expiring-productions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('producoes')
        .select(`
          id,
          quantidade,
          data_vencimento,
          dias_alerta_vencimento,
          produto:produtos(nome)
        `)
        .not('data_vencimento', 'is', null)
        .gte('quantidade', 0);
      
      if (error) throw error;
      
      const today = new Date();
      return (data || []).filter(p => {
        if (!p.data_vencimento) return false;
        const daysUntilExpiry = differenceInDays(parseISO(p.data_vencimento), today);
        const alertDays = p.dias_alerta_vencimento || 3;
        return daysUntilExpiry <= alertDays && daysUntilExpiry >= 0;
      });
    },
    enabled: !!usuario && finalConfig.expirationEnabled,
    refetchInterval: finalConfig.checkIntervalMinutes * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const checkAndNotify = useCallback(() => {
    if (!isEnabled) return;

    const now = new Date();
    
    // Avoid checking too frequently
    if (lastCheckRef.current && (now.getTime() - lastCheckRef.current.getTime()) < 60000) {
      return;
    }
    lastCheckRef.current = now;

    // Low stock notifications
    if (finalConfig.lowStockEnabled && lowStockInsumos && lowStockInsumos.length > 0) {
      const notificationKey = `low-stock-${now.toDateString()}`;
      
      if (!shownNotifications.has(notificationKey)) {
        const count = lowStockInsumos.length;
        const names = lowStockInsumos.slice(0, 3).map(i => i.nome).join(', ');
        const more = count > 3 ? ` e mais ${count - 3}...` : '';
        
        showNotification('⚠️ Estoque Baixo', {
          body: `${count} ${count === 1 ? 'insumo está' : 'insumos estão'} com estoque baixo: ${names}${more}`,
          tag: 'low-stock',
        });
        
        shownNotifications.add(notificationKey);
      }
    }

    // Expiration notifications
    if (finalConfig.expirationEnabled && expiringProductions && expiringProductions.length > 0) {
      const notificationKey = `expiring-${now.toDateString()}`;
      
      if (!shownNotifications.has(notificationKey)) {
        const count = expiringProductions.length;
        const names = expiringProductions
          .slice(0, 3)
          .map(p => (p.produto as any)?.nome || 'Produto')
          .join(', ');
        const more = count > 3 ? ` e mais ${count - 3}...` : '';
        
        showNotification('📅 Produtos Vencendo', {
          body: `${count} ${count === 1 ? 'produto está' : 'produtos estão'} próximos do vencimento: ${names}${more}`,
          tag: 'expiring',
        });
        
        shownNotifications.add(notificationKey);
      }
    }
  }, [isEnabled, lowStockInsumos, expiringProductions, showNotification, finalConfig]);

  // Check on data change
  useEffect(() => {
    checkAndNotify();
  }, [checkAndNotify]);

  return {
    lowStockCount: lowStockInsumos?.length || 0,
    expiringCount: expiringProductions?.length || 0,
    requestPermission,
    isEnabled,
  };
}
