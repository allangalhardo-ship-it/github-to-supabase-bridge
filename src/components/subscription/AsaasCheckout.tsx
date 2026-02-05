import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, QrCode, Copy, Check, AlertCircle, CreditCard, FileText, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PlanType } from '@/contexts/SubscriptionContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface AsaasCheckoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanType;
  billingCycle: 'monthly' | 'annual';
}

interface PaymentData {
  pixQrCode?: string;
  pixCopyPaste?: string;
  boletoUrl?: string;
  checkoutUrl?: string;
  invoiceUrl?: string;
  value: number;
  subscriptionId: string;
  paymentMethod: string;
}

export const AsaasCheckout: React.FC<AsaasCheckoutProps> = ({
  open,
  onOpenChange,
  plan,
  billingCycle,
}) => {
  const [step, setStep] = useState<'form' | 'payment'>('form');
  const [loading, setLoading] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [name, setName] = useState('');
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [copied, setCopied] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'PIX' | 'BOLETO' | 'CREDIT_CARD'>('PIX');

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
          paymentMethod,
        },
      });

      if (error) throw error;

      setPaymentData({
        pixQrCode: data.pixQrCode,
        pixCopyPaste: data.pixCopyPaste,
        boletoUrl: data.boletoUrl,
        checkoutUrl: data.checkoutUrl,
        invoiceUrl: data.invoiceUrl,
        value: data.value,
        subscriptionId: data.subscriptionId,
        paymentMethod: data.paymentMethod,
      });
      
      if (paymentMethod === 'CREDIT_CARD' && (data.checkoutUrl || data.invoiceUrl)) {
        // Para cartão, redireciona direto para o checkout do Asaas
        window.open(data.checkoutUrl || data.invoiceUrl, '_blank');
        toast.success('Redirecionando para o checkout...');
      } else {
        setStep('payment');
        if (paymentMethod === 'PIX') {
          toast.success('QR Code gerado! Escaneie para pagar.');
        } else {
          toast.success('Boleto gerado com sucesso!');
        }
      }
    } catch (err) {
      console.error('Error creating Asaas subscription:', err);
      toast.error('Erro ao gerar pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (paymentData?.pixCopyPaste) {
      navigator.clipboard.writeText(paymentData.pixCopyPaste);
      setCopied(true);
      toast.success('Código Pix copiado!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleOpenBoleto = () => {
    if (paymentData?.boletoUrl || paymentData?.invoiceUrl) {
      window.open(paymentData.boletoUrl || paymentData.invoiceUrl, '_blank');
    }
  };

  const handleClose = () => {
    setStep('form');
    setPaymentData(null);
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
            {paymentMethod === 'PIX' ? (
              <QrCode className="h-5 w-5 text-primary" />
            ) : (
              <FileText className="h-5 w-5 text-primary" />
            )}
            Pagamento - GastroGestor {planName}
          </DialogTitle>
          <DialogDescription>
            Plano {cycleName}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'PIX' | 'BOLETO' | 'CREDIT_CARD')}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="PIX" className="gap-2">
                  <QrCode className="h-4 w-4" />
                  Pix
                </TabsTrigger>
                <TabsTrigger value="CREDIT_CARD" className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  Cartão
                </TabsTrigger>
                <TabsTrigger value="BOLETO" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Boleto
                </TabsTrigger>
              </TabsList>
            </Tabs>

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
                Obrigatório para pagamentos via {paymentMethod === 'PIX' ? 'Pix' : 'Boleto'}
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                {paymentMethod === 'PIX' 
                  ? 'Após gerar o QR Code, você terá 30 minutos para efetuar o pagamento.'
                  : paymentMethod === 'CREDIT_CARD'
                  ? 'O pagamento será processado imediatamente após a confirmação.'
                  : 'O boleto tem vencimento em 3 dias úteis.'
                }
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : paymentMethod === 'PIX' ? (
                <>
                  <QrCode className="mr-2 h-4 w-4" />
                  Gerar QR Code Pix
                </>
              ) : paymentMethod === 'CREDIT_CARD' ? (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pagar com Cartão
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Gerar Boleto
                </>
              )}
            </Button>
          </form>
        )}

        {step === 'payment' && paymentData && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">
                R$ {paymentData.value.toFixed(2).replace('.', ',')}
              </p>
              <p className="text-sm text-muted-foreground">
                {billingCycle === 'annual' ? 'Pagamento único anual' : 'Primeira mensalidade'}
              </p>
            </div>

            {paymentData.paymentMethod === 'PIX' && paymentData.pixQrCode && (
              <>
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img
                    src={`data:image/png;base64,${paymentData.pixQrCode}`}
                    alt="QR Code Pix"
                    className="w-48 h-48"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Pix Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input
                      value={paymentData.pixCopyPaste || ''}
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
              </>
            )}

            {paymentData.paymentMethod === 'BOLETO' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center p-8 bg-muted rounded-lg">
                  <FileText className="h-16 w-16 text-muted-foreground" />
                </div>
                
                <Button onClick={handleOpenBoleto} className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  Abrir Boleto
                </Button>
              </div>
            )}

            {paymentData.paymentMethod === 'CREDIT_CARD' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center p-8 bg-muted rounded-lg">
                  <CreditCard className="h-16 w-16 text-muted-foreground" />
                </div>
                
                <p className="text-sm text-center text-muted-foreground">
                  Uma nova janela foi aberta para você completar o pagamento com cartão.
                </p>
                
                <Button 
                  onClick={() => window.open(paymentData.checkoutUrl || paymentData.invoiceUrl, '_blank')} 
                  className="w-full"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Abrir Checkout Novamente
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-xs text-green-700 dark:text-green-300">
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

// Mantém o componente antigo para compatibilidade
export const AsaasPixCheckout = AsaasCheckout;
