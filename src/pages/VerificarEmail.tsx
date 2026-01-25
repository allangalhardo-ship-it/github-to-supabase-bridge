import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/brand/Logo';
import { Mail, RefreshCw, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const VerificarEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResendEmail = async () => {
    if (!email) {
      toast.error('Email não encontrado. Faça o cadastro novamente.');
      return;
    }

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) throw error;

      setResent(true);
      toast.success('Email de verificação reenviado!');
      
      // Reset após 60 segundos
      setTimeout(() => setResent(false), 60000);
    } catch (err: any) {
      console.error('Resend error:', err);
      toast.error(err.message || 'Erro ao reenviar email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo size="md" />
          </div>
          <div className="mx-auto p-4 bg-primary/10 rounded-full w-fit">
            <Mail className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verifique seu email</CardTitle>
          <CardDescription className="text-base">
            Enviamos um link de confirmação para:
          </CardDescription>
          {email && (
            <p className="font-medium text-primary text-lg">{email}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instruções */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium">Para ativar sua conta:</p>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Abra sua caixa de entrada</li>
              <li>Procure o email do GastroGestor</li>
              <li>Clique no link de confirmação</li>
              <li>Volte aqui e faça login</li>
            </ol>
          </div>

          {/* Dica sobre spam */}
          <div className="flex items-start gap-3 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p>
              Não encontrou? Verifique sua pasta de <strong>spam</strong> ou <strong>lixo eletrônico</strong>.
            </p>
          </div>

          {/* Botões */}
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResendEmail}
              disabled={resending || resent}
            >
              {resending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reenviando...
                </>
              ) : resent ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                  Email reenviado! Aguarde 1 min
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reenviar email de verificação
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/login')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para o login
            </Button>
          </div>

          {/* Info adicional */}
          <p className="text-xs text-center text-muted-foreground">
            Após confirmar seu email, você poderá fazer login normalmente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerificarEmail;
