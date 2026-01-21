import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  TrendingDown,
  Zap,
  ChevronRight
} from 'lucide-react';
import { ProdutoComMetricas, formatCurrency, formatPercent } from './types';

interface UrgentAttentionProps {
  produtos: ProdutoComMetricas[];
  onSelectProduct: (produto: ProdutoComMetricas) => void;
  onApplyPrice: (produtoId: string, novoPreco: number, precoAnterior: number) => void;
  onApplyAll: () => void;
  isApplying?: boolean;
}

const UrgentAttention: React.FC<UrgentAttentionProps> = ({
  produtos,
  onSelectProduct,
  onApplyPrice,
  onApplyAll,
  isApplying
}) => {
  const produtosNegativos = produtos.filter(p => p.margemLiquida < 0);
  const produtosAbaixo = produtos.filter(p => p.statusPreco === 'abaixo' && p.margemLiquida >= 0);
  
  const urgentes = [...produtosNegativos, ...produtosAbaixo.slice(0, 5 - produtosNegativos.length)];

  if (urgentes.length === 0) {
    return null;
  }

  return (
    <Card className="border-destructive/30 bg-gradient-to-br from-destructive/5 to-warning/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-base text-destructive">Atenção Urgente</CardTitle>
              <p className="text-sm text-muted-foreground">
                {produtosNegativos.length > 0 && (
                  <span className="text-destructive font-medium">
                    {produtosNegativos.length} produto{produtosNegativos.length > 1 ? 's' : ''} com margem negativa
                  </span>
                )}
                {produtosNegativos.length > 0 && produtosAbaixo.length > 0 && ' • '}
                {produtosAbaixo.length > 0 && (
                  <span className="text-warning font-medium">
                    {produtosAbaixo.length} abaixo do ideal
                  </span>
                )}
              </p>
            </div>
          </div>
          {urgentes.length > 1 && (
            <Button 
              size="sm" 
              variant="destructive"
              onClick={onApplyAll}
              disabled={isApplying}
              className="gap-1.5 shrink-0"
            >
              <Zap className="h-3.5 w-3.5" />
              Corrigir todos
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {urgentes.map((produto) => {
            const isNegativo = produto.margemLiquida < 0;
            
            return (
              <div
                key={produto.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isNegativo 
                    ? 'bg-destructive/10 border-destructive/30' 
                    : 'bg-warning/10 border-warning/30'
                }`}
              >
                <div 
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onSelectProduct(produto)}
                >
                  <div className="flex items-center gap-2">
                    <TrendingDown className={`h-4 w-4 shrink-0 ${
                      isNegativo ? 'text-destructive' : 'text-warning'
                    }`} />
                    <p className="font-medium text-sm truncate">{produto.nome}</p>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className="text-muted-foreground">
                      Atual: {formatCurrency(produto.preco_venda)}
                    </span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className={isNegativo ? 'text-destructive' : 'text-warning'}>
                      Margem: {formatPercent(produto.margemLiquida)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Sugerido</p>
                    <p className="font-bold text-sm text-success">
                      {formatCurrency(produto.precoBalcao)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isNegativo ? 'destructive' : 'default'}
                    onClick={() => onApplyPrice(produto.id, produto.precoBalcao, produto.preco_venda)}
                    disabled={isApplying}
                    className="h-8 px-2"
                  >
                    <Zap className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default UrgentAttention;
