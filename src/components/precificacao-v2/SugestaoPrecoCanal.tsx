import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Store, Smartphone, ArrowRight } from 'lucide-react';
import { ProdutoAnalise, ConfiguracoesPrecificacao, formatCurrency, formatPercent } from './types';
import { cn } from '@/lib/utils';
import { usePrecosCanais } from '@/hooks/usePrecosCanais';

interface SugestaoPrecosCanalProps {
  produtos: ProdutoAnalise[];
  config?: ConfiguracoesPrecificacao;
}

const SugestaoPrecoCanal: React.FC<SugestaoPrecosCanalProps> = ({ produtos, config }) => {
  const { canaisConfigurados } = usePrecosCanais();

  const sugestoes = useMemo(() => {
    if (!canaisConfigurados || canaisConfigurados.length <= 1 || !config || produtos.length === 0) return [];

    const cmvAlvo = (config.cmv_alvo || 35) / 100;

    return produtos
      .filter(p => p.custoInsumos > 0)
      .map(produto => {
        const canaisComSugestao = canaisConfigurados.map(canal => {
          const taxa = canal.taxa / 100;
          // Fórmula baseada em CMV alvo (mesma do simulador do drawer)
          // preço = custo / (cmvAlvo * fatorReceitaLiquida)
          const fatorReceita = 1 - taxa;
          const precoIdeal = fatorReceita > 0 && cmvAlvo > 0
            ? produto.custoInsumos / (cmvAlvo * fatorReceita)
            : produto.custoInsumos * 3;

          // Preço atual neste canal
          const precoAtual = produto.precosCanais?.[canal.id] ?? produto.preco_venda;
          const diferenca = precoIdeal - precoAtual;
          const diferencaPercent = precoAtual > 0 ? (diferenca / precoAtual) * 100 : 0;

          // CMV atual no canal
          const receitaLiquida = precoAtual * fatorReceita;
          const cmvAtual = receitaLiquida > 0 ? (produto.custoInsumos / receitaLiquida) * 100 : 100;

          return {
            canalId: canal.id,
            canalNome: canal.nome,
            taxa: canal.taxa,
            isBalcao: canal.isBalcao,
            precoAtual,
            precoIdeal: Math.ceil(precoIdeal * 100) / 100,
            diferenca,
            diferencaPercent,
            cmvAtual,
            precisaAjuste: Math.abs(diferencaPercent) > 5,
          };
        });

        const temAjuste = canaisComSugestao.some(c => c.precisaAjuste);
        if (!temAjuste) return null;

        return {
          produtoId: produto.id,
          produtoNome: produto.nome,
          custoInsumos: produto.custoInsumos,
          canais: canaisComSugestao,
        };
      })
      .filter(Boolean)
      .slice(0, 5); // top 5 produtos que mais precisam ajuste
  }, [produtos, canaisConfigurados, config]);

  if (sugestoes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          📡 Sugestão de Preço por Canal
          <Badge variant="secondary" className="ml-auto">{sugestoes.length}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Preço ideal por canal considerando taxas e CMV alvo de {config?.cmv_alvo || 35}%
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {sugestoes.map((sug) => {
          if (!sug) return null;
          return (
            <div key={sug.produtoId} className="border rounded-lg p-3 space-y-2">
              <p className="font-semibold text-sm">{sug.produtoNome}</p>
              <p className="text-[10px] text-muted-foreground">
                Custo: {formatCurrency(sug.custoInsumos)}
              </p>
              <div className="grid gap-1.5">
                {sug.canais.map(canal => (
                  <div
                    key={canal.canalId}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 rounded-md border text-xs",
                      canal.precisaAjuste && canal.diferenca > 0
                        ? "bg-amber-500/5 border-amber-500/20"
                        : canal.precisaAjuste && canal.diferenca < 0
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {canal.isBalcao ? <Store className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                      <span className="font-medium">{canal.canalNome}</span>
                      {canal.taxa > 0 && (
                        <span className="text-muted-foreground">({canal.taxa}%)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{formatCurrency(canal.precoAtual)}</span>
                      {canal.precisaAjuste && (
                        <>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-bold">{formatCurrency(canal.precoIdeal)}</span>
                          <Badge
                            variant={canal.diferenca > 0 ? 'destructive' : 'default'}
                            className="text-[9px] px-1 h-4"
                          >
                            {canal.diferenca > 0 ? '+' : ''}{canal.diferencaPercent.toFixed(0)}%
                          </Badge>
                        </>
                      )}
                      {!canal.precisaAjuste && (
                        <Badge variant="outline" className="text-[9px] px-1 h-4 text-emerald-600 border-emerald-500/30">
                          OK
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default SugestaoPrecoCanal;
