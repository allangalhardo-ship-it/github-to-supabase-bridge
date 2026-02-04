import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatCurrencyBRL } from '@/lib/format';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  DollarSign,
  ShoppingCart,
  Package
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend
} from 'recharts';
import { format, subDays, subMonths, startOfMonth, endOfMonth, parseISO, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FluxoCaixaProps {
  onBack: () => void;
}

export const FluxoCaixa: React.FC<FluxoCaixaProps> = ({ onBack }) => {
  const { usuario } = useAuth();
  const [periodoMeses, setPeriodoMeses] = useState('1');

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

  // Buscar movimentos de caixa
  const { data: movimentos, isLoading: loadingMovimentos } = useQuery({
    queryKey: ['fluxo-caixa', usuario?.empresa_id, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .select('*')
        .eq('empresa_id', usuario?.empresa_id)
        .gte('data_movimento', dataInicio)
        .lte('data_movimento', dataFim)
        .order('data_movimento', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar vendas para complementar
  const { data: vendas, isLoading: loadingVendas } = useQuery({
    queryKey: ['fluxo-vendas', usuario?.empresa_id, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select('id, valor_total, data_venda')
        .eq('empresa_id', usuario?.empresa_id)
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim);

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar compras (estoque_movimentos tipo entrada com custo)
  const { data: compras, isLoading: loadingCompras } = useQuery({
    queryKey: ['fluxo-compras', usuario?.empresa_id, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentos')
        .select('id, custo_total, created_at')
        .eq('empresa_id', usuario?.empresa_id)
        .eq('tipo', 'entrada')
        .gte('created_at', dataInicio)
        .lte('created_at', dataFim + 'T23:59:59');

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Calcular fluxo de caixa
  const fluxo = useMemo(() => {
    if (!vendas && !compras && !movimentos) return null;

    // Total de entradas (vendas + entradas manuais)
    const totalVendas = vendas?.reduce((acc, v) => acc + (v.valor_total || 0), 0) || 0;
    const entradasManuais = movimentos?.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + (m.valor || 0), 0) || 0;
    const totalEntradas = totalVendas + entradasManuais;

    // Total de saídas (compras + saídas manuais)
    const totalCompras = compras?.reduce((acc, c) => acc + (c.custo_total || 0), 0) || 0;
    const saidasManuais = movimentos?.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + (m.valor || 0), 0) || 0;
    const totalSaidas = totalCompras + saidasManuais;

    // Saldo
    const saldo = totalEntradas - totalSaidas;

    // Agrupar por categoria
    const entradasPorCategoria = new Map<string, number>();
    entradasPorCategoria.set('Vendas', totalVendas);
    movimentos?.filter(m => m.tipo === 'entrada').forEach(m => {
      const cat = m.categoria || 'Outros';
      entradasPorCategoria.set(cat, (entradasPorCategoria.get(cat) || 0) + m.valor);
    });

    const saidasPorCategoria = new Map<string, number>();
    saidasPorCategoria.set('Compras de Insumos', totalCompras);
    movimentos?.filter(m => m.tipo === 'saida').forEach(m => {
      const cat = m.categoria || 'Outros';
      saidasPorCategoria.set(cat, (saidasPorCategoria.get(cat) || 0) + m.valor);
    });

    // Evolução diária
    const inicio = parseISO(dataInicio);
    const fim = parseISO(dataFim);
    const dias = eachDayOfInterval({ start: inicio, end: fim });
    
    let saldoAcumulado = 0;
    const evolucaoDiaria = dias.map(dia => {
      const dataStr = format(dia, 'yyyy-MM-dd');
      
      const entradasDia = (vendas?.filter(v => v.data_venda === dataStr).reduce((acc, v) => acc + v.valor_total, 0) || 0) +
        (movimentos?.filter(m => m.data_movimento === dataStr && m.tipo === 'entrada').reduce((acc, m) => acc + m.valor, 0) || 0);
      
      const saidasDia = (compras?.filter(c => c.created_at.startsWith(dataStr)).reduce((acc, c) => acc + (c.custo_total || 0), 0) || 0) +
        (movimentos?.filter(m => m.data_movimento === dataStr && m.tipo === 'saida').reduce((acc, m) => acc + m.valor, 0) || 0);
      
      saldoAcumulado += entradasDia - saidasDia;
      
      return {
        data: format(dia, 'dd/MM'),
        dataCompleta: format(dia, "dd 'de' MMMM", { locale: ptBR }),
        entradas: entradasDia,
        saidas: saidasDia,
        saldo: saldoAcumulado,
      };
    });

    // Dados para gráfico de barras
    const dadosBarras = [
      { name: 'Entradas', valor: totalEntradas, fill: '#10b981' },
      { name: 'Saídas', valor: totalSaidas, fill: '#ef4444' },
    ];

    // Lista de movimentos recentes
    const movimentosRecentes = [
      ...(vendas?.slice(-10).map(v => ({
        id: v.id,
        data: v.data_venda,
        tipo: 'entrada' as const,
        categoria: 'Vendas',
        valor: v.valor_total,
        descricao: 'Venda registrada',
      })) || []),
      ...(movimentos?.slice(-10).map(m => ({
        id: m.id,
        data: m.data_movimento,
        tipo: m.tipo as 'entrada' | 'saida',
        categoria: m.categoria,
        valor: m.valor,
        descricao: m.descricao,
      })) || []),
    ].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 15);

    return {
      totalEntradas,
      totalSaidas,
      saldo,
      entradasPorCategoria: Array.from(entradasPorCategoria.entries()).map(([name, value]) => ({ name, value })),
      saidasPorCategoria: Array.from(saidasPorCategoria.entries()).map(([name, value]) => ({ name, value })),
      evolucaoDiaria,
      dadosBarras,
      movimentosRecentes,
    };
  }, [vendas, compras, movimentos, dataInicio, dataFim]);

  const isLoading = loadingMovimentos || loadingVendas || loadingCompras;

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
            <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
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

      {!fluxo ? (
        <Card className="p-8 text-center">
          <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium mb-2">Nenhum movimento no período</h3>
          <p className="text-muted-foreground">
            Registre vendas ou movimentos de caixa para visualizar o fluxo.
          </p>
        </Card>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-success/30 bg-success/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-success/20">
                    <ArrowUpCircle className="h-6 w-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Entradas</p>
                    <p className="text-2xl font-bold text-success">{formatCurrencyBRL(fluxo.totalEntradas)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-destructive/20">
                    <ArrowDownCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Saídas</p>
                    <p className="text-2xl font-bold text-destructive">{formatCurrencyBRL(fluxo.totalSaidas)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={fluxo.saldo >= 0 ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${fluxo.saldo >= 0 ? 'bg-primary/20' : 'bg-destructive/20'}`}>
                    <Wallet className={`h-6 w-6 ${fluxo.saldo >= 0 ? 'text-primary' : 'text-destructive'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo do Período</p>
                    <p className={`text-2xl font-bold ${fluxo.saldo >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatCurrencyBRL(fluxo.saldo)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Evolução */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução do Saldo</CardTitle>
              <CardDescription>Acumulado ao longo do período</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={fluxo.evolucaoDiaria}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="data" 
                    tick={{ fontSize: 10 }} 
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} 
                    tick={{ fontSize: 11 }} 
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        entradas: 'Entradas',
                        saidas: 'Saídas',
                        saldo: 'Saldo Acumulado'
                      };
                      return [formatCurrencyBRL(value), labels[name] || name];
                    }}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.dataCompleta || label}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="saldo" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Saldo"
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="entradas" 
                    stroke="#10b981" 
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    name="Entradas"
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="saidas" 
                    stroke="#ef4444" 
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    name="Saídas"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Entradas vs Saídas por Categoria */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-success" />
                  Entradas por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fluxo.entradasPorCategoria.map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm">{cat.name}</span>
                      <span className="font-medium text-success">{formatCurrencyBRL(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowDownCircle className="h-4 w-4 text-destructive" />
                  Saídas por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fluxo.saidasPorCategoria.map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm">{cat.name}</span>
                      <span className="font-medium text-destructive">{formatCurrencyBRL(cat.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Movimentos Recentes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Movimentos Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {fluxo.movimentosRecentes.map((mov) => (
                    <div 
                      key={mov.id} 
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${mov.tipo === 'entrada' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                          {mov.tipo === 'entrada' ? (
                            <ArrowUpCircle className="h-4 w-4 text-success" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{mov.descricao}</p>
                          <p className="text-xs text-muted-foreground">
                            {mov.categoria} • {format(parseISO(mov.data), 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                      <span className={`font-bold ${mov.tipo === 'entrada' ? 'text-success' : 'text-destructive'}`}>
                        {mov.tipo === 'entrada' ? '+' : '-'}{formatCurrencyBRL(mov.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
