import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Crown, CreditCard, Building2, Mail, Phone, FileText, Loader2, ArrowRight, RefreshCw, Camera, Save, X, Pencil, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const MeusDados = () => {
  const { usuario, user, refreshUsuario } = useAuth();
  const { subscription, openCustomerPortal } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [portalLoading, setPortalLoading] = useState(false);
  const [forceUpdateLoading, setForceUpdateLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    nome: usuario?.nome || '',
    telefone: usuario?.telefone || '',
  });

  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

  // Reset form when usuario changes
  React.useEffect(() => {
    if (usuario) {
      setFormData({
        nome: usuario.nome || '',
        telefone: usuario.telefone || '',
      });
    }
  }, [usuario]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 2MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Add cache buster to URL
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      // Update user profile
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Refresh user data
      if (refreshUsuario) await refreshUsuario();
      queryClient.invalidateQueries({ queryKey: ['usuario'] });

      toast({
        title: 'Foto atualizada!',
        description: 'Sua foto de perfil foi alterada com sucesso.',
      });
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({
        title: 'Erro ao enviar foto',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate
    if (!formData.nome.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Por favor, informe seu nome.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({
          nome: formData.nome.trim(),
          telefone: formData.telefone.trim() || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      // Refresh user data
      if (refreshUsuario) await refreshUsuario();
      queryClient.invalidateQueries({ queryKey: ['usuario'] });

      toast({
        title: 'Dados atualizados!',
        description: 'Suas informações foram salvas com sucesso.',
      });
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      nome: usuario?.nome || '',
      telefone: usuario?.telefone || '',
    });
    setIsEditing(false);
  };

  const handleChangePassword = async () => {
    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      toast({
        title: 'Senha inválida',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'A confirmação da senha deve ser igual à nova senha.',
        variant: 'destructive',
      });
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Senha alterada!',
        description: 'Sua senha foi atualizada com sucesso.',
      });
      setIsChangingPassword(false);
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: 'Erro ao alterar senha',
        description: error.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Meus Dados</h1>
        <p className="text-muted-foreground">Informações da sua conta e assinatura</p>
      </div>

      {/* Avatar e Dados do Usuário */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Dados Pessoais
            </CardTitle>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </div>
            )}
          </div>
          <CardDescription>
            Informações do seu cadastro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24 cursor-pointer" onClick={handleAvatarClick}>
                <AvatarImage src={usuario?.avatar_url} alt={usuario?.nome} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {usuario?.nome ? getInitials(usuario.nome) : <User className="h-8 w-8" />}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
                className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm text-muted-foreground">Clique na foto para alterar</p>
              <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP. Máx 2MB.</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              {isEditing ? (
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Seu nome completo"
                />
              ) : (
                <div className="flex items-start gap-3 p-2 rounded-md bg-muted/50">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="font-medium break-words min-w-0">{usuario?.nome || '-'}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="flex items-start gap-3 p-2 rounded-md bg-muted/50">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="font-medium break-words min-w-0">{usuario?.email || user?.email || '-'}</p>
              </div>
              <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              {isEditing ? (
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              ) : (
                <div className="flex items-start gap-3 p-2 rounded-md bg-muted/50">
                  <Phone className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="font-medium">{usuario?.telefone || '-'}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
              <div className="flex items-start gap-3 p-2 rounded-md bg-muted/50">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="font-medium">{usuario?.cpf_cnpj || '-'}</p>
              </div>
              <p className="text-xs text-muted-foreground">O CPF/CNPJ não pode ser alterado</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Segurança - Alterar Senha */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Segurança
            </CardTitle>
          </div>
          <CardDescription>
            Altere sua senha de acesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isChangingPassword ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Digite novamente"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordData({ newPassword: '', confirmPassword: '' });
                  }}
                  disabled={passwordLoading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleChangePassword} disabled={passwordLoading}>
                  {passwordLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Nova Senha
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setIsChangingPassword(true)}>
              <Lock className="h-4 w-4 mr-2" />
              Alterar Senha
            </Button>
          )}
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
              {(() => {
                const effectivePlan = subscription.plan === 'pro' ? 'pro' : 'standard';
                const planName = effectivePlan === 'pro' ? 'GastroGestor Pro' : 'GastroGestor Standard';
                const planPrice = effectivePlan === 'pro' ? 'R$ 59,90/mês' : 'R$ 39,90/mês';

                return (
                  <>
                    <p className="font-medium">{planName}</p>
                    <p className="text-sm text-muted-foreground">{planPrice}</p>
                  </>
                );
              })()}
              {subscription.status === 'trialing' && subscription.trialEnd && (
                <p className="text-xs text-muted-foreground">
                  {subscription.subscribed
                    ? `Cobrança inicia em ${new Date(subscription.trialEnd).toLocaleDateString('pt-BR')}`
                    : `Teste expira em ${new Date(subscription.trialEnd).toLocaleDateString('pt-BR')}`}
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
