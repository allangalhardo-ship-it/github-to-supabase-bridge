import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Check, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProdutoAnalise, ConfiguracoesPrecificacao, formatCurrency } from './types';
import { cn } from '@/lib/utils';
import { subDays } from 'date-fns';
import { usePrecosCanais } from '@/hooks/usePrecosCanais';

interface ImpactoReajusteReportProps {
  produtos: ProdutoAnalise[];
  config?: ConfiguracoesPrecificacao;
  onAplicarPreco?: (produtoId: string, novoPreco: number, precoAnterior: number) => void;
  onAplicarPrecoCanal?: (produtoId: string, canal: string, novoPreco: number, precoAnterior: number) => void;
  isAplicando?: boolean;
}

const ImpactoReajusteReport: React.FC<ImpactoReajusteReportProps> = ({ 
  produtos, 
  config,
  onAplicarPreco,
  onAplicarPrecoCanal,
  isAplicando 
}) => {
  const { usuario } = useAuth();
  const [aplicados, setAplicados] = useState<Set<string>>(new Set());
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const { canaisConfigurados } = usePrecosCanais();

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

  const cmvAlvo = config?.cmv_alvo || 35;

  const impactos = useMemo(() => {
    if (!historicoInsumos || !fichas || produtos.length === 0) return [];

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

          const custoUnitAtual = (ficha.insumos as any)?.custo_unitario ?? 0;
          const custoInsumoNoProduto = custoUnitAtual * ficha.quantidade;

          const varFraction = info.variacao / 100;
          const impacto = custoInsumoNoProduto * (varFraction / (1 + varFraction));

          if (impacto > 0.01) {
            impactoCustoTotal += impacto;
            insumosAfetados.push({ nome: info.nome, variacao: info.variacao });
          }
        });

        // Se o CMV atual do produto ainda está dentro do alvo, não precisa reajustar
        if (produto.cmv <= cmvAlvo) return null;

        if (insumosAfetados.length === 0 || impactoCustoTotal < 0.05) return null;

        const custoAnterior = produto.custoInsumos - impactoCustoTotal;
        const margemAnterior = produto.preco_venda > 0
          ? (produto.preco_venda - custoAnterior) / produto.preco_venda
          : 0;

        let precoSugerido: number;
        if (margemAnterior > 0 && margemAnterior < 1) {
          precoSugerido = produto.custoInsumos / (1 - margemAnterior);
        } else {
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

  const temCanais = canaisConfigurados && canaisConfigurados.length > 1;

  const handleAplicarBase = (imp: typeof impactos[0]) => {
    if (onAplicarPreco) {
      onAplicarPreco(imp.produtoId, imp.precoSugerido, imp.precoAtual);
      setAplicados(prev => new Set(prev).add(imp.produtoId));
    }
  };

  const handleAplicarCanal = (imp: typeof impactos[0], canalId: string, precoAtualCanal: number) => {
    if (!onAplicarPrecoCanal) return;
    const fator = imp.precoAtual > 0 ? imp.precoSugerido / imp.precoAtual : 1;
    const precoSugeridoCanal = Math.ceil(precoAtualCanal * fator * 100) / 100;
    onAplicarPrecoCanal(imp.produtoId, canalId, precoSugeridoCanal, precoAtualCanal);
    setAplicados(prev => new Set(prev).add(`${imp.produtoId}-${canalId}`));
  };

  const toggleExpandido = (produtoId: string) => {
    setExpandido(prev => {
      const next = new Set(prev);
      if (next.has(produtoId)) next.delete(produtoId);
      else next.add(produtoId);
      return next;
    });
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
          const jaAplicouBase = aplicados.has(imp.produtoId);
          const isExpandido = expandido.has(imp.produtoId);
          const produto = produtos.find(p => p.id === imp.produtoId);

          return (
            <div key={imp.produtoId} className="border rounded-lg overflow-hidden">
              {/* Linha principal */}
              <div className={cn(
                "p-3 flex flex-col sm:flex-row sm:items-center gap-3",
                jaAplicouBase && !temCanais && "opacity-60"
              )}>
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

                {/* Só mostra preço base se NÃO tem múltiplos canais */}
                {!temCanais && (
                  <div className="flex items-center gap-2 text-sm shrink-0">
                    <span className="text-muted-foreground">{formatCurrency(imp.precoAtual)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-bold text-foreground">{formatCurrency(imp.precoSugerido)}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      +{formatCurrency(imp.aumento)}
                    </Badge>
                  </div>
                )}
                {/* Se tem canais, mostra só o impacto no custo */}
                {temCanais && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    Custo subiu ~{formatCurrency(imp.aumento)}
                  </Badge>
                )}

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Se não tem múltiplos canais, botão simples */}
                  {onAplicarPreco && !temCanais && (
                    <Button
                      size="sm"
                      variant={jaAplicouBase ? "ghost" : "default"}
                      className="h-8 text-xs"
                      disabled={jaAplicouBase || isAplicando}
                      onClick={() => handleAplicarBase(imp)}
                    >
                      {jaAplicouBase ? (
                        <><Check className="h-3.5 w-3.5 mr-1" /> Aplicado</>
                      ) : (
                        'Aplicar'
                      )}
                    </Button>
                  )}
                  {/* Se tem múltiplos canais, botão para expandir */}
                  {temCanais && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1"
                      onClick={() => toggleExpandido(imp.produtoId)}
                    >
                      Canais
                      {isExpandido ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Preços por canal expandido */}
              {temCanais && isExpandido && (
                <div className="border-t bg-muted/20 p-3 space-y-1.5">
                  {canaisConfigurados!.map(canal => {
                    const precoAtualCanal = produto?.precosCanais?.[canal.id] ?? imp.precoAtual;
                    const fator = imp.precoAtual > 0 ? imp.precoSugerido / imp.precoAtual : 1;
                    const precoSugeridoCanal = Math.ceil(precoAtualCanal * fator * 100) / 100;
                    const jaAplicouCanal = aplicados.has(`${imp.produtoId}-${canal.id}`);

                    return (
                      <div key={canal.id} className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium truncate">{canal.nome}</span>
                          {canal.taxa > 0 && (
                            <span className="text-muted-foreground shrink-0">({canal.taxa}%)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted-foreground">{formatCurrency(precoAtualCanal)}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-bold">{formatCurrency(precoSugeridoCanal)}</span>
                          <Button
                            size="sm"
                            variant={jaAplicouCanal ? "ghost" : "secondary"}
                            className="h-6 text-[10px] px-2"
                            disabled={jaAplicouCanal || isAplicando}
                            onClick={() => handleAplicarCanal(imp, canal.id, precoAtualCanal)}
                          >
                            {jaAplicouCanal ? <Check className="h-3 w-3" /> : 'Aplicar'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ImpactoReajusteReport;
