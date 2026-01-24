import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { RefreshCw, X, Sparkles, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ============= Context para gerenciar estado global de atualização =============

interface UpdateContextType {
  hasUpdate: boolean;
  showBanner: boolean;
  dismissBanner: () => void;
  triggerUpdate: () => void;
  setUpdateAvailable: () => void;
}

const UpdateContext = createContext<UpdateContextType | null>(null);

export const useUpdateNotification = () => {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useUpdateNotification must be used within UpdateProvider');
  }
  return context;
};

// ============= Provider =============

interface UpdateProviderProps {
  children: React.ReactNode;
  onUpdate: () => void;
}

export const UpdateProvider = ({ children, onUpdate }: UpdateProviderProps) => {
  // Persiste o estado de "tem atualização" no sessionStorage
  const [hasUpdate, setHasUpdate] = useState(() => {
    return sessionStorage.getItem('gg_update_available') === 'true';
  });
  
  // Banner só mostra uma vez por sessão (quando detecta atualização pela primeira vez)
  const [showBanner, setShowBanner] = useState(false);
  const [bannerShownThisSession, setBannerShownThisSession] = useState(() => {
    return sessionStorage.getItem('gg_banner_shown') === 'true';
  });

  const setUpdateAvailable = useCallback(() => {
    setHasUpdate(true);
    sessionStorage.setItem('gg_update_available', 'true');
    
    // Mostra banner apenas se ainda não foi mostrado nesta sessão
    if (!bannerShownThisSession) {
      setShowBanner(true);
      setBannerShownThisSession(true);
      sessionStorage.setItem('gg_banner_shown', 'true');
    }
  }, [bannerShownThisSession]);

  const dismissBanner = useCallback(() => {
    setShowBanner(false);
  }, []);

  const triggerUpdate = useCallback(() => {
    // Limpa estados antes de atualizar
    sessionStorage.removeItem('gg_update_available');
    sessionStorage.removeItem('gg_banner_shown');
    setHasUpdate(false);
    setShowBanner(false);
    onUpdate();
  }, [onUpdate]);

  return (
    <UpdateContext.Provider
      value={{
        hasUpdate,
        showBanner,
        dismissBanner,
        triggerUpdate,
        setUpdateAvailable,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
};

// ============= Banner de notificação (aparece no topo) =============

export const UpdateBanner = () => {
  const { showBanner, dismissBanner, triggerUpdate } = useUpdateNotification();

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg"
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 p-2 bg-primary-foreground/20 rounded-full animate-pulse">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm sm:text-base">Nova versão disponível! 🎉</p>
                  <p className="text-xs sm:text-sm opacity-90 truncate">
                    Atualize quando quiser para ter as últimas melhorias.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={triggerUpdate}
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Atualizar agora
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={dismissBanner}
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                  title="Atualizar depois"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============= Indicador pequeno para o menu/sidebar =============

interface UpdateIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export const UpdateIndicator = ({ className = '', showLabel = false }: UpdateIndicatorProps) => {
  const { hasUpdate, triggerUpdate } = useUpdateNotification();
  const [showDialog, setShowDialog] = useState(false);

  if (!hasUpdate) return null;

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className={`relative flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors ${className}`}
        title="Nova versão disponível"
      >
        <span className="relative">
          <RefreshCw className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full animate-pulse" />
        </span>
        {showLabel && <span>Atualização disponível</span>}
      </button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Nova versão disponível
            </DialogTitle>
            <DialogDescription>
              Uma nova versão do aplicativo está disponível com melhorias e correções.
              Ao atualizar, a página será recarregada e você terá acesso às últimas funcionalidades.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={triggerUpdate} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Atualizar agora
            </Button>
            <Button variant="outline" onClick={() => setShowDialog(false)} className="w-full">
              Atualizar depois
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ============= Hook para integração com Service Worker =============

let triggerCallback: (() => void) | null = null;

export const setUpdateTrigger = (callback: () => void) => {
  triggerCallback = callback;
};

export const notifyUpdateAvailable = () => {
  triggerCallback?.();
};

export const useServiceWorkerIntegration = () => {
  const { setUpdateAvailable } = useUpdateNotification();

  useEffect(() => {
    triggerCallback = setUpdateAvailable;
    
    // Expõe função de teste no console (apenas em dev)
    if (import.meta.env.DEV) {
      (window as any).__testUpdateNotification = () => {
        console.log('🔔 Simulando notificação de atualização...');
        setUpdateAvailable();
      };
      console.log('💡 Para testar o sistema de atualização, execute no console: __testUpdateNotification()');
    }
    
    return () => {
      triggerCallback = null;
      if (import.meta.env.DEV) {
        delete (window as any).__testUpdateNotification;
      }
    };
  }, [setUpdateAvailable]);
};

export default UpdateBanner;
