import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp,
  Truck,
  Crown,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';

interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  custo_insumos: number;
  margem: number;
  lucro: number;
}

interface ImpactoApp {
  nome: string;
  taxaTotal: number;
  percentualLucro: number;
  vendas: number;
}

interface MelhorProduto {
  nome: string;
  lucroTotal: number;
  quantidade: number;
  margem: number;
}

interface DashboardInsightsProps {
  produtosMargemNegativa: Produto[];
  impactoApps: ImpactoApp[];
  melhorProduto: MelhorProduto | null;
  lucroTotal: number;
  formatCurrency: (value: number) => string;
}

export const DashboardInsights: React.FC<DashboardInsightsProps> = ({
  produtosMargemNegativa,
  impactoApps,
  melhorProduto,
  lucroTotal,
  formatCurrency,
}) => {
  const navigate = useNavigate();

  const hasInsights = produtosMargemNegativa.length > 0 || impactoApps.length > 0 || melhorProduto;

  if (!hasInsights) {
    return null;
  }

  return (
    <Card className="animate-fade-in border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-primary" />
          Insights do seu Negócio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Melhor Produto do Mês */}
        {melhorProduto && melhorProduto.lucroTotal > 0 && (
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center shrink-0">
                <Crown className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-green-800 dark:text-green-200">
                    🏆 Campeão de vendas
                  </h4>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    +{formatCurrency(melhorProduto.lucroTotal)}
                  </Badge>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  <strong>{melhorProduto.nome}</strong> é seu produto mais lucrativo!
                  {melhorProduto.quantidade > 1 && ` (${melhorProduto.quantidade}x vendidos)`}
                </p>
                {melhorProduto.margem > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Margem: {melhorProduto.margem.toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Produtos com Margem Negativa */}
        {produtosMargemNegativa.length > 0 && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center shrink-0">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-red-800 dark:text-red-200">
                    ⚠️ {produtosMargemNegativa.length} {produtosMargemNegativa.length === 1 ? 'produto dando prejuízo' : 'produtos dando prejuízo'}
                  </h4>
                </div>
                <div className="mt-2 space-y-1">
                  {produtosMargemNegativa.slice(0, 3).map((produto) => (
                    <div key={produto.id} className="flex items-center justify-between text-sm">
                      <span className="text-red-700 dark:text-red-300 truncate">{produto.nome}</span>
                      <span className="font-medium text-red-600 shrink-0 ml-2">
                        {formatCurrency(produto.lucro)}/un
                      </span>
                    </div>
                  ))}
                  {produtosMargemNegativa.length > 3 && (
                    <p className="text-xs text-red-500">
                      +{produtosMargemNegativa.length - 3} outros produtos
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 text-red-700 hover:text-red-800 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900 p-0"
                  onClick={() => navigate('/precificacao')}
                >
                  Revisar preços
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Impacto dos Apps de Delivery */}
        {impactoApps.length > 0 && impactoApps.some(app => app.taxaTotal > 0) && (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                <Truck className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                    📱 Impacto dos apps de delivery
                  </h4>
                </div>
                <div className="mt-2 space-y-2">
                  {impactoApps
                    .filter(app => app.taxaTotal > 0)
                    .sort((a, b) => b.taxaTotal - a.taxaTotal)
                    .slice(0, 3)
                    .map((app) => (
                      <div key={app.nome} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-700 dark:text-amber-300 font-medium">{app.nome}</span>
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            ({app.vendas} {app.vendas === 1 ? 'venda' : 'vendas'})
                          </span>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="font-medium text-amber-600">
                            -{formatCurrency(app.taxaTotal)}
                          </span>
                          {lucroTotal > 0 && app.percentualLucro > 0 && (
                            <span className="text-xs text-amber-500 ml-1">
                              ({app.percentualLucro.toFixed(0)}% do lucro)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
                {impactoApps.reduce((sum, app) => sum + app.taxaTotal, 0) > 0 && (
                  <div className="mt-3 pt-2 border-t border-amber-200 dark:border-amber-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-700 dark:text-amber-300">Total em taxas:</span>
                      <span className="font-bold text-amber-600">
                        -{formatCurrency(impactoApps.reduce((sum, app) => sum + app.taxaTotal, 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardInsights;
