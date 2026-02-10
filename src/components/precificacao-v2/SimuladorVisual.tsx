import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Building2 } from 'lucide-react';
import { ProdutoAnalise, formatCurrency, ConfiguracoesPrecificacao } from './types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SimuladorVisualProps {
  produtos: ProdutoAnalise[];
  config?: ConfiguracoesPrecificacao;
}

const SimuladorVisual: React.FC<SimuladorVisualProps> = ({ produtos, config }) => {
  const { usuario } = useAuth();
  const [ajustePercent, setAjustePercent] = useState(0);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);

  const { data: custosFixos } = useQuery({
    queryKey: ['custos-fixos-total', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custos_fixos')
        .select('nome, valor_mensal, categoria')
        .eq('empresa_id', usuario?.empresa_id!);

      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Agrupar por categoria
  const categorias = useMemo(() => {
    if (!custosFixos) return [];
    const map: Record<string, number> = {};
    custosFixos.forEach(c => {
      const cat = c.categoria || 'Outros';
      map[cat] = (map[cat] || 0) + Number(c.valor_mensal);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([nome, valor]) => ({ nome, valor }));
  }, [custosFixos]);

  const simulacao = useMemo(() => {
    if (!custosFixos || custosFixos.length === 0 || produtos.length === 0) return null;

    const custoFixoTotal = custosFixos.reduce((sum, c) => sum + Number(c.valor_mensal), 0);

    // Valor afetado pelo ajuste (só a categoria selecionada ou tudo)
    const valorAfetado = categoriaSelecionada
      ? categorias.find(c => c.nome === categoriaSelecionada)?.valor || 0
      : custoFixoTotal;

    const valorNaoAfetado = custoFixoTotal - valorAfetado;
    const valorAfetadoNovo = valorAfetado * (1 + ajustePercent / 100);
    const custoFixoNovo = valorNaoAfetado + valorAfetadoNovo;
    const diferencaMensal = custoFixoNovo - custoFixoTotal;

    const faturamentoMensal = produtos.reduce((sum, p) => sum + p.receitaTotal, 0);
    const lucroBrutoMensal = produtos.reduce((sum, p) => {
      const lucroUnit = p.preco_venda - p.custoInsumos;
      return sum + lucroUnit * (p.quantidadeVendida || 0);
    }, 0);

    const lucroLiquidoAtual = lucroBrutoMensal - custoFixoTotal;
    const lucroLiquidoNovo = lucroBrutoMensal - custoFixoNovo;

    // Margem de contribuição: quanto de cada R$1 faturado sobra após custos variáveis
    // Usar faturamento como base e garantir que fique entre 0 e 1
    const margemBrutaPct = faturamentoMensal > 0
      ? Math.min(Math.max(lucroBrutoMensal / faturamentoMensal, 0), 0.99)
      : 0;
    const faturamentoExtraNecessario = margemBrutaPct > 0 ? diferencaMensal / margemBrutaPct : diferencaMensal;

    return {
      custoFixoTotal,
      valorAfetado,
      valorAfetadoNovo,
      custoFixoNovo,
      diferencaMensal,
      faturamentoMensal,
      lucroLiquidoAtual,
      lucroLiquidoNovo,
      faturamentoExtraNecessario,
    };
  }, [custosFixos, produtos, ajustePercent, categoriaSelecionada, categorias]);

  if (!simulacao) return null;

  const isAumento = ajustePercent > 0;
  const isReducao = ajustePercent < 0;
  const labelAfetado = categoriaSelecionada || 'Todos os custos fixos';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-5 w-5 text-primary" />
          E se meus custos fixos mudarem?
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Simule o impacto de reajustes no seu resultado mensal. Toque em uma categoria para simular individualmente.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Categorias clicáveis */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              setCategoriaSelecionada(null);
              setAjustePercent(0);
            }}
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors",
              !categoriaSelecionada
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
            )}
          >
            Todos ({formatCurrency(simulacao.custoFixoTotal)})
          </button>
          {categorias.map(cat => (
            <button
              key={cat.nome}
              onClick={() => {
                setCategoriaSelecionada(cat.nome === categoriaSelecionada ? null : cat.nome);
                setAjustePercent(0);
              }}
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors",
                categoriaSelecionada === cat.nome
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {cat.nome} ({formatCurrency(cat.valor)})
            </button>
          ))}
        </div>

        {/* Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground text-xs truncate">
              Variação: {labelAfetado}
            </span>
            <Badge variant={isAumento ? 'destructive' : isReducao ? 'default' : 'secondary'}>
              {ajustePercent > 0 ? '+' : ''}{ajustePercent}%
            </Badge>
          </div>
          <Slider
            value={[ajustePercent]}
            onValueChange={(v) => setAjustePercent(v[0])}
            min={-30}
            max={30}
            step={5}
            className="py-2"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>-30%</span>
            <span>0%</span>
            <span>+30%</span>
          </div>
        </div>

        {/* Resultados */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase">
              {categoriaSelecionada || 'Custos fixos'}/mês
            </p>
            <p className="text-sm font-bold">{formatCurrency(simulacao.valorAfetado)}</p>
            {ajustePercent !== 0 && (
              <p className={cn(
                "text-xs font-semibold",
                isAumento ? "text-destructive" : "text-emerald-600"
              )}>
                → {formatCurrency(simulacao.valorAfetadoNovo)}
                <span className="ml-1 text-[10px] font-normal">
                  ({isAumento ? '+' : ''}{formatCurrency(simulacao.diferencaMensal)})
                </span>
              </p>
            )}
          </div>

          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase">Lucro líquido/mês</p>
            <p className={cn(
              "text-sm font-bold",
              simulacao.lucroLiquidoAtual < 0 ? "text-destructive" : ""
            )}>
              {formatCurrency(simulacao.lucroLiquidoAtual)}
            </p>
            {ajustePercent !== 0 && (
              <p className={cn(
                "text-xs font-semibold",
                simulacao.lucroLiquidoNovo < simulacao.lucroLiquidoAtual ? "text-destructive" : "text-emerald-600"
              )}>
                → {formatCurrency(simulacao.lucroLiquidoNovo)}
                {simulacao.lucroLiquidoNovo < 0 && (
                  <Badge variant="destructive" className="ml-1 text-[9px] px-1 h-4">
                    Prejuízo
                  </Badge>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Insight */}
        {ajustePercent > 0 && simulacao.faturamentoExtraNecessario > 0 && (
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1">
            <p className="text-xs font-semibold text-foreground">
              💡 Para cobrir esse aumento, você precisaria faturar mais{' '}
              <span className="text-amber-600 font-bold">
                {formatCurrency(simulacao.faturamentoExtraNecessario)}
              </span>
              /mês
            </p>
            {simulacao.faturamentoMensal > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Isso é {((simulacao.faturamentoExtraNecessario / simulacao.faturamentoMensal) * 100).toFixed(1)}% do seu faturamento atual de {formatCurrency(simulacao.faturamentoMensal)}.
              </p>
            )}
          </div>
        )}

        {ajustePercent < 0 && (
          <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
            <p className="text-xs font-semibold text-foreground">
              ✅ Economizando{' '}
              <span className="text-emerald-600 font-bold">
                {formatCurrency(Math.abs(simulacao.diferencaMensal))}
              </span>
              /mês — direto no lucro.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SimuladorVisual;
