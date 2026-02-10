import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Check, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProdutoAnalise, formatCurrency } from './types';
import { cn } from '@/lib/utils';
import { subDays } from 'date-fns';

interface ImpactoReajusteReportProps {
  produtos: ProdutoAnalise[];
  onAplicarPreco?: (produtoId: string, novoPreco: number, precoAnterior: number) => void;
  isAplicando?: boolean;
}

const ImpactoReajusteReport: React.FC<ImpactoReajusteReportProps> = ({ 
  produtos, 
  onAplicarPreco,
  isAplicando 
}) => {
  const { usuario } = useAuth();
  const [aplicados, setAplicados] = useState<Set<string>>(new Set());

  // Buscar variações de preço de insumos dos últimos 60 dias
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
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar fichas técnicas COM custo unitário do insumo
  const { data: fichas } = useQuery({
    queryKey: ['fichas-tecnicas-impacto', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fichas_tecnicas')
        .select('produto_id, insumo_id, quantidade, insumos(custo_unitario)');

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  const impactos = useMemo(() => {
    if (!historicoInsumos || !fichas || produtos.length === 0) return [];

    // Pegar a variação mais recente por insumo (só de alta: 5-50%)
    // Só mostramos altas — se um insumo caiu de preço, não precisa reajustar pra cima
    const variacoesPorInsumo: Record<string, { nome: string; variacao: number }> = {};

    historicoInsumos.forEach(h => {
      const isAlta = h.variacao_percentual && 
        h.variacao_percentual > 5 && 
        h.variacao_percentual <= 50;

      if (!variacoesPorInsumo[h.insumo_id] && isAlta) {
        variacoesPorInsumo[h.insumo_id] = {
          nome: (h.insumos as any)?.nome || 'Insumo',
          variacao: h.variacao_percentual!,
        };
      }
    });

    if (Object.keys(variacoesPorInsumo).length === 0) return [];

    return produtos
      .map(produto => {
        const fichasProduto = fichas.filter(f => f.produto_id === produto.id);
        if (fichasProduto.length === 0) return null;

        let impactoCustoTotal = 0;
        const insumosAfetados: Array<{ nome: string; variacao: number }> = [];

        fichasProduto.forEach(ficha => {
          const info = variacoesPorInsumo[ficha.insumo_id];
          if (!info) return;

          // custo_unitario ATUAL do insumo (já incorpora o reajuste)
          const custoUnitAtual = (ficha.insumos as any)?.custo_unitario ?? 0;
          const custoInsumoNoProduto = custoUnitAtual * ficha.quantidade;

          // Impacto = quanto esse insumo SUBIU no custo do produto
          // custoAntes = custoAtual / (1 + var/100)
          // impacto = custoAtual - custoAntes
          const varFraction = info.variacao / 100;
          const impacto = custoInsumoNoProduto * (varFraction / (1 + varFraction));

          if (impacto > 0.01) {
            impactoCustoTotal += impacto;
            insumosAfetados.push({ nome: info.nome, variacao: info.variacao });
          }
        });

        if (insumosAfetados.length === 0 || impactoCustoTotal < 0.05) return null;

        // LÓGICA DO PREÇO SUGERIDO:
        // O custo dos insumos JÁ subiu, mas o preço de venda NÃO foi atualizado.
        // O custo ANTES do reajuste era: custoAnterior = custoAtual - impacto
        // A margem que o usuário TINHA era: margem = (preco - custoAnterior) / preco
        // Para MANTER essa margem com o custo novo:
        // precoNovo = custoAtual / (1 - margemAnterior)
        const custoAnterior = produto.custoInsumos - impactoCustoTotal;
        const margemAnterior = produto.preco_venda > 0
          ? (produto.preco_venda - custoAnterior) / produto.preco_venda
          : 0;

        let precoSugerido: number;
        if (margemAnterior > 0 && margemAnterior < 1) {
          precoSugerido = produto.custoInsumos / (1 - margemAnterior);
        } else {
          // Fallback: simplesmente repassa o aumento de custo
          precoSugerido = produto.preco_venda + impactoCustoTotal;
        }

        const aumento = precoSugerido - produto.preco_venda;
        if (aumento < 0.10) return null;

        return {
          produtoId: produto.id,
          produtoNome: produto.nome,
          precoAtual: produto.preco_venda,
          precoSugerido: Math.ceil(precoSugerido * 100) / 100,
          aumento: Math.ceil(aumento * 100) / 100,
          insumosAfetados: insumosAfetados.sort((a, b) => b.variacao - a.variacao),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.aumento - a!.aumento)
      .slice(0, 6) as Array<{
        produtoId: string;
        produtoNome: string;
        precoAtual: number;
        precoSugerido: number;
        aumento: number;
        insumosAfetados: Array<{ nome: string; variacao: number }>;
      }>;
  }, [historicoInsumos, fichas, produtos]);

  if (impactos.length === 0) return null;

  const handleAplicar = (imp: typeof impactos[0]) => {
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
          const jaAplicou = aplicados.has(imp.produtoId);

          return (
            <div
              key={imp.produtoId}
              className={cn(
                "border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3",
                jaAplicou && "opacity-60"
              )}
            >
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

              <div className="flex items-center gap-2 text-sm shrink-0">
                <span className="text-muted-foreground">{formatCurrency(imp.precoAtual)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-bold text-foreground">{formatCurrency(imp.precoSugerido)}</span>
                <Badge variant="secondary" className="text-[10px]">
                  +{formatCurrency(imp.aumento)}
                </Badge>
              </div>

              {onAplicarPreco && (
                <Button
                  size="sm"
                  variant={jaAplicou ? "ghost" : "default"}
                  className="shrink-0 h-8 text-xs"
                  disabled={jaAplicou || isAplicando}
                  onClick={() => handleAplicar(imp)}
                >
                  {jaAplicou ? (
                    <><Check className="h-3.5 w-3.5 mr-1" /> Aplicado</>
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
