import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { 
  Check, Carrot, UtensilsCrossed, ClipboardList, 
  PackageOpen, ShoppingCart, ArrowRight, Sparkles, 
  ChevronDown, ChevronUp, ChefHat
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const WelcomeChecklist = () => {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresa_id;
  const [expanded, setExpanded] = useState(true);

  const { data: counts, isLoading } = useQuery({
    queryKey: ['welcome-checklist', empresaId],
    queryFn: async () => {
      // Get produto IDs first for subqueries
      const { data: produtosData } = await supabase
        .from('produtos')
        .select('id')
        .eq('empresa_id', empresaId!);
      const produtoIds = produtosData?.map(p => p.id) || [];

      const [insumosRes, produtosRes, fichasRes, receitasRes, estoqueRes, vendasRes] = await Promise.all([
        supabase
          .from('insumos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId!)
          .eq('is_intermediario', false),
        supabase
          .from('produtos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId!),
        produtoIds.length > 0
          ? supabase
              .from('fichas_tecnicas')
              .select('produto_id', { count: 'exact', head: true })
              .in('produto_id', produtoIds)
          : Promise.resolve({ count: 0 }),
        supabase
          .from('insumos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresaId!)
          .eq('is_intermediario', true),
        supabase
          .from('estoque_movimentos')
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
        fichas: fichasRes.count || 0,
        receitas: receitasRes.count || 0,
        estoque: estoqueRes.count || 0,
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
      description: 'Adicione o que você usa nas receitas (farinha, açúcar, etc.). Pode importar uma base pronta!',
      done: counts.insumos >= 2,
      to: '/insumos',
      icon: Carrot,
    },
    {
      label: 'Crie seu primeiro produto',
      description: 'Cadastre o que você vende (ex: bolo, brigadeiro, marmita).',
      done: counts.produtos > 0,
      to: '/produtos',
      icon: UtensilsCrossed,
    },
    {
      label: 'Crie uma receita base',
      description: 'Ex: calda, massa, recheio — preparações que entram em vários produtos. Se não usa, pode pular!',
      done: counts.receitas > 0,
      to: '/receitas',
      icon: ChefHat,
      optional: true,
    },
    {
      label: 'Monte a ficha técnica',
      description: 'Vincule os ingredientes (e receitas) ao produto para calcular o custo automaticamente.',
      done: counts.fichas > 0,
      to: '/produtos',
      icon: ClipboardList,
    },
    {
      label: 'Informe seu estoque inicial',
      description: 'Diga quanto de cada ingrediente você tem em mãos agora.',
      done: counts.estoque > 0,
      to: '/estoque',
      icon: PackageOpen,
    },
    {
      label: 'Registre sua primeira venda',
      description: 'Anote uma venda para ver seus resultados no painel!',
      done: counts.vendas > 0,
      to: '/movimentacoes',
      icon: ShoppingCart,
    },
  ];

  // Required steps for completion check (exclude optional)
  const requiredSteps = steps.filter((s) => !s.optional);
  const completedRequired = requiredSteps.filter((s) => s.done).length;
  const completedCount = steps.filter((s) => s.done).length;
  const allDone = requiredSteps.every((s) => s.done);

  if (allDone) return null;

  const progressPercent = (completedRequired / requiredSteps.length) * 100;

  // Find the next required step to do (skip optional if previous required isn't done)
  const nextStepIndex = steps.findIndex((s) => !s.done && !s.optional);
  // If all required before an optional are done, show optional as next
  const effectiveNextIndex = nextStepIndex >= 0 ? nextStepIndex : steps.findIndex((s) => !s.done);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full text-left"
        >
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-base sm:text-lg font-bold text-foreground">
            Configure seu negócio
          </h2>
          <span className="text-xs text-muted-foreground ml-auto mr-2">
            {completedCount}/{steps.length}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Progress bar - always visible */}
        <div className="h-2 bg-muted rounded-full mt-3 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {!expanded && nextStepIndex >= 0 && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Próximo: <span className="font-medium text-foreground">{steps[nextStepIndex].label}</span>
            </p>
            <Button size="sm" asChild className="shrink-0 gap-1">
              <Link to={steps[nextStepIndex].to}>
                Ir <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}

        {/* Steps */}
        {expanded && (
          <div className="space-y-2.5 mt-4">
            {steps.map((step, i) => {
              const isNextStep = i === nextStepIndex;

              return (
                <div
                  key={step.to + step.label}
                  className={cn(
                    'flex items-center gap-3 rounded-xl p-3 transition-all',
                    step.done
                      ? 'bg-primary/10 opacity-70'
                      : isNextStep
                        ? 'bg-card border-2 border-primary/30 shadow-sm'
                        : 'bg-card border border-border opacity-60'
                  )}
                >
                  {/* Step number/check */}
                  <div
                    className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
                      step.done
                        ? 'bg-primary text-primary-foreground'
                        : isNextStep
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {step.done ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span>{i + 1}</span>
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
                    {!step.done && isNextStep && (
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
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WelcomeChecklist;
