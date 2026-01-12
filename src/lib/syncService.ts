import { supabase } from '@/integrations/supabase/client';
import { getPendingActions, clearPendingAction } from './offlineStorage';
import { toast } from 'sonner';

interface PendingAction {
  id: number;
  type: 'insert' | 'update' | 'delete';
  table: string;
  data: Record<string, unknown>;
  createdAt: number;
}

let isSyncing = false;

export async function syncPendingActions(): Promise<{ success: number; failed: number }> {
  if (isSyncing) {
    console.log('Sync already in progress');
    return { success: 0, failed: 0 };
  }

  if (!navigator.onLine) {
    console.log('Cannot sync - offline');
    return { success: 0, failed: 0 };
  }

  isSyncing = true;
  let success = 0;
  let failed = 0;

  try {
    const actions = await getPendingActions() as PendingAction[];
    
    if (actions.length === 0) {
      return { success: 0, failed: 0 };
    }

    console.log(`Starting sync of ${actions.length} pending actions`);

    // Sort by creation time to maintain order
    actions.sort((a, b) => a.createdAt - b.createdAt);

    for (const action of actions) {
      try {
        const result = await executeAction(action);
        
        if (result.success) {
          await clearPendingAction(action.id);
          success++;
        } else {
          console.error(`Failed to sync action ${action.id}:`, result.error);
          failed++;
        }
      } catch (error) {
        console.error(`Error syncing action ${action.id}:`, error);
        failed++;
      }
    }

    if (success > 0) {
      toast.success(`${success} ${success === 1 ? 'ação sincronizada' : 'ações sincronizadas'} com sucesso!`);
    }

    if (failed > 0) {
      toast.error(`${failed} ${failed === 1 ? 'ação falhou' : 'ações falharam'} ao sincronizar`);
    }

    return { success, failed };
  } finally {
    isSyncing = false;
  }
}

async function executeAction(action: PendingAction): Promise<{ success: boolean; error?: string }> {
  const { type, table, data } = action;

  // Validate table name to prevent injection
  const allowedTables = [
    'vendas', 'produtos', 'insumos', 'clientes', 'custos_fixos',
    'producoes', 'fichas_tecnicas', 'estoque_movimentos', 'caixa_movimentos',
    'configuracoes', 'receitas_intermediarias'
  ];

  if (!allowedTables.includes(table)) {
    return { success: false, error: `Invalid table: ${table}` };
  }

  try {
    switch (type) {
      case 'insert': {
        const { error } = await supabase.from(table as any).insert(data as any);
        if (error) return { success: false, error: error.message };
        break;
      }

      case 'update': {
        const { id, ...updateData } = data;
        if (!id) return { success: false, error: 'Missing id for update' };
        const { error } = await supabase.from(table as any).update(updateData as any).eq('id', id);
        if (error) return { success: false, error: error.message };
        break;
      }

      case 'delete': {
        const { id } = data;
        if (!id) return { success: false, error: 'Missing id for delete' };
        const { error } = await supabase.from(table as any).delete().eq('id', id);
        if (error) return { success: false, error: error.message };
        break;
      }

      default:
        return { success: false, error: `Unknown action type: ${type}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Initialize sync listener
export function initSyncListener(): () => void {
  const handleOnline = () => {
    console.log('Connection restored - starting sync');
    // Small delay to ensure connection is stable
    setTimeout(() => {
      syncPendingActions();
    }, 2000);
  };

  const handleBackOnline = () => {
    syncPendingActions();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('app-back-online', handleBackOnline);

  // Also sync on app focus (user returns to app)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      syncPendingActions();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Initial sync check on load
  if (navigator.onLine) {
    syncPendingActions();
  }

  // Cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('app-back-online', handleBackOnline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
