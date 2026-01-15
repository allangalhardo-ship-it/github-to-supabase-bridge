import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Crown, CreditCard, Building2, Mail, Phone, FileText, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const MeusDados = () => {
  const { usuario, user } = useAuth();
  const { subscription, openCustomerPortal } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [portalLoading, setPortalLoading] = useState(false);
  const [forceUpdateLoading, setForceUpdateLoading] = useState(false);

  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      await openCustomerPortal();
    } finally {
      setPortalLoading(false);
    }
  };

  const handleForceUpdate = async () => {
    setForceUpdateLoading(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
      }

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }

      sessionStorage.removeItem('gg_sw_reloaded');

      toast({
        title: 'Atualização forçada',
        description: 'Limpamos cache e reiniciaremos o app agora…',
      });

      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('_refresh', Date.now().toString());
        window.location.replace(url.toString());
      }, 400);

      setTimeout(() => setForceUpdateLoading(false), 1500);
    } catch (error) {
      console.error('Erro ao forçar atualização:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível limpar o cache. Tente novamente.',
        variant: 'destructive',
      });
      setForceUpdateLoading(false);
    }
  };

  const getStatusLabel = () => {
    if (subscription.status === 'active') return 'Ativo';
    if (subscription.status === 'trialing' && subscription.subscribed) return 'Em teste (assinatura confirmada)';
    if (subscription.status === 'trialing') return 'Período de teste';
    if (subscription.status === 'expired') return 'Expirado';
    return 'Carregando...';
  };

  const getStatusVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (subscription.status === 'active') return 'default';
    if (subscription.status === 'trialing' && subscription.subscribed) return 'default';
    if (subscription.status === 'trialing') return 'secondary';
    if (subscription.status === 'expired') return 'destructive';
    return 'outline';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Meus Dados</h1>
        <p className="text-muted-foreground">Informações da sua conta e assinatura</p>
      </div>

      {/* Dados do Usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Dados Pessoais
          </CardTitle>
          <CardDescription>
            Informações do seu cadastro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium break-words">{usuario?.nome || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">E-mail</p>
                <p className="font-medium break-words">{usuario?.email || user?.email || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{usuario?.telefone || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">CPF/CNPJ</p>
                <p className="font-medium">{usuario?.cpf_cnpj || '-'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados da Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Empresa
          </CardTitle>
          <CardDescription>
            Dados do estabelecimento vinculado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">ID da Empresa</p>
              <p className="font-medium font-mono text-xs break-all">{usuario?.empresa_id || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assinatura */}
      <Card className="border-primary/30">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Assinatura
            </CardTitle>
            <Badge variant={getStatusVariant()}>{getStatusLabel()}</Badge>
          </div>
          <CardDescription>
            Gerencie seu plano e forma de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="space-y-1">
              <p className="font-medium">GastroGestor Pro</p>
              <p className="text-sm text-muted-foreground">R$ 39,90/mês</p>
              {subscription.status === 'trialing' && subscription.trialEnd && (
                <p className="text-xs text-muted-foreground">
                  {subscription.subscribed 
                    ? `Cobrança inicia em ${new Date(subscription.trialEnd).toLocaleDateString('pt-BR')}`
                    : `Teste expira em ${new Date(subscription.trialEnd).toLocaleDateString('pt-BR')}`
                  }
                </p>
              )}
              {subscription.status === 'trialing' && !subscription.trialEnd && subscription.trialDaysRemaining > 0 && (
                <p className="text-xs text-muted-foreground">
                  {subscription.trialDaysRemaining} dia{subscription.trialDaysRemaining !== 1 ? 's' : ''} restante{subscription.trialDaysRemaining !== 1 ? 's' : ''} de teste
                </p>
              )}
              {subscription.status === 'active' && subscription.subscriptionEnd && (
                <p className="text-xs text-muted-foreground">
                  Próxima cobrança: {new Date(subscription.subscriptionEnd).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {subscription.subscribed ? (
                <Button variant="outline" onClick={handleManageSubscription} disabled={portalLoading}>
                  {portalLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  Gerenciar Assinatura
                </Button>
              ) : (
                <Button onClick={() => navigate('/assinatura')}>
                  <Crown className="mr-2 h-4 w-4" />
                  Ver Planos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suporte Técnico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Suporte Técnico
          </CardTitle>
          <CardDescription>
            Opções para resolver problemas técnicos do aplicativo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <p className="font-medium">Forçar Atualização do App</p>
              <p className="text-sm text-muted-foreground">
                Use se o app estiver mostrando versão desatualizada ou com problemas de cache
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleForceUpdate} 
              disabled={forceUpdateLoading}
              className="shrink-0"
            >
              {forceUpdateLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Forçar Atualização
            </Button>
          </div>
          
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Versão do App:{' '}
              <code className="bg-muted px-1 py-0.5 rounded">{appVersion}</code>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Se dois usuários virem versões diferentes aqui, um deles está preso em cache.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MeusDados;
