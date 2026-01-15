import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface UpdateBannerProps {
  onUpdate: () => void;
}

export const UpdateBanner = ({ onUpdate }: UpdateBannerProps) => {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground shadow-lg"
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 p-2 bg-primary-foreground/20 rounded-full">
                <RefreshCw className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm sm:text-base">Nova versão disponível!</p>
                <p className="text-xs sm:text-sm opacity-90 truncate">Atualize para ter as últimas melhorias.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="secondary"
                onClick={onUpdate}
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setVisible(false)}
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// Hook para gerenciar estado global de atualização
let updateCallback: (() => void) | null = null;
let showBannerCallback: (() => void) | null = null;

export const setUpdateCallback = (callback: () => void) => {
  updateCallback = callback;
};

export const triggerUpdateBanner = () => {
  showBannerCallback?.();
};

export const useUpdateBanner = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    showBannerCallback = () => setShowBanner(true);
    return () => {
      showBannerCallback = null;
    };
  }, []);

  const handleUpdate = () => {
    if (updateCallback) {
      updateCallback();
    }
    setShowBanner(false);
  };

  return { showBanner, handleUpdate };
};

export default UpdateBanner;
