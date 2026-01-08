import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { format, subDays, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type PeriodoType = 'hoje' | 'semana' | 'mes' | 'ultimos30';

const Dashboard = () => {
  const { usuario } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoType>('mes');

  const getDateRange = () => {
    const hoje = new Date();
    switch (periodo) {
      case 'hoje':
        return { inicio: format(hoje, 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') };
      case 'semana':
        return { inicio: format(startOfWeek(hoje, { locale: ptBR }), 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') };
      case 'mes':
        return { inicio: format(startOfMonth(hoje), 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') };
      case 'ultimos30':
        return { inicio: format(subDays(hoje, 30), 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') };
      default:
        return { inicio: format(startOfMonth(hoje), 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') };
    }
  };

  const { inicio, fim } = getDateRange();

  // Fetch vendas do período
  const { data: vendas, isLoading: loadingVendas } = useQuery({
    queryKey: ['vendas-dashboard', usuario?.empresa_id, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select(`
          *,
          produtos (
            id,
            nome,
            preco_venda,
            fichas_tecnicas (
              quantidade,
              insumos (
                custo_unitario
              )
            )
          )
        `)
        .gte('data_venda', inicio)
        .lte('data_venda', fim);

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch custos fixos
  const { data: custosFixos, isLoading: loadingCustos } = useQuery({
    queryKey: ['custos-fixos-dashboard', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custos_fixos')
        .select('*');

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch configurações
  const { data: config } = useQuery({
    queryKey: ['config-dashboard', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch insumos com estoque baixo
  const { data: insumosAlerta } = useQuery({
    queryKey: ['insumos-alerta', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .filter('estoque_atual', 'lt', supabase.rpc as unknown as number);

      // Workaround: fetch all and filter client-side
      const { data: allInsumos, error: err } = await supabase
        .from('insumos')
        .select('*');

      if (err) throw err;
      return allInsumos?.filter(i => Number(i.estoque_atual) <= Number(i.estoque_minimo)) || [];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch top produtos
  const { data: topProdutos, isLoading: loadingTop } = useQuery({
    queryKey: ['top-produtos', usuario?.empresa_id, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select(`
          produto_id,
          quantidade,
          valor_total,
          produtos (
            nome,
            preco_venda,
            fichas_tecnicas (
              quantidade,
              insumos (custo_unitario)
            )
          )
        `)
        .gte('data_venda', inicio)
        .lte('data_venda', fim)
        .not('produto_id', 'is', null);

      if (error) throw error;

      // Agrupar por produto e calcular lucro
      const grouped = (data || []).reduce((acc, venda) => {
        if (!venda.produto_id || !venda.produtos) return acc;
        
        const produtoId = venda.produto_id;
        if (!acc[produtoId]) {
          acc[produtoId] = {
            nome: venda.produtos.nome,
            receita: 0,
            custo: 0,
            quantidade: 0,
          };
        }
        
        acc[produtoId].receita += Number(venda.valor_total);
        acc[produtoId].quantidade += Number(venda.quantidade);
        
        // Calcular custo dos insumos
        const custoUnitario = (venda.produtos.fichas_tecnicas || []).reduce((sum, ft) => {
          return sum + (Number(ft.quantidade) * Number(ft.insumos?.custo_unitario || 0));
        }, 0);
        acc[produtoId].custo += custoUnitario * Number(venda.quantidade);
        
        return acc;
      }, {} as Record<string, { nome: string; receita: number; custo: number; quantidade: number }>);

      return Object.values(grouped)
        .map(p => ({ ...p, lucro: p.receita - p.custo }))
        .sort((a, b) => b.lucro - a.lucro)
        .slice(0, 5);
    },
    enabled: !!usuario?.empresa_id,
  });

  // Cálculos
  const receitaBruta = vendas?.reduce((sum, v) => sum + Number(v.valor_total), 0) || 0;
  
  const cmvTotal = vendas?.reduce((sum, venda) => {
    if (!venda.produtos?.fichas_tecnicas) return sum;
    const custoUnitario = venda.produtos.fichas_tecnicas.reduce((s, ft) => {
      return s + (Number(ft.quantidade) * Number(ft.insumos?.custo_unitario || 0));
    }, 0);
    return sum + (custoUnitario * Number(venda.quantidade));
  }, 0) || 0;

  const cmvPercent = receitaBruta > 0 ? (cmvTotal / receitaBruta) * 100 : 0;
  const margemContribuicao = receitaBruta - cmvTotal;
  
  const custoFixoTotal = custosFixos?.reduce((sum, c) => sum + Number(c.valor_mensal), 0) || 0;
  const impostoPercent = config?.imposto_medio_sobre_vendas || 10;
  const impostos = receitaBruta * (impostoPercent / 100);
  
  const lucroEstimado = margemContribuicao - custoFixoTotal - impostos;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const isLoading = loadingVendas || loadingCustos;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do seu negócio</p>
        </div>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoType)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Selecione o período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="semana">Esta semana</SelectItem>
            <SelectItem value="mes">Este mês</SelectItem>
            <SelectItem value="ultimos30">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Bruta</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(receitaBruta)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CMV</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{cmvPercent.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(cmvTotal)} em insumos
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem de Contribuição</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(margemContribuicao)}</div>
                <p className="text-xs text-muted-foreground">
                  {receitaBruta > 0 ? ((margemContribuicao / receitaBruta) * 100).toFixed(1) : 0}% da receita
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Estimado</CardTitle>
            {lucroEstimado >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${lucroEstimado >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {formatCurrency(lucroEstimado)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Após custos fixos e impostos
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top 5 Produtos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Top 5 Produtos por Lucro
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTop ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : topProdutos && topProdutos.length > 0 ? (
              <div className="space-y-3">
                {topProdutos.map((produto, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{produto.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {produto.quantidade} vendidos
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        {formatCurrency(produto.lucro)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(produto.receita)} receita
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma venda no período
              </p>
            )}
          </CardContent>
        </Card>

        {/* Alertas de Estoque */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Alertas de Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insumosAlerta && insumosAlerta.length > 0 ? (
              <div className="space-y-3">
                {insumosAlerta.slice(0, 5).map((insumo) => (
                  <div
                    key={insumo.id}
                    className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{insumo.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        Mínimo: {insumo.estoque_minimo} {insumo.unidade_medida}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-amber-600">
                        {Number(insumo.estoque_atual).toFixed(2)} {insumo.unidade_medida}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Todos os insumos com estoque adequado 👍
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
