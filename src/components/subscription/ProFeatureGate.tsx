import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles, ArrowRight } from 'lucide-react';

interface ProFeatureGateProps {
  children: React.ReactNode;
  featureName?: string;
  featureDescription?: string;
}

const ProFeatureGate: React.FC<ProFeatureGateProps> = ({
  children,
  featureName = 'Esta funcionalidade',
  featureDescription = 'Faça upgrade para o plano Pro e desbloqueie recursos avançados.',
}) => {
  const { isPro, subscription, openCheckout } = useSubscription();
  const navigate = useNavigate();
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);

  // Se é Pro, mostra o conteúdo normalmente
  if (isPro) {
    return <>{children}</>;
  }

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      await openCheckout('pro');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleViewPlans = () => {
    navigate('/assinatura');
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto p-4 bg-primary/10 rounded-full w-fit">
            <Crown className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" />
              Exclusivo Pro
            </Badge>
            <CardTitle className="text-2xl">{featureName}</CardTitle>
            <CardDescription className="text-base">
              {featureDescription}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Benefícios do Pro */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">O plano Pro inclui:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Assistente IA inteligente
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Sugestões automáticas de precificação
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Análises avançadas de rentabilidade
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Suporte prioritário
              </li>
            </ul>
          </div>

          {/* Preço */}
          <div className="text-center py-2">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold">R$ 59,90</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
            {subscription.status === 'trialing' && (
              <p className="text-xs text-muted-foreground mt-1">
                Upgrade durante o trial e teste grátis por {subscription.trialDaysRemaining} dias
              </p>
            )}
          </div>

          {/* Botões */}
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              className="w-full"
              onClick={handleUpgrade}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? (
                'Processando...'
              ) : (
                <>
                  Fazer Upgrade para Pro
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={handleViewPlans}
            >
              Ver todos os planos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProFeatureGate;
