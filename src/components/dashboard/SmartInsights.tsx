import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles,
  Trophy,
  Store,
  Tag,
  Package,
  CalendarDays,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Percent,
} from 'lucide-react';

interface Venda {
  id: string;
  valor_total: number;
  quantidade: number;
  canal: string | null;
  data_venda: string;
  produto_id: string | null;
  produto_nome?: string;
  produto_categoria?: string;
  produto_preco_venda?: number;
  custo_insumos?: number;
}

interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  categoria: string | null;
  fichas_tecnicas?: Array<{
    quantidade: number;
    insumo_id: string;
    insumos?: {
      id: string;
      nome: string;
      custo_unitario: number;
    };
  }>;
}

interface TaxaApp {
  nome_app: string;
  taxa_percentual: number;
}

interface SmartInsightsProps {
  vendas: Venda[] | null;
  produtos: Produto[] | null;
  taxasApps: TaxaApp[] | null;
  formatCurrency: (value: number) => string;
}

interface InsightData {
  type: 'categoria' | 'canal' | 'promo' | 'insumo' | 'dia';
  icon: React.ElementType;
  title: string;
  value: string;
  description: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  trend?: 'up' | 'down' | 'neutral';
  action?: {
    label: string;
    route: string;
  };
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const SmartInsights: React.FC<SmartInsightsProps> = ({
  vendas,
  produtos,
  taxasApps,
  formatCurrency,
}) => {
  const navigate = useNavigate();

  const insights = useMemo(() => {
    const result: InsightData[] = [];

    if (!vendas || vendas.length === 0) return result;

    // 1. CATEGORIA CAMPEÃ DE LUCRO
    const lucroPorCategoria: Record<string, { lucro: number; receita: number; quantidade: number }> = {};
    
    vendas.forEach((venda) => {
      const categoria = venda.produto_categoria || 'Sem categoria';
      const custoUnitario = Number(venda.custo_insumos) || 0;
      const precoVenda = Number(venda.produto_preco_venda) || 0;
      const valorTotal = Number(venda.valor_total) || 0;
      
      let unidadesReais = Number(venda.quantidade) || 1;
      if (precoVenda > 0) {
        unidadesReais = valorTotal / precoVenda;
      }
      
      const lucroVenda = valorTotal - (custoUnitario * unidadesReais);
      
      if (!lucroPorCategoria[categoria]) {
        lucroPorCategoria[categoria] = { lucro: 0, receita: 0, quantidade: 0 };
      }
      lucroPorCategoria[categoria].lucro += lucroVenda;
      lucroPorCategoria[categoria].receita += valorTotal;
      lucroPorCategoria[categoria].quantidade += unidadesReais;
    });

    const categoriasOrdenadas = Object.entries(lucroPorCategoria)
      .filter(([_, dados]) => dados.lucro > 0)
      .sort((a, b) => b[1].lucro - a[1].lucro);

    if (categoriasOrdenadas.length > 0) {
      const [categoriaCampea, dados] = categoriasOrdenadas[0];
      const lucroTotal = Object.values(lucroPorCategoria).reduce((sum, d) => sum + Math.max(0, d.lucro), 0);
      const percentual = lucroTotal > 0 ? (dados.lucro / lucroTotal) * 100 : 0;
      
      result.push({
        type: 'categoria',
        icon: Trophy,
        title: 'Categoria campeã',
        value: categoriaCampea,
        description: `Representou ${percentual.toFixed(0)}% do lucro total do período`,
        badge: formatCurrency(dados.lucro),
        badgeVariant: 'default',
        trend: 'up',
        action: { label: 'Ver relatórios', route: '/relatorios' },
      });
    }

    // 2. CANAL MAIS RENTÁVEL (considerando taxas)
    const lucroPorCanal: Record<string, { lucro: number; receita: number; vendas: number; taxa: number }> = {};
    
    vendas.forEach((venda) => {
      const canal = venda.canal || 'Balcão';
      const canalLower = canal.toLowerCase();
      const custoUnitario = Number(venda.custo_insumos) || 0;
      const precoVenda = Number(venda.produto_preco_venda) || 0;
      const valorTotal = Number(venda.valor_total) || 0;
      
      let unidadesReais = Number(venda.quantidade) || 1;
      if (precoVenda > 0) {
        unidadesReais = valorTotal / precoVenda;
      }
      
      // Encontrar taxa do app
      const taxaApp = taxasApps?.find(t => 
        t.nome_app && (canalLower.includes(t.nome_app.toLowerCase()) || 
        t.nome_app.toLowerCase().includes(canalLower))
      );
      const taxaValor = taxaApp ? (valorTotal * Number(taxaApp.taxa_percentual) / 100) : 0;
      
      const lucroVenda = valorTotal - (custoUnitario * unidadesReais) - taxaValor;
      
      if (!lucroPorCanal[canal]) {
        lucroPorCanal[canal] = { lucro: 0, receita: 0, vendas: 0, taxa: 0 };
      }
      lucroPorCanal[canal].lucro += lucroVenda;
      lucroPorCanal[canal].receita += valorTotal;
      lucroPorCanal[canal].vendas += 1;
      lucroPorCanal[canal].taxa += taxaValor;
    });

    const canaisOrdenados = Object.entries(lucroPorCanal)
      .filter(([_, dados]) => dados.receita > 0)
      .map(([canal, dados]) => ({
        canal,
        ...dados,
        margem: dados.receita > 0 ? (dados.lucro / dados.receita) * 100 : 0,
      }))
      .sort((a, b) => b.margem - a.margem);

    if (canaisOrdenados.length > 0) {
      const melhorCanal = canaisOrdenados[0];
      const piorCanal = canaisOrdenados[canaisOrdenados.length - 1];
      
      result.push({
        type: 'canal',
        icon: Store,
        title: 'Canal mais rentável',
        value: melhorCanal.canal,
        description: `Margem de ${melhorCanal.margem.toFixed(0)}%${canaisOrdenados.length > 1 && piorCanal.margem < melhorCanal.margem ? ` (${piorCanal.canal}: ${piorCanal.margem.toFixed(0)}%)` : ''}`,
        badge: `${melhorCanal.vendas} vendas`,
        badgeVariant: 'secondary',
        trend: 'up',
        action: { label: 'Ver por canal', route: '/relatorios' },
      });
    }

    // 3. PRODUTO IDEAL PARA PROMOÇÃO (alta margem + baixa saída)
    if (produtos && produtos.length > 0) {
      const produtosComMargem = produtos.map((produto) => {
        const custoInsumos = produto.fichas_tecnicas?.reduce((sum, ft) => {
          return sum + (Number(ft.quantidade) * Number(ft.insumos?.custo_unitario || 0));
        }, 0) || 0;
        
        const margem = produto.preco_venda > 0 
          ? ((produto.preco_venda - custoInsumos) / produto.preco_venda) * 100 
          : 0;
        
        // Contar vendas deste produto
        const vendasProduto = vendas?.filter(v => v.produto_id === produto.id).length || 0;
        
        return {
          ...produto,
          custoInsumos,
          margem,
          vendasProduto,
        };
      });

      // Produtos com boa margem (>30%) mas poucas vendas
      const candidatosPromo = produtosComMargem
        .filter(p => p.margem >= 30 && p.custoInsumos > 0)
        .sort((a, b) => {
          // Priorizar alta margem e baixa saída
          const scoreA = a.margem - (a.vendasProduto * 10);
          const scoreB = b.margem - (b.vendasProduto * 10);
          return scoreB - scoreA;
        });

      if (candidatosPromo.length > 0) {
        const produtoPromo = candidatosPromo[0];
        result.push({
          type: 'promo',
          icon: Tag,
          title: 'Ideal para promoção',
          value: produtoPromo.nome,
          description: `Margem de ${produtoPromo.margem.toFixed(0)}% com ${produtoPromo.vendasProduto === 0 ? 'nenhuma venda' : `apenas ${produtoPromo.vendasProduto} venda${produtoPromo.vendasProduto > 1 ? 's' : ''}`}`,
          badge: 'Alta margem',
          badgeVariant: 'outline',
          trend: 'neutral',
          action: { label: 'Ver precificação', route: '/precificacao' },
        });
      }
    }

    // 4. INSUMO VILÃO (maior custo total no período)
    const custoPorInsumo: Record<string, { nome: string; custoTotal: number; quantidade: number }> = {};
    
    vendas.forEach((venda) => {
      if (!venda.produto_id) return;
      
      const produto = produtos?.find(p => p.id === venda.produto_id);
      if (!produto?.fichas_tecnicas) return;
      
      const precoVenda = Number(venda.produto_preco_venda) || 0;
      const valorTotal = Number(venda.valor_total) || 0;
      
      let unidadesReais = Number(venda.quantidade) || 1;
      if (precoVenda > 0) {
        unidadesReais = valorTotal / precoVenda;
      }
      
      produto.fichas_tecnicas.forEach((ft) => {
        if (!ft.insumos) return;
        const insumoId = ft.insumo_id;
        const custoUso = Number(ft.quantidade) * Number(ft.insumos.custo_unitario) * unidadesReais;
        
        if (!custoPorInsumo[insumoId]) {
          custoPorInsumo[insumoId] = { 
            nome: ft.insumos.nome, 
            custoTotal: 0, 
            quantidade: 0 
          };
        }
        custoPorInsumo[insumoId].custoTotal += custoUso;
        custoPorInsumo[insumoId].quantidade += Number(ft.quantidade) * unidadesReais;
      });
    });

    const insumosOrdenados = Object.entries(custoPorInsumo)
      .sort((a, b) => b[1].custoTotal - a[1].custoTotal);

    if (insumosOrdenados.length > 0) {
      const [_, insumoVilao] = insumosOrdenados[0];
      const custoTotalInsumos = Object.values(custoPorInsumo).reduce((sum, i) => sum + i.custoTotal, 0);
      const percentual = custoTotalInsumos > 0 ? (insumoVilao.custoTotal / custoTotalInsumos) * 100 : 0;
      
      result.push({
        type: 'insumo',
        icon: Package,
        title: 'Insumo que mais pesa',
        value: insumoVilao.nome,
        description: `Representou ${percentual.toFixed(0)}% do custo total de insumos`,
        badge: formatCurrency(insumoVilao.custoTotal),
        badgeVariant: 'destructive',
        trend: 'down',
        action: { label: 'Ver insumos', route: '/insumos' },
      });
    }

    // 5. MELHOR DIA DA SEMANA
    const vendasPorDia: Record<number, { vendas: number; receita: number }> = {};
    
    vendas.forEach((venda) => {
      const data = new Date(venda.data_venda + 'T12:00:00');
      const diaSemana = data.getDay();
      
      if (!vendasPorDia[diaSemana]) {
        vendasPorDia[diaSemana] = { vendas: 0, receita: 0 };
      }
      vendasPorDia[diaSemana].vendas += 1;
      vendasPorDia[diaSemana].receita += Number(venda.valor_total);
    });

    const diasOrdenados = Object.entries(vendasPorDia)
      .sort((a, b) => b[1].receita - a[1].receita);

    if (diasOrdenados.length > 1) {
      const [melhorDiaNum, melhorDiaDados] = diasOrdenados[0];
      const melhorDia = DIAS_SEMANA[Number(melhorDiaNum)];
      const totalReceita = Object.values(vendasPorDia).reduce((sum, d) => sum + d.receita, 0);
      const percentual = totalReceita > 0 ? (melhorDiaDados.receita / totalReceita) * 100 : 0;
      
      result.push({
        type: 'dia',
        icon: CalendarDays,
        title: 'Melhor dia da semana',
        value: melhorDia,
        description: `Concentrou ${percentual.toFixed(0)}% do faturamento`,
        badge: `${melhorDiaDados.vendas} vendas`,
        badgeVariant: 'secondary',
        trend: 'up',
        action: { label: 'Ver vendas', route: '/vendas' },
      });
    }

    return result;
  }, [vendas, produtos, taxasApps, formatCurrency]);

  if (insights.length === 0) {
    return null;
  }

  return (
    <Card className="animate-fade-in border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Smart Insights
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Análises automáticas baseadas nos seus dados
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, index) => (
          <div
            key={insight.type}
            className="p-4 rounded-lg bg-card border border-border/50 hover:border-border transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                insight.trend === 'up' ? 'bg-green-100 dark:bg-green-900/30' :
                insight.trend === 'down' ? 'bg-amber-100 dark:bg-amber-900/30' :
                'bg-primary/10'
              }`}>
                <insight.icon className={`h-5 w-5 ${
                  insight.trend === 'up' ? 'text-green-600' :
                  insight.trend === 'down' ? 'text-amber-600' :
                  'text-primary'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {insight.title}
                  </span>
                  {insight.badge && (
                    <Badge variant={insight.badgeVariant} className="text-xs">
                      {insight.badge}
                    </Badge>
                  )}
                </div>
                <p className="font-semibold text-foreground mt-0.5 truncate">
                  {insight.value}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {insight.description}
                </p>
                {insight.action && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 px-0 text-primary hover:text-primary/80 hover:bg-transparent"
                    onClick={() => navigate(insight.action!.route)}
                  >
                    {insight.action.label}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
              <div className="shrink-0">
                {insight.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                {insight.trend === 'down' && <TrendingDown className="h-4 w-4 text-amber-500" />}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default SmartInsights;
