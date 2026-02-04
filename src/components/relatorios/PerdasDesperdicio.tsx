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
  AlertTriangle,
  Trash2,
  Package,
  TrendingDown,
  DollarSign,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PerdasDesperdicioProps {
  onBack: () => void;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4'];

export const PerdasDesperdicio: React.FC<PerdasDesperdicioProps> = ({ onBack }) => {
  const { usuario } = useAuth();
  const [periodoMeses, setPeriodoMeses] = useState('3');

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

  // Buscar movimentos de estoque tipo saída que são perdas
  const { data: movimentosPerdas, isLoading: loadingMovimentos } = useQuery({
    queryKey: ['perdas-movimentos', usuario?.empresa_id, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentos')
        .select(`
          id,
          quantidade,
          custo_total,
          created_at,
          origem,
          observacao,
          insumos (
            id,
            nome,
            custo_unitario,
            unidade_medida
          )
        `)
        .eq('empresa_id', usuario?.empresa_id)
        .eq('tipo', 'saida')
        .in('origem', ['perda', 'vencimento', 'avaria', 'ajuste_negativo'])
        .gte('created_at', dataInicio)
        .lte('created_at', dataFim + 'T23:59:59')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar produções vencidas
  const { data: producoesVencidas, isLoading: loadingProducoes } = useQuery({
    queryKey: ['perdas-producoes', usuario?.empresa_id],
    queryFn: async () => {
      const hoje = new Date();
      const { data, error } = await supabase
        .from('producoes')
        .select(`
          id,
          quantidade,
          data_vencimento,
          created_at,
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
        .eq('empresa_id', usuario?.empresa_id)
        .not('data_vencimento', 'is', null)
        .lt('data_vencimento', format(hoje, 'yyyy-MM-dd'));

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Calcular análise de perdas
  const analise = useMemo(() => {
    // Perdas de insumos (movimentos de estoque)
    const perdasInsumos = movimentosPerdas?.map(mov => {
      const custoTotal = mov.custo_total || (mov.quantidade * (mov.insumos?.custo_unitario || 0));
      return {
        id: mov.id,
        tipo: 'insumo',
        nome: mov.insumos?.nome || 'Insumo desconhecido',
        quantidade: mov.quantidade,
        unidade: mov.insumos?.unidade_medida || 'un',
        custo: custoTotal,
        origem: mov.origem,
        data: mov.created_at,
        observacao: mov.observacao,
      };
    }) || [];

    // Perdas de produtos vencidos
    const perdasProdutos = producoesVencidas?.map(prod => {
      const custoUnitario = prod.produtos?.fichas_tecnicas?.reduce((acc, ft) => {
        return acc + (ft.quantidade * (ft.insumos?.custo_unitario || 0));
      }, 0) || 0;
      const custoTotal = custoUnitario * prod.quantidade;
      
      return {
        id: prod.id,
        tipo: 'produto',
        nome: prod.produtos?.nome || 'Produto desconhecido',
        quantidade: prod.quantidade,
        unidade: 'un',
        custo: custoTotal,
        origem: 'vencimento',
        data: prod.data_vencimento!,
        observacao: `Vencido em ${format(parseISO(prod.data_vencimento!), 'dd/MM/yyyy')}`,
      };
    }) || [];

    const todasPerdas = [...perdasInsumos, ...perdasProdutos].sort((a, b) => 
      b.data.localeCompare(a.data)
    );

    // Totais
    const totalPerdas = todasPerdas.reduce((acc, p) => acc + p.custo, 0);
    const totalPerdasInsumos = perdasInsumos.reduce((acc, p) => acc + p.custo, 0);
    const totalPerdasProdutos = perdasProdutos.reduce((acc, p) => acc + p.custo, 0);

    // Por origem
    const origemLabels: Record<string, string> = {
      vencimento: 'Vencimento',
      perda: 'Perda/Descarte',
      avaria: 'Avaria',
      ajuste_negativo: 'Ajuste de Inventário',
    };

    const perdasPorOrigem = new Map<string, number>();
    todasPerdas.forEach(p => {
      const label = origemLabels[p.origem] || p.origem;
      perdasPorOrigem.set(label, (perdasPorOrigem.get(label) || 0) + p.custo);
    });

    const dadosPorOrigem = Array.from(perdasPorOrigem.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Top itens com mais perdas
    const perdasPorItem = new Map<string, { nome: string; custo: number; quantidade: number }>();
    todasPerdas.forEach(p => {
      const atual = perdasPorItem.get(p.nome) || { nome: p.nome, custo: 0, quantidade: 0 };
      atual.custo += p.custo;
      atual.quantidade += p.quantidade;
      perdasPorItem.set(p.nome, atual);
    });

    const topItensPerdas = Array.from(perdasPorItem.values())
      .sort((a, b) => b.custo - a.custo)
      .slice(0, 10);

    return {
      totalPerdas,
      totalPerdasInsumos,
      totalPerdasProdutos,
      quantidadePerdas: todasPerdas.length,
      dadosPorOrigem,
      topItensPerdas,
      todasPerdas: todasPerdas.slice(0, 20),
    };
  }, [movimentosPerdas, producoesVencidas]);

  const isLoading = loadingMovimentos || loadingProducoes;

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
            <h1 className="text-2xl font-bold">Perdas e Desperdícios</h1>
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

      {!analise || analise.quantidadePerdas === 0 ? (
        <Card className="p-8 text-center">
          <Trash2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium mb-2">Nenhuma perda registrada</h3>
          <p className="text-muted-foreground">
            Ótimo! Não há perdas ou desperdícios registrados no período.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Para registrar perdas, use a baixa de estoque com origem "Perda" ou "Avaria".
          </p>
        </Card>
      ) : (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-destructive/20">
                    <DollarSign className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Perdas</p>
                    <p className="text-2xl font-bold text-destructive">{formatCurrencyBRL(analise.totalPerdas)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-amber-500/10">
                    <Package className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Perdas em Insumos</p>
                    <p className="text-xl font-bold">{formatCurrencyBRL(analise.totalPerdasInsumos)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-orange-500/10">
                    <Trash2 className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Produtos Vencidos</p>
                    <p className="text-xl font-bold">{formatCurrencyBRL(analise.totalPerdasProdutos)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Por Origem */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4" />
                  Perdas por Origem
                </CardTitle>
                <CardDescription>De onde vêm as perdas</CardDescription>
              </CardHeader>
              <CardContent>
                {analise.dadosPorOrigem.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={analise.dadosPorOrigem}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {analise.dadosPorOrigem.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrencyBRL(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {analise.dadosPorOrigem.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                            />
                            <span>{item.name}</span>
                          </div>
                          <span className="font-medium text-destructive">{formatCurrencyBRL(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Sem dados para exibir
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Itens */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  Itens com Mais Perdas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analise.topItensPerdas.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart 
                      data={analise.topItensPerdas} 
                      layout="vertical" 
                      margin={{ left: 80, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                      <YAxis 
                        type="category" 
                        dataKey="nome" 
                        tick={{ fontSize: 10 }} 
                        width={75}
                        tickFormatter={(v) => v.length > 12 ? v.substring(0, 12) + '...' : v}
                      />
                      <Tooltip 
                        formatter={(value: number, name: string) => {
                          if (name === 'custo') return [formatCurrencyBRL(value), 'Valor perdido'];
                          return [value, name];
                        }}
                      />
                      <Bar dataKey="custo" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Sem dados para exibir
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Histórico de Perdas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Perdas</CardTitle>
              <CardDescription>Últimos registros de perdas e desperdícios</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {analise.todasPerdas.map((perda) => (
                    <div 
                      key={perda.id} 
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-destructive/10">
                          {perda.tipo === 'produto' ? (
                            <Package className="h-4 w-4 text-destructive" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{perda.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {perda.quantidade} {perda.unidade} • {format(parseISO(perda.data), 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-destructive">{formatCurrencyBRL(perda.custo)}</span>
                        <p className="text-xs text-muted-foreground capitalize">{perda.origem}</p>
                      </div>
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
