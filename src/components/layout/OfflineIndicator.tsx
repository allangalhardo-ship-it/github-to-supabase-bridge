import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw, Check } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getPendingActions } from '@/lib/offlineStorage';
import { syncPendingActions } from '@/lib/syncService';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const OfflineIndicator = () => {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [showReconnected, setShowReconnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);

  useEffect(() => {
    const checkPending = async () => {
      const actions = await getPendingActions();
      setPendingCount(actions.length);
    };

    checkPending();
    
    // Check periodically
    const interval = setInterval(checkPending, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timeout = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, wasOffline]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncPendingActions();
      const actions = await getPendingActions();
      setPendingCount(actions.length);
      if (actions.length === 0) {
        setSyncComplete(true);
        setTimeout(() => setSyncComplete(false), 2000);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Don't show anything if online, no pending actions, and not showing status
  if (isOnline && !showReconnected && pendingCount === 0 && !syncComplete) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50 transition-all duration-300",
        "rounded-lg shadow-lg px-4 py-3 flex items-center gap-3",
        !isOnline 
          ? "bg-amber-500 text-amber-950" 
          : syncComplete
            ? "bg-emerald-500 text-emerald-950"
            : showReconnected 
              ? "bg-emerald-500 text-emerald-950"
              : "bg-blue-500 text-blue-950"
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Você está offline</p>
            <p className="text-xs opacity-80">
              {pendingCount > 0 
                ? `${pendingCount} ações serão sincronizadas quando voltar` 
                : 'Os dados em cache estão disponíveis'}
            </p>
          </div>
        </>
      ) : syncComplete ? (
        <>
          <Check className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Tudo sincronizado!</p>
          </div>
        </>
      ) : showReconnected ? (
        <>
          <Wifi className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Conexão restaurada!</p>
            {pendingCount > 0 && (
              <p className="text-xs opacity-80">Sincronizando {pendingCount} ações...</p>
            )}
          </div>
        </>
      ) : pendingCount > 0 ? (
        <>
          {isSyncing ? (
            <RefreshCw className="h-5 w-5 flex-shrink-0 animate-spin" />
          ) : (
            <RefreshCw className="h-5 w-5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">
              {isSyncing ? 'Sincronizando...' : `${pendingCount} ações pendentes`}
            </p>
          </div>
          {!isSyncing && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleManualSync}
              className="h-7 px-2 text-xs bg-white/20 hover:bg-white/30"
            >
              Sincronizar
            </Button>
          )}
        </>
      ) : null}
    </div>
  );
};

export default OfflineIndicator;
