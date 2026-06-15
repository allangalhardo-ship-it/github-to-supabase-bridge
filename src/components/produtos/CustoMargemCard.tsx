import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Store, Smartphone, AlertTriangle, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/format';
import { usePrecosCanais } from '@/hooks/usePrecosCanais';
import { cn } from '@/lib/utils';

interface CustoMargemCardProps {
  /** Custo da ficha técnica (soma quantidade × custo_unitario) */
  custoFicha: number;
  /** Preço base do produto (= preço de Balcão, fallback quando canal não tem preço) */
  precoBase: number;
  /** ID do produto (para buscar preços por canal) */
  produtoId: string;
  /** Imposto médio configurado (% sobre vendas) */
  impostoPercentual?: number;
  /** Margem-alvo configurada para destacar verde/amarelo/vermelho */
  margemAlvo?: number;
  /** Modo compacto (esconde explicações longas) */
  compact?: boolean;
}

/**
 * Card que mostra, em tempo real, custo da ficha + margem por canal de venda.
 * Aparece durante a edição de produto/ficha técnica para o usuário ter feedback imediato.
 */
const CustoMargemCard: React.FC<CustoMargemCardProps> = ({
  custoFicha,
  precoBase,
  produtoId,
  impostoPercentual = 0,
  margemAlvo = 30,
  compact = false,
}) => {
  const { canaisConfigurados, precosMap, isLoadingPrecos } = usePrecosCanais(produtoId);

  const linhas = useMemo(() => {
    if (!canaisConfigurados || canaisConfigurados.length === 0) {
      // Fallback: pelo menos mostra o "Balcão" usando preço base
      return [{
        canalId: 'base',
        nome: 'Balcão',
        taxa: 0,
        isBalcao: true,
        preco: precoBase,
      }];
    }
    return canaisConfigurados.map((c) => ({
      canalId: c.id,
      nome: c.nome,
      taxa: c.taxa,
      isBalcao: c.isBalcao,
      // Se canal não tem preço cadastrado → cai no preço base (Balcão)
      preco: precosMap[c.id] !== undefined ? precosMap[c.id] : precoBase,
    }));
  }, [canaisConfigurados, precosMap, precoBase]);

  const calcular = (preco: number, taxa: number) => {
    if (preco <= 0) {
      return { lucro: -custoFicha, margem: 0, valido: false };
    }
    const imposto = preco * (impostoPercentual / 100);
    const taxaCanal = preco * (taxa / 100);
    const lucro = preco - custoFicha - imposto - taxaCanal;
    const margem = (lucro / preco) * 100;
    return { lucro, margem, valido: true };
  };

  const corMargem = (margem: number, preco: number) => {
    if (preco <= 0) return 'text-muted-foreground';
    if (margem < 0) return 'text-destructive';
    if (margem < margemAlvo * 0.7) return 'text-amber-600';
    if (margem < margemAlvo) return 'text-amber-600';
    return 'text-emerald-600';
  };

  // Alerta: qualquer canal vendendo abaixo do custo
  const temCanalNegativo = linhas.some((l) => {
    const { lucro } = calcular(l.preco, l.taxa);
    return l.preco > 0 && lucro < 0;
  });

  return (
    <TooltipProvider>
      <Card className="border-primary/20">
        <CardContent className={cn('p-3 space-y-3', compact && 'p-2 space-y-2')}>
          {/* Header — Custo da ficha */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Custo da ficha
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground">
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px]">
                  <p className="text-xs leading-relaxed">
                    Soma de cada ingrediente × quantidade da ficha técnica. Não inclui custos fixos.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-base font-bold">{formatCurrencyBRL(custoFicha)}</span>
          </div>

          {/* Alerta de canal negativo */}
          {temCanalNegativo && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Há canal(is) vendendo <strong>abaixo do custo</strong>. Ajuste o preço.
              </AlertDescription>
            </Alert>
          )}

          {/* Lista de canais com margem */}
          {custoFicha > 0 && (
            <div className="space-y-1.5">
              {linhas.map((linha) => {
                const { lucro, margem, valido } = calcular(linha.preco, linha.taxa);
                const Icon = linha.isBalcao ? Store : Smartphone;
                const Trend = margem >= 0 ? TrendingUp : TrendingDown;

                return (
                  <div
                    key={linha.canalId}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm',
                      linha.isBalcao ? 'bg-primary/5' : 'bg-muted/30'
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{linha.nome}</span>
                      {linha.taxa > 0 && (
                        <Badge variant="secondary" className="text-[9px] px-1 h-4 shrink-0">
                          {linha.taxa.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatCurrencyBRL(linha.preco)}
                      </span>
                      <div className={cn('flex items-center gap-0.5 font-bold tabular-nums', corMargem(margem, linha.preco))}>
                        <Trend className="h-3 w-3" />
                        <span>{valido ? `${margem.toFixed(1)}%` : '—'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Estado: sem custo ainda */}
          {custoFicha === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Adicione ingredientes na ficha técnica para ver a margem por canal.
            </p>
          )}

          {!compact && impostoPercentual > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Margem = preço − custo − imposto ({impostoPercentual}%) − taxa do canal
            </p>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default CustoMargemCard;
