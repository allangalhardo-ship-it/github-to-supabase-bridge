import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Check, Carrot, UtensilsCrossed, ShoppingCart, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const WelcomeChecklist = () => {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresa_id;

  const { data: counts, isLoading } = useQuery({
    queryKey: ['welcome-checklist', empresaId],
    queryFn: async () => {
      const [insumosRes, produtosRes, vendasRes] = await Promise.all([
        supabase
          .from('insumos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId!),
        supabase
          .from('produtos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId!),
        supabase
          .from('vendas')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId!),
      ]);

      return {
        insumos: insumosRes.count || 0,
        produtos: produtosRes.count || 0,
        vendas: vendasRes.count || 0,
      };
    },
    enabled: !!empresaId,
    staleTime: 60 * 1000,
  });

  if (isLoading || !counts) return null;

  const steps = [
    {
      label: 'Cadastre seus ingredientes',
      description: 'Adicione os insumos que você usa nas receitas',
      done: counts.insumos > 0,
      to: '/insumos',
      icon: Carrot,
    },
    {
      label: 'Monte seus produtos',
      description: 'Crie seus produtos com a ficha técnica',
      done: counts.produtos > 0,
      to: '/produtos',
      icon: UtensilsCrossed,
    },
    {
      label: 'Registre sua primeira venda',
      description: 'Anote uma venda para ver seus resultados',
      done: counts.vendas > 0,
      to: '/movimentacoes',
      icon: ShoppingCart,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  // Don't show if all steps are completed
  if (allDone) return null;

  const progressPercent = (completedCount / steps.length) * 100;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-base sm:text-lg font-bold text-foreground">
            Primeiros passos
          </h2>
          <span className="text-xs text-muted-foreground ml-auto">
            {completedCount}/{steps.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full mb-5 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, i) => {
            // Find next undone step
            const isNextStep = !step.done && steps.slice(0, i).every((s) => s.done);

            return (
              <div
                key={step.to}
                className={cn(
                  'flex items-center gap-3 rounded-xl p-3 transition-all',
                  step.done
                    ? 'bg-primary/10 opacity-70'
                    : isNextStep
                      ? 'bg-card border-2 border-primary/30 shadow-sm'
                      : 'bg-card border border-border opacity-60'
                )}
              >
                {/* Step indicator */}
                <div
                  className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                    step.done
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {step.done ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-semibold',
                      step.done ? 'line-through text-muted-foreground' : 'text-foreground'
                    )}
                  >
                    {step.label}
                  </p>
                  {!step.done && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>

                {/* Action */}
                {!step.done && isNextStep && (
                  <Button size="sm" asChild className="shrink-0 gap-1">
                    <Link to={step.to}>
                      Ir
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
                {!step.done && !isNextStep && (
                  <Button size="sm" variant="ghost" asChild className="shrink-0 text-xs">
                    <Link to={step.to}>Ir</Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default WelcomeChecklist;
