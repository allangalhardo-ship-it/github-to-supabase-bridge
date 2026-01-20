import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/brand/Logo';
import { 
  CheckCircle2, 
  ArrowRight, 
  Calendar, 
  Gift, 
  Sparkles, 
  BookOpen, 
  Package, 
  BarChart3,
  Bot
} from 'lucide-react';

const PagamentoSucesso = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAnnual = searchParams.get('annual') === 'true';

  const nextSteps = [
    {
      icon: Package,
      title: 'Cadastre seus insumos',
      description: 'Comece adicionando os ingredientes que você usa no dia a dia',
      action: () => navigate('/insumos'),
      buttonText: 'Ir para Insumos',
    },
    {
      icon: BookOpen,
      title: 'Crie suas fichas técnicas',
      description: 'Monte as receitas dos seus produtos com os custos calculados automaticamente',
      action: () => navigate('/produtos'),
      buttonText: 'Ir para Produtos',
    },
    {
      icon: BarChart3,
      title: 'Acompanhe seu dashboard',
      description: 'Visualize métricas importantes do seu negócio em tempo real',
      action: () => navigate('/dashboard'),
      buttonText: 'Ir para Dashboard',
    },
  ];

  return (
    <div 
      className="fixed inset-0 overflow-y-auto bg-gradient-to-br from-background to-muted p-4 md:p-8"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo size="md" />
          </div>
        </div>

        {/* Success Card */}
        <Card className="border-green-500/50 bg-gradient-to-br from-green-500/5 to-green-500/10">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                </div>
                <div className="absolute -top-1 -right-1">
                  <Sparkles className="h-6 w-6 text-yellow-500" />
                </div>
              </div>
            </div>
            <CardTitle className="text-2xl md:text-3xl text-green-700 dark:text-green-400">
              Pagamento Confirmado! 🎉
            </CardTitle>
            <CardDescription className="text-base">
              Bem-vindo ao GastroGestor! Sua assinatura está ativa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAnnual && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-4 bg-background/50 rounded-lg">
                <Badge className="bg-green-500 text-white gap-1">
                  <Gift className="h-3 w-3" />
                  Plano Anual
                </Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Acesso válido por 12 meses</span>
                </div>
              </div>
            )}
            
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Você receberá um e-mail de confirmação com os detalhes da sua compra.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pro tip */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-1">Dica Pro</h3>
                <p className="text-sm text-muted-foreground">
                  Use o Assistente IA para cadastrar produtos e insumos por conversa! 
                  Basta descrever o que você quer e ele faz o resto.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-center">Próximos Passos</h2>
          <div className="grid gap-4">
            {nextSteps.map((step, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <step.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{step.title}</h3>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={step.action}
                      className="whitespace-nowrap"
                    >
                      {step.buttonText}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4">
          <Button 
            size="lg" 
            onClick={() => navigate('/dashboard')}
            className="gap-2"
          >
            Ir para o Dashboard
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-sm text-muted-foreground">
            Precisa de ajuda? Entre em contato pelo{' '}
            <a 
              href="https://wa.me/5511999999999" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              WhatsApp
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PagamentoSucesso;
