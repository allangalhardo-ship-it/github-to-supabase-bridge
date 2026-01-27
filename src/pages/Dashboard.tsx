import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePrecosCanais } from '@/hooks/usePrecosCanais';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedCardContainer, StaggeredCard } from '@/components/ui/animated-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DashboardInsights } from '@/components/dashboard/DashboardInsights';
import { SmartInsights } from '@/components/dashboard/SmartInsights';
import { PontoEquilibrioCard } from '@/components/dashboard/PontoEquilibrioCard';
import { BusinessCoach } from '@/components/dashboard/BusinessCoach';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent,
  Package,
  AlertTriangle,
  Receipt,
  HelpCircle,
  ChevronDown,
  Lightbulb,
} from 'lucide-react';
import { format, subDays, startOfMonth, startOfWeek, differenceInDays, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrencyBRL } from '@/lib/format';

type PeriodoType = 'hoje' | 'semana' | 'mes' | 'ultimos30';

const Dashboard = () => {
  const { usuario } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoType>('mes');
  const [showSmartInsights, setShowSmartInsights] = useState(true);

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

  // Fetch nome da empresa
  const { data: empresa } = useQuery({
    queryKey: ['empresa-nome', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('nome')
        .eq('id', usuario?.empresa_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 30 * 60 * 1000, // 30 minutos - nome da empresa raramente muda
  });

  // Fetch vendas do período usando função otimizada
  const { data: vendas, isLoading: loadingVendas } = useQuery({
    queryKey: ['vendas-dashboard', usuario?.empresa_id, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_dashboard_vendas', {
          p_empresa_id: usuario?.empresa_id,
          p_data_inicio: inicio,
          p_data_fim: fim,
        });

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 2 * 60 * 1000, // 2 minutos - dados do dashboard podem ser ligeiramente atrasados
    gcTime: 10 * 60 * 1000, // 10 minutos em cache
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

  // Fetch insumos com estoque baixo usando função otimizada
  const { data: insumosAlerta } = useQuery({
    queryKey: ['insumos-alerta', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_insumos_estoque_baixo', {
          p_empresa_id: usuario?.empresa_id,
        });

      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 15 * 60 * 1000,
  });

  // Fetch top produtos usando função otimizada
  const { data: topProdutos, isLoading: loadingTop } = useQuery({
    queryKey: ['top-produtos', usuario?.empresa_id, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_top_produtos', {
          p_empresa_id: usuario?.empresa_id,
          p_data_inicio: inicio,
          p_data_fim: fim,
          p_limit: 5,
        });

      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch todos os produtos com fichas técnicas para análise de margem
  const { data: produtosAnalise } = useQuery({
    queryKey: ['produtos-analise', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select(`
          id,
          nome,
          preco_venda,
          categoria,
          fichas_tecnicas (
            quantidade,
            insumo_id,
            insumos (
              id,
              nome,
              custo_unitario
            )
          )
        `)
        .eq('ativo', true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch histórico de preços de insumos (últimos 30 dias)
  const { data: historicoPrecos } = useQuery({
    queryKey: ['historico-precos-dashboard', usuario?.empresa_id],
    queryFn: async () => {
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
      
      const { data, error } = await supabase
        .from('historico_precos')
        .select(`
          insumo_id,
          preco_anterior,
          preco_novo,
          variacao_percentual,
          created_at,
          insumos (
            nome
          )
        `)
        .gte('created_at', trintaDiasAtras.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 5 * 60 * 1000,
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
  
  // Cálculo do CMV: custo dos insumos proporcional ao valor vendido
  // Agora usando dados pré-calculados da função get_dashboard_vendas
  const cmvTotal = vendas?.reduce((sum, venda) => {
    if (!venda.custo_insumos) return sum;
    
    // Custo de insumos para produzir 1 unidade do produto
    const custoUnitarioProduto = Number(venda.custo_insumos) || 0;
    
    // Calculamos quantas unidades reais foram vendidas baseado no valor
    const precoVendaProduto = Number(venda.produto_preco_venda) || 0;
    const valorTotal = Number(venda.valor_total) || 0;
    
    let unidadesReais: number;
    if (precoVendaProduto > 0) {
      unidadesReais = valorTotal / precoVendaProduto;
    } else {
      unidadesReais = Number(venda.quantidade);
    }
    
    return sum + (custoUnitarioProduto * unidadesReais);
  }, 0) || 0;

  const cmvPercent = receitaBruta > 0 ? (cmvTotal / receitaBruta) * 100 : 0;
  const margemContribuicao = receitaBruta - cmvTotal;
  
  const custoFixoMensal = custosFixos?.reduce((sum, c) => sum + Number(c.valor_mensal), 0) || 0;
  const faturamentoMensal = config?.faturamento_mensal || 0;
  const percentualCustoFixo = faturamentoMensal > 0 ? (custoFixoMensal / faturamentoMensal) * 100 : 0;

  // Calcular custo fixo para o período
  // REGRA: Custo fixo é FIXO - se não cobrir, está no prejuízo
  const calcularCustoFixoPeriodo = () => {
    if (custoFixoMensal <= 0) {
      return 0;
    }
    
    const hoje = new Date();
    const diasNoMes = getDaysInMonth(hoje);
    const custoDiario = custoFixoMensal / diasNoMes;
    
    switch (periodo) {
      case 'hoje':
        // Para "hoje", mostra o custo fixo proporcional ao dia
        return custoDiario;
      case 'semana': {
        // Para "semana", mostra proporcional aos dias da semana
        const inicioSemana = startOfWeek(hoje, { locale: ptBR });
        const diasNaSemana = differenceInDays(hoje, inicioSemana) + 1;
        return custoDiario * diasNaSemana;
      }
      case 'mes':
      case 'ultimos30':
        // Para "este mês" ou "últimos 30 dias", usa o custo fixo MENSAL INTEIRO
        // Porque é o compromisso real que será pago
        return custoFixoMensal;
      default:
        return custoFixoMensal;
    }
  };
  
  const custoFixoTotal = calcularCustoFixoPeriodo();
  const impostoPercent = config?.imposto_medio_sobre_vendas ?? 10;
  const impostos = receitaBruta * (impostoPercent / 100);
  
  // Buscar canais configurados com taxas agregadas
  const { canaisConfigurados } = usePrecosCanais();

  // Taxa total aplicada por canal (usando nova estrutura de canais)
  const taxaAppTotal = vendas?.reduce((total, venda) => {
    if (!venda.canal) return total;
    const canalVenda = venda.canal.toLowerCase();
    
    // Buscar canal correspondente na nova estrutura
    const canalConfig = canaisConfigurados?.find(c => 
      c.nome.toLowerCase() === canalVenda ||
      c.id === venda.canal
    );
    
    if (canalConfig && canalConfig.taxa > 0) {
      return total + (Number(venda.valor_total) * canalConfig.taxa / 100);
    }
    return total;
  }, 0) || 0;
  
  const lucroEstimado = margemContribuicao - custoFixoTotal - impostos - taxaAppTotal;

  const formatCurrency = formatCurrencyBRL;

  // Calcular produtos com margem negativa
  const produtosMargemNegativa = useMemo(() => {
    if (!produtosAnalise) return [];

    return produtosAnalise
      .map((produto) => {
        const custoInsumos = produto.fichas_tecnicas?.reduce((sum: number, ft: any) => {
          return sum + (Number(ft.quantidade) * Number(ft.insumos?.custo_unitario || 0));
        }, 0) || 0;

        const lucro = produto.preco_venda - custoInsumos;
        const margem = produto.preco_venda > 0 ? (lucro / produto.preco_venda) * 100 : 0;

        return {
          id: produto.id,
          nome: produto.nome,
          preco_venda: produto.preco_venda,
          custo_insumos: custoInsumos,
          margem,
          lucro,
        };
      })
      .filter((p) => p.lucro < 0 && p.custo_insumos > 0);
  }, [produtosAnalise]);

  // Calcular impacto dos canais de venda (taxas)
  const impactoApps = useMemo(() => {
    if (!vendas || !canaisConfigurados) return [];

    const porCanal: Record<string, { taxaTotal: number; vendas: number }> = {};

    vendas.forEach((venda) => {
      if (!venda.canal) return;
      const canalVenda = venda.canal.toLowerCase();
      
      // Buscar canal correspondente na nova estrutura
      const canalConfig = canaisConfigurados.find(c => 
        c.nome.toLowerCase() === canalVenda ||
        c.id === venda.canal
      );

      if (canalConfig && canalConfig.taxa > 0) {
        const nomeCanal = canalConfig.nome;
        if (!porCanal[nomeCanal]) {
          porCanal[nomeCanal] = { taxaTotal: 0, vendas: 0 };
        }
        porCanal[nomeCanal].taxaTotal += (Number(venda.valor_total) * canalConfig.taxa / 100);
        porCanal[nomeCanal].vendas += 1;
      }
    });

    return Object.entries(porCanal).map(([nome, dados]) => ({
      nome,
      taxaTotal: dados.taxaTotal,
      percentualLucro: lucroEstimado > 0 ? (dados.taxaTotal / lucroEstimado) * 100 : 0,
      vendas: dados.vendas,
    }));
  }, [vendas, canaisConfigurados, lucroEstimado]);

  // Melhor produto do mês
  const melhorProduto = useMemo(() => {
    if (!topProdutos || topProdutos.length === 0) return null;

    const melhor = topProdutos[0];
    const lucro = Number(melhor.lucro || 0);
    const receita = Number(melhor.receita || 0);
    
    return {
      nome: melhor.nome,
      lucroTotal: lucro,
      quantidade: Number(melhor.quantidade || 0),
      margem: receita > 0 ? (lucro / receita) * 100 : 0,
    };
  }, [topProdutos]);

  const isLoading = loadingVendas || loadingCustos;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {empresa?.nome ? `Olá, ${empresa.nome}!` : 'Meu Negócio'}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Veja como está o seu negócio {periodo === 'hoje' ? 'hoje' : periodo === 'semana' ? 'esta semana' : periodo === 'mes' ? 'este mês' : 'nos últimos 30 dias'}
          </p>
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
      <AnimatedCardContainer className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5" staggerDelay={0.08}>
        <StaggeredCard className="p-1">
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
        </StaggeredCard>

        <StaggeredCard className="p-1">
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
        </StaggeredCard>

        <StaggeredCard className="p-1">
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
        </StaggeredCard>

        <StaggeredCard className="p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-medium">Lucro Bruto</CardTitle>
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
                  Receita - CMV ({receitaBruta > 0 ? ((margemContribuicao / receitaBruta) * 100).toFixed(1) : 0}%)
                </p>
              </>
            )}
          </CardContent>
        </StaggeredCard>

        <StaggeredCard className="p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <CardTitle className="text-sm sm:text-base font-medium cursor-help flex items-center gap-1">
                  Lucro Estimado
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </CardTitle>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-2 text-xs">
                  <p className="font-medium">Cálculo do Lucro Estimado:</p>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span>Receita Bruta</span>
                      <span className="text-green-600">+{formatCurrency(receitaBruta)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CMV (insumos)</span>
                      <span className="text-red-500">-{formatCurrency(cmvTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Custos fixos {periodo === 'mes' || periodo === 'ultimos30' ? '(mensal)' : '(proporcional)'}</span>
                      <span className="text-red-500">-{formatCurrency(custoFixoTotal)}</span>
                    </div>
                    {impostos > 0 && (
                      <div className="flex justify-between">
                        <span>Impostos ({impostoPercent}%)</span>
                        <span className="text-red-500">-{formatCurrency(impostos)}</span>
                      </div>
                    )}
                    {taxaAppTotal > 0 && (
                      <div className="flex justify-between">
                        <span>Taxas apps</span>
                        <span className="text-red-500">-{formatCurrency(taxaAppTotal)}</span>
                      </div>
                    )}
                    <div className="border-t pt-1 flex justify-between font-bold">
                      <span>Lucro Estimado</span>
                      <span className={lucroEstimado >= 0 ? 'text-green-600' : 'text-red-500'}>
                        {formatCurrency(lucroEstimado)}
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-[10px] pt-1">
                    {periodo === 'mes' || periodo === 'ultimos30' 
                      ? 'Custo fixo mensal inteiro é deduzido, pois é o compromisso real a pagar.'
                      : 'Custo fixo proporcional ao período selecionado.'}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
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
                  {lucroEstimado < 0 && margemContribuicao < custoFixoMensal ? (
                    <span className="text-destructive">Falta {formatCurrency(custoFixoMensal - margemContribuicao)} de lucro bruto p/ cobrir CF</span>
                  ) : (
                    <>CF ({formatCurrency(custoFixoTotal)}){impostos > 0 ? ` + imp. (${formatCurrency(impostos)})` : ''}{taxaAppTotal > 0 ? ` + taxas (${formatCurrency(taxaAppTotal)})` : ''}</>
                  )}
                </p>
              </>
            )}
          </CardContent>
        </StaggeredCard>
      </AnimatedCardContainer>

      {/* Ponto de Equilíbrio - Destaque principal */}
      <PontoEquilibrioCard
        receitaBruta={receitaBruta}
        margemContribuicao={margemContribuicao}
        custoFixoMensal={custoFixoMensal}
        isLoading={isLoading}
      />

      {/* Business Coach - Resumo Inteligente */}
      <BusinessCoach
        vendas={vendas as any}
        produtos={produtosAnalise as any}
        canaisConfigurados={canaisConfigurados as any}
        config={config}
        custosFixos={custosFixos as any}
        historicoPrecos={historicoPrecos as any}
        periodo={periodo}
        formatCurrency={formatCurrency}
      />

      {/* Insights Acionáveis */}
      <DashboardInsights
        produtosMargemNegativa={produtosMargemNegativa}
        impactoApps={impactoApps}
        melhorProduto={melhorProduto}
        lucroTotal={lucroEstimado}
        formatCurrency={formatCurrency}
      />

      {/* Smart Insights - Fase 1, 2 e 3 */}
      <Collapsible open={showSmartInsights} onOpenChange={setShowSmartInsights}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="flex items-center gap-2 px-0 hover:bg-transparent text-muted-foreground hover:text-foreground transition-colors"
            >
              <Lightbulb className="h-4 w-4" />
              <span className="text-sm font-medium">Smart Insights</span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showSmartInsights ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          {!showSmartInsights && (
            <span className="text-xs text-muted-foreground">
              Clique para expandir análises detalhadas
            </span>
          )}
        </div>
        <CollapsibleContent className="animate-accordion-down">
          <div className="pt-3">
            <SmartInsights
              vendas={vendas as any}
              produtos={produtosAnalise as any}
              canaisConfigurados={canaisConfigurados as any}
              config={config}
              custosFixos={custosFixos as any}
              periodo={periodo}
              formatCurrency={formatCurrency}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>


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
