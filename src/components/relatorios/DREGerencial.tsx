import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyBRL } from '@/lib/format';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, DollarSign, MinusCircle, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DREGerencialProps {
  onBack: () => void;
}

interface WaterfallDataItem {
  name: string;
  valor: number;
  fill: string;
  isTotal?: boolean;
  isSubtraction?: boolean;
}

export const DREGerencial: React.FC<DREGerencialProps> = ({ onBack }) => {
  const { usuario } = useAuth();
  const [periodoMeses, setPeriodoMeses] = useState('1');

  // Calcular datas baseado no período selecionado
  const { dataInicio, dataFim } = useMemo(() => {
    const meses = parseInt(periodoMeses);
    const hoje = new Date();
    const fim = endOfMonth(hoje);
    const inicio = startOfMonth(subMonths(hoje, meses - 1));
    return {
      dataInicio: format(inicio, 'yyyy-MM-dd'),
      dataFim: format(fim, 'yyyy-MM-dd'),
    };
  }, [periodoMeses]);

  // Buscar vendas do período
  const { data: vendas, isLoading: loadingVendas } = useQuery({
    queryKey: ['dre-vendas', usuario?.empresa_id, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select('id, valor_total, quantidade, produto_id, canal')
        .eq('empresa_id', usuario?.empresa_id)
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim);

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar produtos com fichas técnicas para calcular CMV
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ['dre-produtos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select(`
          id,
          preco_venda,
          fichas_tecnicas (
            quantidade,
            insumos (
              custo_unitario
            )
          )
        `)
        .eq('empresa_id', usuario?.empresa_id);

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar configurações
  const { data: config } = useQuery({
    queryKey: ['dre-config', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('imposto_medio_sobre_vendas, taxa_app_delivery')
        .eq('empresa_id', usuario?.empresa_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar custos fixos
  const { data: custosFixos } = useQuery({
    queryKey: ['dre-custos-fixos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custos_fixos')
        .select('valor_mensal')
        .eq('empresa_id', usuario?.empresa_id);

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar canais com taxas
  const { data: canais } = useQuery({
    queryKey: ['dre-canais', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('canais_venda')
        .select(`
          id,
          nome,
          taxas_canais (
            percentual
          )
        `)
        .eq('empresa_id', usuario?.empresa_id)
        .eq('ativo', true);

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Calcular DRE
  const dre = useMemo(() => {
    if (!vendas || !produtos) return null;

    const meses = parseInt(periodoMeses);

    // Receita Bruta
    const receitaBruta = vendas.reduce((acc, v) => acc + (v.valor_total || 0), 0);

    // CMV - Custo dos Materiais Vendidos
    let cmvTotal = 0;
    vendas.forEach((venda) => {
      const produto = produtos.find((p) => p.id === venda.produto_id);
      if (produto && produto.fichas_tecnicas) {
        const custoUnitario = produto.fichas_tecnicas.reduce((acc, ft) => {
          return acc + (ft.quantidade * (ft.insumos?.custo_unitario || 0));
        }, 0);
        // Calcular quantidade vendida baseado no valor
        const qtdVendida = produto.preco_venda > 0 
          ? venda.valor_total / produto.preco_venda 
          : venda.quantidade;
        cmvTotal += custoUnitario * qtdVendida;
      }
    });

    // Taxas de Apps (baseado no canal de cada venda)
    let taxasApps = 0;
    vendas.forEach((venda) => {
      const canal = canais?.find((c) => c.nome.toLowerCase() === venda.canal?.toLowerCase());
      if (canal && canal.taxas_canais && canal.taxas_canais.length > 0) {
        const taxaTotal = canal.taxas_canais.reduce((acc, t) => acc + t.percentual, 0);
        taxasApps += (venda.valor_total * taxaTotal) / 100;
      }
    });

    // Custos Variáveis = CMV + Taxas
    const custosVariaveis = cmvTotal + taxasApps;

    // Margem de Contribuição
    const margemContribuicao = receitaBruta - custosVariaveis;

    // Custos Fixos (proporcional ao período)
    const totalCustosFixosMensal = custosFixos?.reduce((acc, cf) => acc + cf.valor_mensal, 0) || 0;
    const totalCustosFixosPeriodo = totalCustosFixosMensal * meses;

    // Impostos estimados
    const percentualImposto = config?.imposto_medio_sobre_vendas || 0;
    const impostos = (receitaBruta * percentualImposto) / 100;

    // Lucro Líquido
    const lucroLiquido = margemContribuicao - totalCustosFixosPeriodo - impostos;

    // Percentuais
    const percCMV = receitaBruta > 0 ? (cmvTotal / receitaBruta) * 100 : 0;
    const percTaxas = receitaBruta > 0 ? (taxasApps / receitaBruta) * 100 : 0;
    const percMargemContribuicao = receitaBruta > 0 ? (margemContribuicao / receitaBruta) * 100 : 0;
    const percCustosFixos = receitaBruta > 0 ? (totalCustosFixosPeriodo / receitaBruta) * 100 : 0;
    const percImpostos = receitaBruta > 0 ? (impostos / receitaBruta) * 100 : 0;
    const percLucroLiquido = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

    return {
      receitaBruta,
      cmv: cmvTotal,
      taxasApps,
      custosVariaveis,
      margemContribuicao,
      custosFixos: totalCustosFixosPeriodo,
      impostos,
      lucroLiquido,
      percentuais: {
        cmv: percCMV,
        taxas: percTaxas,
        margemContribuicao: percMargemContribuicao,
        custosFixos: percCustosFixos,
        impostos: percImpostos,
        lucroLiquido: percLucroLiquido,
      },
    };
  }, [vendas, produtos, custosFixos, config, canais, periodoMeses]);

  // Dados para gráfico cascata
  const waterfallData: WaterfallDataItem[] = useMemo(() => {
    if (!dre) return [];
    return [
      { name: 'Receita Bruta', valor: dre.receitaBruta, fill: '#10b981' },
      { name: 'CMV', valor: -dre.cmv, fill: '#ef4444', isSubtraction: true },
      { name: 'Taxas Apps', valor: -dre.taxasApps, fill: '#f97316', isSubtraction: true },
      { name: 'Margem Contrib.', valor: dre.margemContribuicao, fill: '#3b82f6', isTotal: true },
      { name: 'Custos Fixos', valor: -dre.custosFixos, fill: '#ef4444', isSubtraction: true },
      { name: 'Impostos', valor: -dre.impostos, fill: '#f97316', isSubtraction: true },
      { name: 'Lucro Líquido', valor: dre.lucroLiquido, fill: dre.lucroLiquido >= 0 ? '#10b981' : '#ef4444', isTotal: true },
    ];
  }, [dre]);

  const isLoading = loadingVendas || loadingProdutos;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const periodoLabel = periodoMeses === '1' 
    ? format(new Date(), 'MMMM yyyy', { locale: ptBR })
    : `Últimos ${periodoMeses} meses`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">DRE Gerencial</h1>
            <p className="text-muted-foreground capitalize">{periodoLabel}</p>
          </div>
        </div>
        <Select value={periodoMeses} onValueChange={setPeriodoMeses}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Mês Atual</SelectItem>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!dre || dre.receitaBruta === 0 ? (
        <Card className="p-8 text-center">
          <DollarSign className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium mb-2">Nenhuma venda no período</h3>
          <p className="text-muted-foreground">
            Registre vendas para visualizar o demonstrativo de resultados.
          </p>
        </Card>
      ) : (
        <>
          {/* Card Destaque - Lucro Líquido */}
          <Card className={dre.lucroLiquido >= 0 ? 'border-success bg-success/5' : 'border-destructive bg-destructive/5'}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Resultado do Período</p>
                  <p className={`text-3xl font-bold ${dre.lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrencyBRL(dre.lucroLiquido)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {dre.percentuais.lucroLiquido.toFixed(1)}% da receita
                  </p>
                </div>
                <div className={`p-4 rounded-full ${dre.lucroLiquido >= 0 ? 'bg-success/20' : 'bg-destructive/20'}`}>
                  {dre.lucroLiquido >= 0 ? (
                    <TrendingUp className="h-8 w-8 text-success" />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-destructive" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estrutura DRE */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Demonstrativo de Resultados
              </CardTitle>
              <CardDescription>Estrutura detalhada de receitas e custos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Receita Bruta */}
              <div className="flex justify-between items-center py-3 border-b">
                <span className="font-medium">Receita Bruta</span>
                <span className="text-lg font-bold text-success">{formatCurrencyBRL(dre.receitaBruta)}</span>
              </div>

              {/* Custos Variáveis */}
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">(-) CMV (Custo dos Materiais)</span>
                  <div className="text-right">
                    <span className="text-destructive">{formatCurrencyBRL(dre.cmv)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({dre.percentuais.cmv.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">(-) Taxas de Apps/Delivery</span>
                  <div className="text-right">
                    <span className="text-destructive">{formatCurrencyBRL(dre.taxasApps)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({dre.percentuais.taxas.toFixed(1)}%)</span>
                  </div>
                </div>
              </div>

              {/* Margem de Contribuição */}
              <div className="flex justify-between items-center py-3 bg-muted/50 px-3 rounded-lg">
                <span className="font-medium">(=) Margem de Contribuição</span>
                <div className="text-right">
                  <span className="text-lg font-bold text-primary">{formatCurrencyBRL(dre.margemContribuicao)}</span>
                  <span className="text-xs text-muted-foreground ml-2">({dre.percentuais.margemContribuicao.toFixed(1)}%)</span>
                </div>
              </div>

              {/* Custos Fixos e Impostos */}
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">(-) Custos Fixos</span>
                  <div className="text-right">
                    <span className="text-destructive">{formatCurrencyBRL(dre.custosFixos)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({dre.percentuais.custosFixos.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">(-) Impostos Estimados</span>
                  <div className="text-right">
                    <span className="text-destructive">{formatCurrencyBRL(dre.impostos)}</span>
                    <span className="text-xs text-muted-foreground ml-2">({dre.percentuais.impostos.toFixed(1)}%)</span>
                  </div>
                </div>
              </div>

              {/* Lucro Líquido */}
              <div className={`flex justify-between items-center py-4 px-3 rounded-lg ${dre.lucroLiquido >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
                <span className="font-bold text-lg">(=) Lucro Líquido</span>
                <div className="text-right">
                  <span className={`text-xl font-bold ${dre.lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrencyBRL(dre.lucroLiquido)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">({dre.percentuais.lucroLiquido.toFixed(1)}%)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico Cascata */}
          <Card>
            <CardHeader>
              <CardTitle>Visualização Gráfica</CardTitle>
              <CardDescription>Fluxo de receita para lucro</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={waterfallData} layout="vertical" margin={{ left: 100, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis 
                    type="number" 
                    tickFormatter={(value) => formatCurrencyBRL(Math.abs(value))}
                    domain={['dataMin', 'dataMax']}
                  />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrencyBRL(Math.abs(value)), value < 0 ? 'Dedução' : 'Valor']}
                  />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {waterfallData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                    <LabelList 
                      dataKey="valor" 
                      position="right" 
                      formatter={(value: number) => formatCurrencyBRL(Math.abs(value))}
                      style={{ fontSize: 11, fill: '#666' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
