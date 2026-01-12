import React, { useState } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface NotificationSettingsProps {
  className?: string;
}

const NotificationSettings = ({ className }: NotificationSettingsProps) => {
  const { isSupported, permission, requestPermission, isEnabled } = useNotifications();
  const [isRequesting, setIsRequesting] = useState(false);
  const [lowStockEnabled, setLowStockEnabled] = useState(true);
  const [expirationEnabled, setExpirationEnabled] = useState(true);

  const handleEnableNotifications = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestPermission();
      if (granted) {
        toast.success('Notificações ativadas com sucesso!');
      } else {
        toast.error('Permissão negada. Ative nas configurações do navegador.');
      }
    } finally {
      setIsRequesting(false);
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          title="Configurar notificações"
        >
          {isEnabled ? (
            <Bell className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações
          </DialogTitle>
          <DialogDescription>
            Configure alertas para estoque baixo e vencimentos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Permission Status */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="space-y-1">
              <p className="font-medium text-sm">Status das Notificações</p>
              <p className="text-xs text-muted-foreground">
                {isEnabled ? 'Ativas' : permission === 'denied' ? 'Bloqueadas' : 'Desativadas'}
              </p>
            </div>
            {isEnabled ? (
              <div className="flex items-center gap-2 text-emerald-600">
                <Check className="h-5 w-5" />
                <span className="text-sm font-medium">Ativo</span>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={handleEnableNotifications}
                disabled={isRequesting || permission === 'denied'}
              >
                {isRequesting ? 'Ativando...' : 'Ativar'}
              </Button>
            )}
          </div>

          {permission === 'denied' && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <p className="font-medium">Notificações bloqueadas</p>
              <p className="text-xs mt-1">
                Para ativar, clique no ícone de cadeado na barra de endereço e permita notificações.
              </p>
            </div>
          )}

          {/* Notification Types */}
          {isEnabled && (
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Tipos de Alertas</h4>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="low-stock" className="flex flex-col gap-1 cursor-pointer">
                  <span>Estoque Baixo</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Alerta quando insumos atingem estoque mínimo
                  </span>
                </Label>
                <Switch
                  id="low-stock"
                  checked={lowStockEnabled}
                  onCheckedChange={setLowStockEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="expiration" className="flex flex-col gap-1 cursor-pointer">
                  <span>Vencimentos</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Alerta quando produtos estão próximos do vencimento
                  </span>
                </Label>
                <Switch
                  id="expiration"
                  checked={expirationEnabled}
                  onCheckedChange={setExpirationEnabled}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettings;
