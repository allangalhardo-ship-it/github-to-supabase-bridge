import React from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Loader2, AlertTriangle } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

const Assinatura = () => {
  const { subscription, loading, openCheckout, openCustomerPortal, hasAccess } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);
  const [portalLoading, setPortalLoading] = React.useState(false);

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      await openCheckout();
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      await openCustomerPortal();
    } finally {
      setPortalLoading(false);
    }
  };

  const features = [
    'Gestão completa de produtos e receitas',
    'Ficha técnica com cálculo automático de custos',
    'Controle de estoque e insumos',
    'Importação de notas fiscais XML',
    'Relatórios de vendas e dashboard',
    'Controle de produção com vencimento',
    'Gestão de clientes',
    'Caixa e movimentações financeiras',
    'Suporte por WhatsApp',
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo size="md" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">
            {hasAccess ? 'Sua Assinatura' : 'Assine o GastroGestor'}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Gerencie seu negócio gastronômico com todas as ferramentas que você precisa
          </p>
        </div>

        {/* Status atual */}
        {subscription.status === 'trialing' && !subscription.subscribed && (
          <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Período de teste gratuito
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Você tem <strong>{subscription.trialDaysRemaining} dias</strong> restantes. 
                    Assine agora para não perder o acesso!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {subscription.status === 'expired' && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    Seu período de teste expirou
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Assine agora para continuar usando o GastroGestor
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plano */}
        <Card className={subscription.subscribed ? 'border-primary' : ''}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Crown className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">GastroGestor Pro</CardTitle>
                  <CardDescription>Plano completo para seu negócio</CardDescription>
                </div>
              </div>
              {subscription.subscribed && (
                <Badge variant="default" className="bg-primary">
                  {subscription.status === 'trialing' ? 'Em teste' : 'Ativo'}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preço */}
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">R$ 39,90</span>
              <span className="text-muted-foreground">/mês</span>
            </div>

            {subscription.subscribed && subscription.status === 'trialing' && subscription.trialEnd && (
              <p className="text-sm text-muted-foreground">
                Teste gratuito até {new Date(subscription.trialEnd).toLocaleDateString('pt-BR')}. 
                Após isso, será cobrado automaticamente.
              </p>
            )}

            {subscription.subscribed && subscription.status === 'active' && subscription.subscriptionEnd && (
              <p className="text-sm text-muted-foreground">
                Próxima cobrança em {new Date(subscription.subscriptionEnd).toLocaleDateString('pt-BR')}
              </p>
            )}

            {/* Features */}
            <div className="grid gap-3">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            {subscription.subscribed ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={handlePortal}
                disabled={portalLoading}
              >
                {portalLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerenciar Assinatura
              </Button>
            ) : (
              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={checkoutLoading}
              >
                {checkoutLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {subscription.status === 'trialing' 
                  ? 'Assinar Agora' 
                  : 'Começar 7 Dias Grátis'}
              </Button>
            )}

            <p className="text-xs text-center text-muted-foreground">
              Cancele a qualquer momento. Sem fidelidade.
            </p>
          </CardFooter>
        </Card>

        {/* FAQ */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-center">Perguntas Frequentes</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Como funciona o período de teste?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Você tem 7 dias para testar todas as funcionalidades gratuitamente. 
                  Após esse período, será necessário assinar para continuar usando.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Posso cancelar a qualquer momento?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Sim! Você pode cancelar sua assinatura quando quiser, sem multas. 
                  O acesso continua até o fim do período pago.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quais formas de pagamento?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Aceitamos cartão de crédito (Visa, Mastercard, Elo, American Express) 
                  e boleto bancário via Stripe.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Meus dados ficam salvos?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Sim! Todos os seus dados ficam salvos na nuvem e você pode acessá-los 
                  de qualquer dispositivo após fazer login.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Assinatura;
