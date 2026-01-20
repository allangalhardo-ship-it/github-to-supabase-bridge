import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription, PlanType } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Loader2, AlertTriangle, ArrowRight, Sparkles, Bot, CreditCard, QrCode } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const plans = [
  {
    id: 'standard' as PlanType,
    name: 'Standard',
    priceMonthly: 'R$ 39,90',
    priceAnnual: 'R$ 399,00',
    priceAnnualMonthly: 'R$ 33,25',
    savingsAnnual: 'Economia de R$ 79,80',
    description: 'Tudo que você precisa para gerenciar seu negócio',
    features: [
      'Gestão completa de produtos e receitas',
      'Ficha técnica com cálculo automático de custos',
      'Controle de estoque e insumos',
      'Importação de notas fiscais XML',
      'Relatórios de vendas e dashboard',
      'Controle de produção com vencimento',
      'Gestão de clientes',
      'Caixa e movimentações financeiras',
      'Suporte por WhatsApp',
    ],
    popular: false,
  },
  {
    id: 'pro' as PlanType,
    name: 'Pro',
    priceMonthly: 'R$ 59,90',
    priceAnnual: 'R$ 599,00',
    priceAnnualMonthly: 'R$ 49,92',
    savingsAnnual: 'Economia de R$ 119,80',
    description: 'Para quem quer inteligência artificial no dia a dia',
    features: [
      'Tudo do plano Standard',
      'Assistente IA inteligente',
      'Cadastro por conversa (fale e o sistema faz)',
      'Análises automáticas de rentabilidade',
      'Sugestões de precificação por IA',
      'Suporte prioritário',
    ],
    popular: true,
    proFeatures: [
      { icon: Bot, text: 'Assistente IA' },
      { icon: Sparkles, text: 'Automação inteligente' },
    ],
  },
];

const Assinatura = () => {
  const navigate = useNavigate();
  const { subscription, loading, openCheckout, openCustomerPortal, hasAccess } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = React.useState<PlanType | null>(null);
  const [annualLoading, setAnnualLoading] = React.useState<PlanType | null>(null);
  const [portalLoading, setPortalLoading] = React.useState(false);
  const [billingPeriod, setBillingPeriod] = React.useState<'monthly' | 'annual'>('monthly');

  const handleCheckout = async (plan: PlanType) => {
    setCheckoutLoading(plan);
    try {
      await openCheckout(plan);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleAnnualCheckout = async (plan: PlanType) => {
    setAnnualLoading(plan);
    try {
      const { data, error } = await supabase.functions.invoke('create-annual-payment', {
        body: { plan },
      });
      
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Annual checkout error:', err);
      toast.error('Erro ao iniciar pagamento anual');
    } finally {
      setAnnualLoading(null);
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

  const getCurrentPlanLabel = () => {
    if (!subscription.subscribed && subscription.status !== 'trialing') return null;
    if (subscription.plan === 'pro') return 'Pro';
    if (subscription.plan === 'standard') return 'Standard';
    return null;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-background to-muted p-4 md:p-8"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo size="md" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">
            {hasAccess ? 'Sua Assinatura' : 'Assine o GastroGestor'}
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Escolha o plano ideal para o seu negócio gastronômico
          </p>
        </div>

        {/* Status atual */}
        {subscription.status === 'trialing' && subscription.trialDaysRemaining > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-primary">
                      {subscription.subscribed ? `Assinatura ${subscription.plan === 'pro' ? 'Pro' : 'Standard'} confirmada (em teste)` : 'Período de teste gratuito'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {subscription.subscribed && subscription.trialEnd ? (
                        <>
                          Seu teste vai até{' '}
                          <strong className="text-primary">
                            {new Date(subscription.trialEnd).toLocaleDateString('pt-BR')}
                          </strong>
                          . Você já tem acesso ao sistema.
                        </>
                      ) : (
                        <>
                          Você tem{' '}
                          <strong className="text-primary">{subscription.trialDaysRemaining} dias</strong>{' '}
                          restantes para testar gratuitamente!
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="whitespace-nowrap"
                >
                  Ir para o sistema
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
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

        {/* Billing Period Toggle */}
        <div className="flex justify-center">
          <Tabs value={billingPeriod} onValueChange={(v) => setBillingPeriod(v as 'monthly' | 'annual')} className="w-auto">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Mensal
              </TabsTrigger>
              <TabsTrigger value="annual" className="gap-2">
                <QrCode className="h-4 w-4" />
                Anual (Pix)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {billingPeriod === 'annual' && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-400">
                <QrCode className="h-5 w-5" />
                <span className="font-medium">
                  Pague com Pix, Boleto ou Cartão e economize 2 meses!
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Planos */}
        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => {
            const isCurrentPlan = subscription.subscribed && subscription.plan === plan.id;
            const isUpgrade = subscription.subscribed && subscription.plan === 'standard' && plan.id === 'pro';
            const isAnnual = billingPeriod === 'annual';
            
            return (
              <Card 
                key={plan.id} 
                className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''} ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Mais popular
                    </Badge>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      Seu plano
                    </Badge>
                  </div>
                )}
                {isAnnual && (
                  <div className="absolute -top-3 left-4">
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      {plan.savingsAnnual}
                    </Badge>
                  </div>
                )}
                <CardHeader className="pt-8">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${plan.popular ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Crown className={`h-6 w-6 ${plan.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">GastroGestor {plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Preço */}
                  {isAnnual ? (
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold">{plan.priceAnnual}</span>
                        <span className="text-muted-foreground">/ano</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground line-through">{plan.priceMonthly}/mês</span>
                        <span className="text-sm text-green-600 font-medium">{plan.priceAnnualMonthly}/mês</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">{plan.priceMonthly}</span>
                      <span className="text-muted-foreground">/mês</span>
                    </div>
                  )}

                  {/* Pro features highlight */}
                  {plan.proFeatures && (
                    <div className="flex flex-wrap gap-2">
                      {plan.proFeatures.map((f, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
                          <f.icon className="h-3 w-3" />
                          {f.text}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Features */}
                  <div className="grid gap-3">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${plan.popular ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Check className={`h-3 w-3 ${plan.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  {isCurrentPlan ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handlePortal}
                      disabled={portalLoading}
                    >
                      {portalLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Gerenciar Assinatura
                    </Button>
                  ) : isUpgrade ? (
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => isAnnual ? handleAnnualCheckout(plan.id) : handleCheckout(plan.id)}
                      disabled={isAnnual ? annualLoading === plan.id : checkoutLoading === plan.id}
                    >
                      {(isAnnual ? annualLoading === plan.id : checkoutLoading === plan.id) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {isAnnual ? (
                        <>
                          <QrCode className="mr-2 h-4 w-4" />
                          Upgrade Anual com Pix
                        </>
                      ) : 'Fazer Upgrade para Pro'}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      size="lg"
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => isAnnual ? handleAnnualCheckout(plan.id) : handleCheckout(plan.id)}
                      disabled={isAnnual ? annualLoading === plan.id : checkoutLoading === plan.id}
                    >
                      {(isAnnual ? annualLoading === plan.id : checkoutLoading === plan.id) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {isAnnual ? (
                        <>
                          <QrCode className="mr-2 h-4 w-4" />
                          Pagar {plan.priceAnnual} (Pix)
                        </>
                      ) : (
                        subscription.status === 'trialing' && !subscription.subscribed
                          ? 'Assinar Agora' 
                          : 'Começar 7 Dias Grátis'
                      )}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

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
                <CardTitle className="text-base">Qual a vantagem do plano anual?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  No plano anual você paga 10 meses e ganha 12 meses de acesso! 
                  Além disso, pode pagar com Pix, que tem taxa menor.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Qual a diferença entre Standard e Pro?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  O plano Pro inclui o Assistente IA, que permite cadastrar produtos e insumos 
                  por conversa, receber análises automáticas e muito mais.
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Assinatura;
