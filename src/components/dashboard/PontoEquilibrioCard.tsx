import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Target, TrendingUp, HelpCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/format';

interface MargemEstimada {
  receitaSimulada: number;
  margemSimulada: number;
  margemPercent: number; // líquida (após impostos e taxa média de canal) — usada no cálculo
  margemPercentBruta?: number;
  margemPercentLiquida?: number;
  impostoPercent?: number;
  taxaMediaCanal?: number;
}

interface PontoEquilibrioCardProps {
  receitaBruta: number;
  margemContribuicao: number;
  custoFixoMensal: number;
  isLoading?: boolean;
  margemEstimada?: MargemEstimada | null;
}

export const PontoEquilibrioCard: React.FC<PontoEquilibrioCardProps> = ({
  receitaBruta,
  margemContribuicao,
  custoFixoMensal,
  isLoading = false,
  margemEstimada,
}) => {
  // Se não há vendas mas temos estimativa dos produtos, usar margem estimada
  const usandoEstimativa = receitaBruta === 0 && !!margemEstimada;
  
  // Margem de contribuição média (%)
  const margemContribuicaoPercent = usandoEstimativa
    ? margemEstimada!.margemPercent
    : receitaBruta > 0 
      ? (margemContribuicao / receitaBruta) * 100 
      : 0;

  // Ponto de equilíbrio = Custos Fixos / Margem de Contribuição %
  const pontoEquilibrio = margemContribuicaoPercent > 0 
    ? custoFixoMensal / (margemContribuicaoPercent / 100) 
    : 0;

  // Quanto falta ou sobra para atingir o ponto de equilíbrio
  const diferencaEquilibrio = receitaBruta - pontoEquilibrio;
  const atingiuEquilibrio = diferencaEquilibrio >= 0;

  // Progresso em % (limitado a 150% para visualização)
  const progressoEquilibrio = pontoEquilibrio > 0 
    ? Math.min((receitaBruta / pontoEquilibrio) * 100, 150) 
    : 0;

  // Status visual
  const getStatus = () => {
    if (custoFixoMensal === 0) {
      return {
        icon: CheckCircle,
        label: 'Sem custos fixos',
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
        progressColor: 'bg-muted',
      };
    }
    if (receitaBruta === 0 && !usandoEstimativa) {
      return {
        icon: Target,
        label: 'Aguardando vendas',
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
        progressColor: 'bg-muted',
      };
    }
    if (usandoEstimativa) {
      return {
        icon: Target,
        label: 'Projeção',
        color: 'text-primary',
        bgColor: 'bg-primary/10',
        progressColor: 'bg-primary',
      };
    }
    if (margemContribuicaoPercent <= 0) {
      return {
        icon: AlertTriangle,
        label: 'Margem negativa',
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
        progressColor: 'bg-destructive',
      };
    }
    if (atingiuEquilibrio) {
      return {
        icon: CheckCircle,
        label: 'Ponto atingido! 🎉',
        color: 'text-green-600',
        bgColor: 'bg-green-100 dark:bg-green-950/30',
        progressColor: 'bg-green-500',
      };
    }
    if (progressoEquilibrio >= 80) {
      return {
        icon: TrendingUp,
        label: 'Quase lá!',
        color: 'text-amber-600',
        bgColor: 'bg-amber-100 dark:bg-amber-950/30',
        progressColor: 'bg-amber-500',
      };
    }
    return {
      icon: Target,
      label: 'Em progresso',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      progressColor: 'bg-primary',
    };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-3">
          <div className="h-6 bg-muted rounded w-48" />
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>Ponto de Equilíbrio</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground inline ml-1.5 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-sm p-4">
                  <div className="space-y-3 text-sm">
                    <p className="font-semibold">O que é o Ponto de Equilíbrio?</p>
                    <p className="text-muted-foreground">
                      É o faturamento mínimo necessário para cobrir todos os seus <strong>custos fixos</strong> do mês (aluguel, funcionários, etc).
                    </p>
                    <div className="bg-muted/50 p-2 rounded text-xs font-mono">
                      <p>Ponto de Equilíbrio = Custos Fixos ÷ Margem de Contribuição %</p>
                    </div>
                    <p className="text-muted-foreground">
                      <strong>Abaixo desse valor:</strong> você está no prejuízo.<br />
                      <strong>Acima desse valor:</strong> você está lucrando!
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardTitle>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${status.bgColor}`}>
            <StatusIcon className={`h-4 w-4 ${status.color}`} />
            <span className={`text-sm font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Valores principais */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Faturamento Necessário {usandoEstimativa && '(projeção)'}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrencyBRL(pontoEquilibrio)}
            </p>
            <p className="text-xs text-muted-foreground">
              para cobrir {formatCurrencyBRL(custoFixoMensal)} de custos fixos
            </p>
          </div>
          
          <div className="space-y-1 text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {usandoEstimativa ? 'Margem Estimada' : 'Seu Faturamento'}
            </p>
            <p className={`text-2xl font-bold ${usandoEstimativa ? 'text-primary' : atingiuEquilibrio ? 'text-green-600' : 'text-foreground'}`}>
              {usandoEstimativa ? `${margemContribuicaoPercent.toFixed(1)}%` : formatCurrencyBRL(receitaBruta)}
            </p>
            <p className="text-xs text-muted-foreground">
              {usandoEstimativa 
                ? 'baseada nos seus produtos' 
                : `margem contribuição: ${margemContribuicaoPercent.toFixed(1)}%`}
            </p>
          </div>
        </div>

        {/* Barra de progresso - só mostra quando há vendas reais */}
        {!usandoEstimativa && (
          <div className="space-y-2">
            <div className="relative">
              <Progress 
                value={Math.min(progressoEquilibrio, 100)} 
                className="h-3"
              />
              {/* Marcador do ponto de equilíbrio */}
              <div 
                className="absolute top-0 h-3 w-0.5 bg-foreground/50"
                style={{ left: `${Math.min((100 / 150) * 100, 66.67)}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {progressoEquilibrio.toFixed(0)}% do ponto de equilíbrio
              </span>
              {atingiuEquilibrio ? (
                <span className="text-green-600 font-semibold">
                  +{formatCurrencyBRL(diferencaEquilibrio)} de lucro potencial
                </span>
              ) : (
                <span className="text-amber-600 font-semibold">
                  Falta {formatCurrencyBRL(Math.abs(diferencaEquilibrio))}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Dica contextual */}
        {custoFixoMensal > 0 && margemContribuicaoPercent > 0 && !usandoEstimativa && (
          <div className={`p-3 rounded-lg text-sm ${atingiuEquilibrio ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400'}`}>
            {atingiuEquilibrio ? (
              <p>
                ✨ Parabéns! Você já cobriu seus custos fixos. Cada venda adicional agora é <strong>lucro real</strong> para o seu negócio.
              </p>
            ) : (
              <p>
                💡 Com sua margem média de {margemContribuicaoPercent.toFixed(0)}%, você precisa vender mais {formatCurrencyBRL(Math.abs(diferencaEquilibrio))} para começar a lucrar.
              </p>
            )}
          </div>
        )}

        {/* Mensagem de projeção */}
        {usandoEstimativa && pontoEquilibrio > 0 && (
          <div className="p-3 rounded-lg bg-primary/5 text-sm text-primary dark:text-primary">
            <p>
              📊 Projeção baseada na margem média dos seus produtos ({margemContribuicaoPercent.toFixed(0)}%). Registre suas <strong>vendas</strong> para ter o cálculo real.
            </p>
          </div>
        )}

        {/* Caso sem dados */}
        {custoFixoMensal === 0 && (
          <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
            <p>
              📝 Cadastre seus <strong>custos fixos</strong> (aluguel, salários, etc.) nas configurações para calcular seu ponto de equilíbrio.
            </p>
          </div>
        )}

        {margemContribuicaoPercent <= 0 && custoFixoMensal > 0 && receitaBruta > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 text-sm text-destructive">
            <p>
              ⚠️ Sua margem de contribuição está negativa. Revise os preços e custos dos seus produtos na página de <strong>Precificação</strong>.
            </p>
          </div>
        )}

        {receitaBruta === 0 && custoFixoMensal > 0 && (
          <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
            <p>
              📊 Registre suas <strong>vendas</strong> para calcular o ponto de equilíbrio do seu negócio.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
