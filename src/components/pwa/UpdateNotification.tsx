import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { RefreshCw, X, Sparkles, Download, History, Wrench, Bug, Shield, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getLatestChanges, changeTypeLabels, getCurrentVersion } from '@/lib/changelog';
import { cn } from '@/lib/utils';

// ============================================================================
// SISTEMA DE NOTIFICAÇÃO DE ATUALIZAÇÕES - ARQUITETURA PROFISSIONAL
// ============================================================================
//
// COMPONENTES:
// 1. UpdateProvider - Context que gerencia estado global
// 2. UpdateBanner - Banner fixo no topo (aparece uma vez por sessão)
// 3. UpdateIndicator - Indicador persistente na sidebar/header
// 4. useServiceWorkerIntegration - Hook que conecta SW com o React
//
// ESTADOS:
// - hasUpdate: boolean - Se há atualização disponível
// - showBanner: boolean - Se deve mostrar o banner (apenas primeira vez)
// - isUpdating: boolean - Se está no processo de atualização
//
// PERSISTÊNCIA:
// - sessionStorage para estado do banner (reseta ao fechar aba)
// - localStorage para preferências do usuário
//
// ============================================================================

// ============= Context =============

interface UpdateContextType {
  hasUpdate: boolean;
  showBanner: boolean;
  isUpdating: boolean;
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
  // Estado de atualização disponível (persiste na sessão)
  const [hasUpdate, setHasUpdate] = useState(() => {
    return sessionStorage.getItem('gg_update_available') === 'true';
  });
  
  // Banner só aparece uma vez por sessão
  const [showBanner, setShowBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    return sessionStorage.getItem('gg_banner_dismissed') === 'true';
  });
  
  // Estado de loading durante atualização
  const [isUpdating, setIsUpdating] = useState(false);

  // Marca que há atualização disponível
  const setUpdateAvailable = useCallback(() => {
    console.log('[Update] Nova versão detectada pelo sistema');
    setHasUpdate(true);
    sessionStorage.setItem('gg_update_available', 'true');
    
    // Mostra banner apenas se não foi dispensado nesta sessão
    if (!bannerDismissed) {
      setShowBanner(true);
    }
  }, [bannerDismissed]);

  // Dispensa o banner (mas mantém o indicador)
  const dismissBanner = useCallback(() => {
    setShowBanner(false);
    setBannerDismissed(true);
    sessionStorage.setItem('gg_banner_dismissed', 'true');
  }, []);

  // Aplica a atualização
  const triggerUpdate = useCallback(() => {
    console.log('[Update] Usuário iniciou atualização');
    setIsUpdating(true);
    
    // Limpa estados
    sessionStorage.removeItem('gg_update_available');
    sessionStorage.removeItem('gg_banner_dismissed');
    
    // Pequeno delay para mostrar o estado de loading
    setTimeout(() => {
      onUpdate();
    }, 300);
  }, [onUpdate]);

  // Verifica ao montar se há atualização pendente
  useEffect(() => {
    if (hasUpdate && !bannerDismissed) {
      setShowBanner(true);
    }
  }, [hasUpdate, bannerDismissed]);

  return (
    <UpdateContext.Provider
      value={{
        hasUpdate,
        showBanner,
        isUpdating,
        dismissBanner,
        triggerUpdate,
        setUpdateAvailable,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
};

// ============= Banner (aparece no topo) =============

export const UpdateBanner = () => {
  const { showBanner, dismissBanner, triggerUpdate, isUpdating } = useUpdateNotification();

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
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
                    Atualize para ter as últimas melhorias.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={triggerUpdate}
                  disabled={isUpdating}
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Atualizar
                    </>
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={dismissBanner}
                  disabled={isUpdating}
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                  title="Lembrar depois"
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

// ============= Indicador para sidebar/header =============

interface UpdateIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

const typeIcons = {
  feature: Sparkles,
  improvement: Wrench,
  fix: Bug,
  security: Shield,
};

export const UpdateIndicator = ({ className = '', showLabel = false }: UpdateIndicatorProps) => {
  const { hasUpdate, triggerUpdate, isUpdating } = useUpdateNotification();
  const [showDialog, setShowDialog] = useState(false);
  const latestChanges = getLatestChanges();

  if (!hasUpdate) return null;

  const handleUpdate = () => {
    setShowDialog(false);
    triggerUpdate();
  };

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className={cn(
          "relative flex items-center gap-2 text-sm font-medium transition-colors",
          "text-emerald-500 hover:text-emerald-400",
          className
        )}
        title="Nova versão disponível - clique para atualizar"
      >
        <span className="relative">
          <RefreshCw className={cn("h-4 w-4", isUpdating && "animate-spin")} />
          {!isUpdating && (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse border-2 border-current" />
          )}
        </span>
        {showLabel && (
          <span className="truncate">
            {isUpdating ? 'Atualizando...' : 'Atualização disponível'}
          </span>
        )}
      </button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Nova versão disponível
            </DialogTitle>
            <DialogDescription>
              Versão {getCurrentVersion()} • {latestChanges?.title}
            </DialogDescription>
          </DialogHeader>
          
          {/* Aviso importante */}
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              A página será recarregada. Se você estiver editando algo, salve antes de atualizar.
            </p>
          </div>
          
          {/* O que há de novo */}
          {latestChanges && (
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <History className="h-4 w-4" />
                O que há de novo:
              </p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {latestChanges.changes.slice(0, 4).map((change, idx) => {
                  const Icon = typeIcons[change.type];
                  const typeInfo = changeTypeLabels[change.type];
                  
                  return (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <Badge 
                        variant="secondary" 
                        className={cn("text-white text-xs shrink-0 px-1.5", typeInfo.color)}
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {typeInfo.label}
                      </Badge>
                      <span className="text-muted-foreground text-xs leading-relaxed">
                        {change.description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={handleUpdate} disabled={isUpdating} className="w-full">
              {isUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Atualizar agora
                </>
              )}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setShowDialog(false)} 
              disabled={isUpdating}
              className="w-full text-muted-foreground"
            >
              Atualizar depois
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// ============= Integração com Service Worker =============

let triggerCallback: (() => void) | null = null;

export const notifyUpdateAvailable = () => {
  if (triggerCallback) {
    triggerCallback();
  } else {
    // Se o callback ainda não foi registrado, agenda para depois
    console.log('[Update] Aguardando Provider para notificar...');
    setTimeout(() => {
      triggerCallback?.();
    }, 1000);
  }
};

export const useServiceWorkerIntegration = () => {
  const { setUpdateAvailable } = useUpdateNotification();

  useEffect(() => {
    triggerCallback = setUpdateAvailable;
    console.log('[Update] Sistema de notificações inicializado');
    
    // Expõe função de teste no console (apenas em dev)
    if (import.meta.env.DEV) {
      (window as any).__testUpdate = () => {
        console.log('🔔 Simulando notificação de atualização...');
        setUpdateAvailable();
      };
      (window as any).__clearUpdate = () => {
        sessionStorage.removeItem('gg_update_available');
        sessionStorage.removeItem('gg_banner_dismissed');
        console.log('🧹 Estados de atualização limpos. Recarregue a página.');
      };
      console.log('💡 Comandos de teste disponíveis:');
      console.log('   __testUpdate()  - Simula nova versão');
      console.log('   __clearUpdate() - Limpa estados');
    }
    
    return () => {
      triggerCallback = null;
      if (import.meta.env.DEV) {
        delete (window as any).__testUpdate;
        delete (window as any).__clearUpdate;
      }
    };
  }, [setUpdateAvailable]);
};

export default UpdateBanner;
