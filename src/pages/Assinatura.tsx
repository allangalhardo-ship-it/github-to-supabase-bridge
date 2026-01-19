import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription, PlanType } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Loader2, AlertTriangle, ArrowRight, Sparkles, Bot } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

const plans = [
  {
    id: 'standard' as PlanType,
    name: 'Standard',
    price: 'R$ 39,90',
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
    price: 'R$ 59,90',
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
  const [portalLoading, setPortalLoading] = React.useState(false);

  const handleCheckout = async (plan: PlanType) => {
    setCheckoutLoading(plan);
    try {
      await openCheckout(plan);
    } finally {
      setCheckoutLoading(null);
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

        {/* Planos */}
        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => {
            const isCurrentPlan = subscription.subscribed && subscription.plan === plan.id;
            const isUpgrade = subscription.subscribed && subscription.plan === 'standard' && plan.id === 'pro';
            
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
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>

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
                      onClick={() => handleCheckout(plan.id)}
                      disabled={checkoutLoading === plan.id}
                    >
                      {checkoutLoading === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Fazer Upgrade para Pro
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      size="lg"
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handleCheckout(plan.id)}
                      disabled={checkoutLoading === plan.id}
                    >
                      {checkoutLoading === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {subscription.status === 'trialing' && !subscription.subscribed
                        ? 'Assinar Agora' 
                        : 'Começar 7 Dias Grátis'}
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
                <CardTitle className="text-base">Posso mudar de plano depois?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Sim! Você pode fazer upgrade para o Pro a qualquer momento. 
                  A diferença será cobrada proporcionalmente.
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
