import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Check, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProdutoAnalise, formatCurrency, formatPercent } from './types';
import { cn } from '@/lib/utils';
import { subDays } from 'date-fns';

interface ImpactoReajusteReportProps {
  produtos: ProdutoAnalise[];
  onAplicarPreco?: (produtoId: string, novoPreco: number, precoAnterior: number) => void;
  isAplicando?: boolean;
}

interface HistoricoInsumo {
  insumo_id: string;
  preco_anterior: number | null;
  preco_novo: number;
  variacao_percentual: number | null;
  created_at: string;
  insumos: { nome: string } | null;
}

const ImpactoReajusteReport: React.FC<ImpactoReajusteReportProps> = ({ 
  produtos, 
  onAplicarPreco,
  isAplicando 
}) => {
  const { usuario } = useAuth();
  const [aplicados, setAplicados] = useState<Set<string>>(new Set());

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

    const variacoesPorInsumo: Record<string, {
      nome: string;
      variacao: number;
      precoAnterior: number;
      precoNovo: number;
    }> = {};

    historicoInsumos.forEach(h => {
      const variacaoRealista = h.variacao_percentual && 
        Math.abs(h.variacao_percentual) > 5 && 
        Math.abs(h.variacao_percentual) <= 50;

      if (!variacoesPorInsumo[h.insumo_id] && variacaoRealista) {
        variacoesPorInsumo[h.insumo_id] = {
          nome: h.insumos?.nome || 'Insumo',
          variacao: h.variacao_percentual!,
          precoAnterior: h.preco_anterior || 0,
          precoNovo: h.preco_novo,
        };
      }
    });

    const insumosComAlta = Object.entries(variacoesPorInsumo);
    if (insumosComAlta.length === 0) return [];

    return produtos
      .map(produto => {
        const fichasProduto = fichas.filter(f => f.produto_id === produto.id);
        if (fichasProduto.length === 0) return null;

        let custoAnteriorTotal = 0;
        let custoNovoTotal = 0;
        const insumosAfetados: Array<{ nome: string; variacao: number }> = [];

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
            });
          }
        });

        if (insumosAfetados.length === 0) return null;

        const impactoCustoTotal = custoNovoTotal - custoAnteriorTotal;
        if (Math.abs(impactoCustoTotal) < 0.01) return null;

        // Calcular preço sugerido para manter a mesma margem %
        const margemAtualPct = produto.preco_venda > 0
          ? (produto.preco_venda - produto.custoInsumos) / produto.preco_venda
          : 0;
        
        const novoCusto = produto.custoInsumos + impactoCustoTotal;
        const precoSugerido = margemAtualPct > 0 && margemAtualPct < 1
          ? novoCusto / (1 - margemAtualPct)
          : produto.preco_venda + impactoCustoTotal;

        const aumentoNecessario = precoSugerido - produto.preco_venda;

        return {
          produtoId: produto.id,
          produtoNome: produto.nome,
          precoAtual: produto.preco_venda,
          precoSugerido: Math.ceil(precoSugerido * 100) / 100, // arredonda pra cima
          aumentoNecessario,
          insumosAfetados,
          impactoCusto: impactoCustoTotal,
        };
      })
      .filter(Boolean)
      .filter(p => p && p.aumentoNecessario > 0.10) // só mostra se precisa subir >R$0,10
      .sort((a, b) => b!.aumentoNecessario - a!.aumentoNecessario)
      .slice(0, 6);
  }, [historicoInsumos, fichas, produtos]);

  if (impactos.length === 0) return null;

  const handleAplicar = (imp: NonNullable<typeof impactos[0]>) => {
    if (onAplicarPreco) {
      onAplicarPreco(imp.produtoId, imp.precoSugerido, imp.precoAtual);
      setAplicados(prev => new Set(prev).add(imp.produtoId));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5 text-primary" />
          Insumos subiram — reajuste seus preços
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Nos últimos 60 dias, alguns insumos subiram de preço. Veja quanto cada produto precisa aumentar para manter sua margem.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {impactos.map((imp) => {
          if (!imp) return null;
          const jaAplicou = aplicados.has(imp.produtoId);

          return (
            <div
              key={imp.produtoId}
              className={cn(
                "border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3",
                jaAplicou && "opacity-60"
              )}
            >
              {/* Info do produto */}
              <div className="flex-1 min-w-0 space-y-1">
                <span className="font-semibold text-sm block truncate">{imp.produtoNome}</span>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {imp.insumosAfetados.map((ins, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                      {ins.nome} ↑{Math.abs(ins.variacao).toFixed(0)}%
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Preço atual → sugerido */}
              <div className="flex items-center gap-2 text-sm shrink-0">
                <span className="text-muted-foreground">{formatCurrency(imp.precoAtual)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-bold text-foreground">{formatCurrency(imp.precoSugerido)}</span>
                <Badge variant="secondary" className="text-[10px]">
                  +{formatCurrency(imp.aumentoNecessario)}
                </Badge>
              </div>

              {/* Botão aplicar */}
              {onAplicarPreco && (
                <Button
                  size="sm"
                  variant={jaAplicou ? "ghost" : "default"}
                  className="shrink-0 h-8 text-xs"
                  disabled={jaAplicou || isAplicando}
                  onClick={() => handleAplicar(imp)}
                >
                  {jaAplicou ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Aplicado
                    </>
                  ) : (
                    'Aplicar'
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ImpactoReajusteReport;
