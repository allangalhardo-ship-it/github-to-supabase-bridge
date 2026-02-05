import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, QrCode, Copy, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PlanType } from '@/contexts/SubscriptionContext';

interface AsaasPixCheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanType;
  billingCycle: 'monthly' | 'annual';
}

interface PixData {
  pixQrCode: string;
  pixCopyPaste: string;
  value: number;
  subscriptionId: string;
}

export const AsaasPixCheckout: React.FC<AsaasPixCheckoutProps> = ({
  open,
  onOpenChange,
  plan,
  billingCycle,
}) => {
  const [step, setStep] = useState<'form' | 'pix'>('form');
  const [loading, setLoading] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [name, setName] = useState('');
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);

  const formatCpfCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      return numbers
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanCpfCnpj = cpfCnpj.replace(/\D/g, '');
    if (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14) {
      toast.error('CPF ou CNPJ inválido');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-create-subscription', {
        body: {
          plan,
          billingCycle: billingCycle === 'annual' ? 'YEARLY' : 'MONTHLY',
          cpfCnpj: cleanCpfCnpj,
          name: name || undefined,
        },
      });

      if (error) throw error;

      if (data.pixQrCode && data.pixCopyPaste) {
        setPixData({
          pixQrCode: data.pixQrCode,
          pixCopyPaste: data.pixCopyPaste,
          value: data.value,
          subscriptionId: data.subscriptionId,
        });
        setStep('pix');
        toast.success('QR Code gerado! Escaneie para pagar.');
      } else {
        throw new Error('Não foi possível gerar o QR Code do Pix');
      }
    } catch (err) {
      console.error('Error creating Asaas subscription:', err);
      toast.error('Erro ao gerar pagamento Pix. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (pixData?.pixCopyPaste) {
      navigator.clipboard.writeText(pixData.pixCopyPaste);
      setCopied(true);
      toast.success('Código Pix copiado!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleClose = () => {
    setStep('form');
    setPixData(null);
    setCpfCnpj('');
    setName('');
    onOpenChange(false);
  };

  const planName = plan === 'pro' ? 'Pro' : 'Standard';
  const cycleName = billingCycle === 'annual' ? 'Anual' : 'Mensal';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Pagamento via Pix
          </DialogTitle>
          <DialogDescription>
            GastroGestor {planName} - {cycleName}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                placeholder="Seu nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpfCnpj">CPF ou CNPJ *</Label>
              <Input
                id="cpfCnpj"
                placeholder="000.000.000-00"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                maxLength={18}
                required
              />
              <p className="text-xs text-muted-foreground">
                Obrigatório para pagamentos via Pix
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Após gerar o QR Code, você terá 30 minutos para efetuar o pagamento.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando QR Code...
                </>
              ) : (
                <>
                  <QrCode className="mr-2 h-4 w-4" />
                  Gerar QR Code Pix
                </>
              )}
            </Button>
          </form>
        )}

        {step === 'pix' && pixData && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                R$ {pixData.value.toFixed(2).replace('.', ',')}
              </p>
              <p className="text-sm text-muted-foreground">
                {billingCycle === 'annual' ? 'Pagamento único anual' : 'Primeira mensalidade'}
              </p>
            </div>

            <div className="flex justify-center p-4 bg-white rounded-lg">
              <img
                src={`data:image/png;base64,${pixData.pixQrCode}`}
                alt="QR Code Pix"
                className="w-48 h-48"
              />
            </div>

            <div className="space-y-2">
              <Label>Pix Copia e Cola</Label>
              <div className="flex gap-2">
                <Input
                  value={pixData.pixCopyPaste}
                  readOnly
                  className="text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyPix}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
              <p className="text-xs text-green-700 dark:text-green-400">
                Após o pagamento, sua assinatura será ativada automaticamente em alguns minutos.
              </p>
            </div>

            <Button variant="outline" onClick={handleClose} className="w-full">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
