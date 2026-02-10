import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProdutoAnalise, formatCurrency, formatPercent } from './types';
import { cn } from '@/lib/utils';
import { subDays } from 'date-fns';

interface ImpactoReajusteReportProps {
  produtos: ProdutoAnalise[];
}

interface HistoricoInsumo {
  insumo_id: string;
  preco_anterior: number | null;
  preco_novo: number;
  variacao_percentual: number | null;
  created_at: string;
  insumos: { nome: string } | null;
}

const ImpactoReajusteReport: React.FC<ImpactoReajusteReportProps> = ({ produtos }) => {
  const { usuario } = useAuth();

  // Buscar histórico de preços de insumos dos últimos 60 dias
  const { data: historicoInsumos } = useQuery({
    queryKey: ['historico-insumos-recente', usuario?.empresa_id],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), 60).toISOString();
      const { data, error } = await supabase
        .from('historico_precos')
        .select('insumo_id, preco_anterior, preco_novo, variacao_percentual, created_at, insumos(nome)')
        .eq('empresa_id', usuario?.empresa_id)
        .gte('created_at', dataInicio)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as HistoricoInsumo[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar fichas técnicas para vincular insumos a produtos
  const { data: fichas } = useQuery({
    queryKey: ['fichas-tecnicas-impacto', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fichas_tecnicas')
        .select('produto_id, insumo_id, quantidade');

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  const impactos = useMemo(() => {
    if (!historicoInsumos || !fichas || produtos.length === 0) return [];

    // Agrupar variações por insumo (pegar a mais recente)
    const variacoesPorInsumo: Record<string, {
      nome: string;
      variacao: number;
      precoAnterior: number;
      precoNovo: number;
    }> = {};

    historicoInsumos.forEach(h => {
      if (!variacoesPorInsumo[h.insumo_id] && h.variacao_percentual && h.variacao_percentual !== 0) {
        variacoesPorInsumo[h.insumo_id] = {
          nome: h.insumos?.nome || 'Insumo',
          variacao: h.variacao_percentual,
          precoAnterior: h.preco_anterior || 0,
          precoNovo: h.preco_novo,
        };
      }
    });

    const insumosComAlta = Object.entries(variacoesPorInsumo).filter(([, v]) => Math.abs(v.variacao) > 5);
    if (insumosComAlta.length === 0) return [];

    // Para cada produto, calcular impacto dos reajustes
    return produtos
      .map(produto => {
        const fichasProduto = fichas.filter(f => f.produto_id === produto.id);
        if (fichasProduto.length === 0) return null;

        let custoAnteriorTotal = 0;
        let custoNovoTotal = 0;
        const insumosAfetados: Array<{ nome: string; variacao: number; impactoCusto: number }> = [];

        fichasProduto.forEach(ficha => {
          const variacaoInsumo = variacoesPorInsumo[ficha.insumo_id];
          if (variacaoInsumo) {
            const custoAnterior = variacaoInsumo.precoAnterior * ficha.quantidade;
            const custoNovo = variacaoInsumo.precoNovo * ficha.quantidade;
            custoAnteriorTotal += custoAnterior;
            custoNovoTotal += custoNovo;
            insumosAfetados.push({
              nome: variacaoInsumo.nome,
              variacao: variacaoInsumo.variacao,
              impactoCusto: custoNovo - custoAnterior,
            });
          }
        });

        if (insumosAfetados.length === 0) return null;

        const impactoCustoTotal = custoNovoTotal - custoAnteriorTotal;
        const impactoMargemPP = produto.preco_venda > 0
          ? (impactoCustoTotal / produto.preco_venda) * 100
          : 0;

        return {
          produtoId: produto.id,
          produtoNome: produto.nome,
          precoVenda: produto.preco_venda,
          custoAtual: produto.custoInsumos,
          impactoCustoTotal,
          impactoMargemPP,
          insumosAfetados: insumosAfetados.sort((a, b) => Math.abs(b.impactoCusto) - Math.abs(a.impactoCusto)),
          margemAtual: produto.margemContribuicao,
        };
      })
      .filter(Boolean)
      .filter(p => p && Math.abs(p.impactoCustoTotal) > 0.01)
      .sort((a, b) => Math.abs(b!.impactoCustoTotal) - Math.abs(a!.impactoCustoTotal))
      .slice(0, 8);
  }, [historicoInsumos, fichas, produtos]);

  if (impactos.length === 0) return null;

  const impactoTotalGeral = impactos.reduce((sum, p) => sum + (p?.impactoCustoTotal || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5 text-primary" />
          Impacto de Reajustes de Insumos
          <Badge variant={impactoTotalGeral > 0 ? 'destructive' : 'default'} className="ml-auto">
            {impactoTotalGeral > 0 ? '+' : ''}{formatCurrency(impactoTotalGeral)}/un
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Como as variações de preço de insumos (últimos 60 dias) afetam cada produto
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {impactos.map((imp) => {
          if (!imp) return null;
          const isCritico = imp.impactoMargemPP > 3;
          return (
            <div
              key={imp.produtoId}
              className={cn(
                "border rounded-lg p-3 space-y-2",
                isCritico && "border-destructive/30 bg-destructive/5"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCritico && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                  <span className="font-semibold text-sm">{imp.produtoNome}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Custo: {formatCurrency(imp.custoAtual)}</span>
                  <Badge
                    variant={imp.impactoCustoTotal > 0 ? 'destructive' : 'default'}
                    className="text-[10px]"
                  >
                    {imp.impactoCustoTotal > 0 ? '+' : ''}{formatCurrency(imp.impactoCustoTotal)}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {imp.insumosAfetados.map((insumo, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      insumo.variacao > 0 ? "border-destructive/30 text-destructive" : "border-emerald-500/30 text-emerald-600"
                    )}
                  >
                    {insumo.nome} {insumo.variacao > 0 ? '↑' : '↓'}{Math.abs(insumo.variacao).toFixed(0)}%
                  </Badge>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Impacto na margem: <span className={cn("font-medium", isCritico ? "text-destructive" : "")}>
                  {imp.impactoMargemPP > 0 ? '-' : '+'}{Math.abs(imp.impactoMargemPP).toFixed(1)}pp
                </span>
                {' · '}Margem atual: {formatPercent(imp.margemAtual)}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ImpactoReajusteReport;
