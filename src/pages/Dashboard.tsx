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
  Receipt,
} from 'lucide-react';
import { format, subDays, startOfMonth, startOfWeek, differenceInDays, getDaysInMonth } from 'date-fns';
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
  const totalVendas = vendas?.length || 0;
  const ticketMedio = totalVendas > 0 ? receitaBruta / totalVendas : 0;
  
  // Ticket médio por canal
  const ticketPorCanal = React.useMemo(() => {
    if (!vendas || vendas.length === 0) return [];
    
    const porCanal: Record<string, { total: number; quantidade: number }> = {};
    
    vendas.forEach((venda) => {
      const canal = venda.canal || 'Direto';
      if (!porCanal[canal]) {
        porCanal[canal] = { total: 0, quantidade: 0 };
      }
      porCanal[canal].total += Number(venda.valor_total);
      porCanal[canal].quantidade += 1;
    });
    
    return Object.entries(porCanal)
      .map(([canal, dados]) => ({
        canal: canal.charAt(0).toUpperCase() + canal.slice(1),
        ticketMedio: dados.quantidade > 0 ? dados.total / dados.quantidade : 0,
        quantidade: dados.quantidade,
      }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [vendas]);
  
  const cmvTotal = vendas?.reduce((sum, venda) => {
    if (!venda.produtos?.fichas_tecnicas) return sum;
    const custoUnitario = venda.produtos.fichas_tecnicas.reduce((s, ft) => {
      return s + (Number(ft.quantidade) * Number(ft.insumos?.custo_unitario || 0));
    }, 0);
    return sum + (custoUnitario * Number(venda.quantidade));
  }, 0) || 0;

  const cmvPercent = receitaBruta > 0 ? (cmvTotal / receitaBruta) * 100 : 0;
  const margemContribuicao = receitaBruta - cmvTotal;
  
  const custoFixoMensal = custosFixos?.reduce((sum, c) => sum + Number(c.valor_mensal), 0) || 0;
  
  // Calcular custo fixo proporcional ao período
  const calcularCustoFixoProporcional = () => {
    const hoje = new Date();
    const diasNoMes = getDaysInMonth(hoje);
    const custoDiario = custoFixoMensal / diasNoMes;
    
    switch (periodo) {
      case 'hoje':
        return custoDiario;
      case 'semana': {
        const inicioSemana = startOfWeek(hoje, { locale: ptBR });
        const diasNaSemana = differenceInDays(hoje, inicioSemana) + 1;
        return custoDiario * diasNaSemana;
      }
      case 'mes': {
        const inicioMes = startOfMonth(hoje);
        const diasNoMesAtual = differenceInDays(hoje, inicioMes) + 1;
        return custoDiario * diasNoMesAtual;
      }
      case 'ultimos30':
        return custoFixoMensal; // 30 dias ≈ 1 mês
      default:
        return custoFixoMensal;
    }
  };
  
  const custoFixoTotal = calcularCustoFixoProporcional();
  const impostoPercent = config?.imposto_medio_sobre_vendas ?? 10;
  const impostos = receitaBruta * (impostoPercent / 100);
  
  // Fetch taxas por app
  const { data: taxasApps } = useQuery({
    queryKey: ['taxas_apps', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taxas_apps')
        .select('nome_app, taxa_percentual')
        .eq('ativo', true);
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Taxa do app de delivery (aplicada por canal)
  const taxaAppTotal = vendas?.reduce((total, venda) => {
    if (!venda.canal) return total;
    const canalLower = venda.canal.toLowerCase();
    const taxaApp = taxasApps?.find(t => 
      t.nome_app && (canalLower.includes(t.nome_app.toLowerCase()) || 
      t.nome_app.toLowerCase().includes(canalLower))
    );
    if (taxaApp) {
      return total + (Number(venda.valor_total) * Number(taxaApp.taxa_percentual) / 100);
    }
    return total;
  }, 0) || 0;
  
  const lucroEstimado = margemContribuicao - custoFixoTotal - impostos - taxaAppTotal;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const isLoading = loadingVendas || loadingCustos;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Visão geral do seu negócio</p>
        </div>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoType)}>
          <SelectTrigger className="w-full sm:w-[180px] h-9 sm:h-10">
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

      {/* KPIs - empilhados verticalmente no mobile */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 animate-fade-in">
        <Card className="p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-medium">Receita Bruta</CardTitle>
            <div className="h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 sm:h-4 sm:w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl sm:text-2xl font-bold">{formatCurrency(receitaBruta)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-medium">Ticket Médio</CardTitle>
            <div className="h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Receipt className="h-5 w-5 sm:h-4 sm:w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl sm:text-2xl font-bold">{formatCurrency(ticketMedio)}</div>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  {totalVendas} {totalVendas === 1 ? 'venda' : 'vendas'} no período
                </p>
                {ticketPorCanal.length > 0 && (
                  <div className="pt-2 border-t overflow-hidden">
                    <table className="w-full text-xs table-fixed">
                      <tbody>
                        {ticketPorCanal.map((item) => (
                          <tr key={item.canal}>
                            <td className="text-muted-foreground py-0.5 truncate max-w-[60px] overflow-hidden">{item.canal}</td>
                            <td className="text-right font-medium py-0.5 whitespace-nowrap">{formatCurrency(item.ticketMedio)}</td>
                            <td className="text-right text-muted-foreground py-0.5 w-8 whitespace-nowrap">({item.quantidade})</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-medium">CMV</CardTitle>
            <div className="h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Percent className="h-5 w-5 sm:h-4 sm:w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl sm:text-2xl font-bold">{cmvPercent.toFixed(1)}%</div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {formatCurrency(cmvTotal)} em insumos
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-medium">Margem de Contribuição</CardTitle>
            <div className="h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 sm:h-4 sm:w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl sm:text-2xl font-bold">{formatCurrency(margemContribuicao)}</div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {receitaBruta > 0 ? ((margemContribuicao / receitaBruta) * 100).toFixed(1) : 0}% da receita
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-medium">Lucro Estimado</CardTitle>
            <div className={`h-10 w-10 sm:h-8 sm:w-8 rounded-full flex items-center justify-center ${lucroEstimado >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
              {lucroEstimado >= 0 ? (
                <TrendingUp className="h-5 w-5 sm:h-4 sm:w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 sm:h-4 sm:w-4 text-destructive" />
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className={`text-2xl sm:text-2xl font-bold ${lucroEstimado >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {formatCurrency(lucroEstimado)}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Custos fixos proporcionais ({formatCurrency(custoFixoTotal)}){impostos > 0 ? `, impostos (${formatCurrency(impostos)})` : ''}{taxaAppTotal > 0 ? `, taxas (${formatCurrency(taxaAppTotal)})` : ''}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 animate-fade-in">
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
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg gap-2 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
                      <span className="text-sm sm:text-lg font-bold text-muted-foreground shrink-0">
                        #{index + 1}
                      </span>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="font-medium truncate text-sm sm:text-base">{produto.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {produto.quantidade}x vendidos
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-green-600 text-sm sm:text-base whitespace-nowrap">
                        {formatCurrency(produto.lucro)}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
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
                {insumosAlerta.slice(0, 5).map((insumo, index) => (
                  <div
                    key={insumo.id}
                    className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg gap-2 overflow-hidden"
                  >
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="font-medium truncate text-sm">{insumo.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Mín: {insumo.estoque_minimo} {insumo.unidade_medida}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-amber-600 text-sm whitespace-nowrap">
                        {Number(insumo.estoque_atual).toFixed(1)} {insumo.unidade_medida}
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
