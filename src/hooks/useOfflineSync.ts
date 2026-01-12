import { useEffect } from 'react';
import { initSyncListener, syncPendingActions } from '@/lib/syncService';

export function useOfflineSync() {
  useEffect(() => {
    const cleanup = initSyncListener();
    return cleanup;
  }, []);

  return { syncNow: syncPendingActions };
}
