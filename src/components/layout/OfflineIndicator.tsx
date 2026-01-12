import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getPendingActions } from '@/lib/offlineStorage';
import { cn } from '@/lib/utils';

const OfflineIndicator = () => {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const checkPending = async () => {
      const actions = await getPendingActions();
      setPendingCount(actions.length);
    };

    checkPending();
    
    // Check periodically
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timeout = setTimeout(() => setShowReconnected(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, wasOffline]);

  // Don't show anything if online and no pending actions
  if (isOnline && !showReconnected && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50 transition-all duration-300",
        "rounded-lg shadow-lg px-4 py-3 flex items-center gap-3",
        !isOnline 
          ? "bg-amber-500 text-amber-950" 
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
            <p className="text-xs opacity-80">Os dados serão sincronizados quando voltar</p>
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
          <RefreshCw className="h-5 w-5 flex-shrink-0 animate-spin" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Sincronizando...</p>
            <p className="text-xs opacity-80">{pendingCount} ações pendentes</p>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default OfflineIndicator;
