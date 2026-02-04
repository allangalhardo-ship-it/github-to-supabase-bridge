import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyBRL } from '@/lib/format';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Package,
  Calendar,
  Store,
  Smartphone
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { format, subDays, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AnaliseVendasProps {
  onBack: () => void;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const AnaliseVendas: React.FC<AnaliseVendasProps> = ({ onBack }) => {
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
  const { data: vendas, isLoading } = useQuery({
    queryKey: ['analise-vendas', usuario?.empresa_id, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select(`
          id,
          valor_total,
          quantidade,
          data_venda,
          canal,
          produto_id,
          produtos (
            id,
            nome,
            categoria
          )
        `)
        .eq('empresa_id', usuario?.empresa_id)
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim)
        .order('data_venda', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Calcular análises
  const analise = useMemo(() => {
    if (!vendas || vendas.length === 0) return null;

    // Faturamento total
    const faturamentoTotal = vendas.reduce((acc, v) => acc + (v.valor_total || 0), 0);
    const totalVendas = vendas.length;
    const ticketMedio = faturamentoTotal / totalVendas;

    // Vendas por dia da semana
    const vendasPorDiaSemana = [0, 1, 2, 3, 4, 5, 6].map((dia) => {
      const vendasDoDia = vendas.filter((v) => {
        const dataVenda = parseISO(v.data_venda);
        return dataVenda.getDay() === dia;
      });
      const total = vendasDoDia.reduce((acc, v) => acc + (v.valor_total || 0), 0);
      const quantidade = vendasDoDia.length;
      return {
        dia: diasSemana[dia],
        diaCompleto: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dia],
        faturamento: total,
        quantidade,
      };
    });

    // Vendas por canal
    const canaisUnicos = [...new Set(vendas.map((v) => v.canal || 'balcao'))];
    const vendasPorCanal = canaisUnicos.map((canal) => {
      const vendasDoCanal = vendas.filter((v) => (v.canal || 'balcao') === canal);
      const total = vendasDoCanal.reduce((acc, v) => acc + (v.valor_total || 0), 0);
      const quantidade = vendasDoCanal.length;
      return {
        canal: canal.charAt(0).toUpperCase() + canal.slice(1),
        faturamento: total,
        quantidade,
        percentual: (total / faturamentoTotal) * 100,
      };
    }).sort((a, b) => b.faturamento - a.faturamento);

    // Top produtos por faturamento
    const produtosAgrupados = new Map();
    vendas.forEach((v) => {
      if (v.produtos) {
        const key = v.produto_id;
        const atual = produtosAgrupados.get(key) || {
          id: v.produto_id,
          nome: v.produtos.nome,
          categoria: v.produtos.categoria,
          faturamento: 0,
          quantidade: 0,
        };
        atual.faturamento += v.valor_total || 0;
        atual.quantidade += v.quantidade || 1;
        produtosAgrupados.set(key, atual);
      }
    });
    const topProdutosFaturamento = Array.from(produtosAgrupados.values())
      .sort((a, b) => b.faturamento - a.faturamento)
      .slice(0, 5);

    // Top produtos por quantidade
    const topProdutosQuantidade = Array.from(produtosAgrupados.values())
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);

    // Evolução diária (últimos 30 dias se período for 1 mês)
    const hoje = new Date();
    const ultimos30Dias = Array.from({ length: 30 }, (_, i) => {
      const data = subDays(hoje, 29 - i);
      const dataStr = format(data, 'yyyy-MM-dd');
      const vendasDoDia = vendas.filter((v) => v.data_venda === dataStr);
      const total = vendasDoDia.reduce((acc, v) => acc + (v.valor_total || 0), 0);
      return {
        data: format(data, 'dd/MM'),
        dataCompleta: format(data, "dd 'de' MMMM", { locale: ptBR }),
        faturamento: total,
        quantidade: vendasDoDia.length,
      };
    });

    // Melhor dia
    const melhorDia = vendasPorDiaSemana.reduce((a, b) => 
      a.faturamento > b.faturamento ? a : b
    );

    // Canal principal
    const canalPrincipal = vendasPorCanal[0];

    return {
      faturamentoTotal,
      totalVendas,
      ticketMedio,
      vendasPorDiaSemana,
      vendasPorCanal,
      topProdutosFaturamento,
      topProdutosQuantidade,
      evolucaoDiaria: ultimos30Dias,
      melhorDia,
      canalPrincipal,
    };
  }, [vendas]);

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
            <h1 className="text-2xl font-bold">Análise de Vendas</h1>
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

      {!analise ? (
        <Card className="p-8 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium mb-2">Nenhuma venda no período</h3>
          <p className="text-muted-foreground">
            Registre vendas para visualizar a análise.
          </p>
        </Card>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-success/10">
                    <DollarSign className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Faturamento</p>
                    <p className="text-lg font-bold">{formatCurrencyBRL(analise.faturamentoTotal)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Vendas</p>
                    <p className="text-lg font-bold">{analise.totalVendas}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-500/10">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ticket Médio</p>
                    <p className="text-lg font-bold">{formatCurrencyBRL(analise.ticketMedio)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-amber-500/10">
                    <Calendar className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Melhor Dia</p>
                    <p className="text-lg font-bold">{analise.melhorDia.diaCompleto}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos lado a lado */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Vendas por dia da semana */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vendas por Dia da Semana</CardTitle>
                <CardDescription>Faturamento em cada dia</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analise.vendasPorDiaSemana}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrencyBRL(value), 'Faturamento']}
                      labelFormatter={(label) => diasSemana.indexOf(label as string) >= 0 ? 
                        ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][diasSemana.indexOf(label as string)] : label
                      }
                    />
                    <Bar dataKey="faturamento" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Vendas por canal */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vendas por Canal</CardTitle>
                <CardDescription>Distribuição do faturamento</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analise.vendasPorCanal}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="faturamento"
                      nameKey="canal"
                      label={({ canal, percentual }) => `${canal}: ${percentual.toFixed(0)}%`}
                    >
                      {analise.vendasPorCanal.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [formatCurrencyBRL(value), 'Faturamento']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Evolução diária */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução do Faturamento</CardTitle>
              <CardDescription>Últimos 30 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analise.evolucaoDiaria}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="data" 
                    tick={{ fontSize: 10 }} 
                    interval="preserveStartEnd"
                  />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrencyBRL(value), 'Faturamento']}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.dataCompleta || label}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="faturamento" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Rankings lado a lado */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Produtos por Faturamento */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-success" />
                  Top 5 por Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analise.topProdutosFaturamento.map((produto, idx) => (
                    <div key={produto.id} className="flex items-center gap-3">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center text-xs">
                        {idx + 1}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{produto.nome}</p>
                        <p className="text-xs text-muted-foreground">{produto.quantidade} vendas</p>
                      </div>
                      <span className="font-bold text-success">{formatCurrencyBRL(produto.faturamento)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Produtos por Quantidade */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Top 5 por Quantidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analise.topProdutosQuantidade.map((produto, idx) => (
                    <div key={produto.id} className="flex items-center gap-3">
                      <Badge variant="outline" className="w-6 h-6 flex items-center justify-center text-xs">
                        {idx + 1}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{produto.nome}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrencyBRL(produto.faturamento)}</p>
                      </div>
                      <span className="font-bold text-primary">{produto.quantidade} un</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
