import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { formatCurrencyBRL } from '@/lib/format';
import { 
  ArrowLeft, 
  Package, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingDown,
  BoxIcon
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
  CartesianGrid
} from 'recharts';
import { differenceInDays, parseISO, format } from 'date-fns';

interface PosicaoEstoqueProps {
  onBack: () => void;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

export const PosicaoEstoque: React.FC<PosicaoEstoqueProps> = ({ onBack }) => {
  const { usuario } = useAuth();

  // Buscar insumos
  const { data: insumos, isLoading: loadingInsumos } = useQuery({
    queryKey: ['estoque-insumos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .eq('empresa_id', usuario?.empresa_id)
        .eq('is_intermediario', false)
        .order('nome');

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar produções com vencimento
  const { data: producoes, isLoading: loadingProducoes } = useQuery({
    queryKey: ['estoque-producoes', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('producoes')
        .select(`
          id,
          quantidade,
          data_vencimento,
          dias_alerta_vencimento,
          created_at,
          produtos (
            id,
            nome,
            estoque_acabado
          )
        `)
        .eq('empresa_id', usuario?.empresa_id)
        .not('data_vencimento', 'is', null)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar produtos
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ['estoque-produtos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select(`
          id,
          nome,
          estoque_acabado,
          preco_venda,
          fichas_tecnicas (
            quantidade,
            insumos (
              custo_unitario
            )
          )
        `)
        .eq('empresa_id', usuario?.empresa_id)
        .eq('ativo', true);

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Calcular análise de estoque
  const analise = useMemo(() => {
    if (!insumos) return null;

    // Valor total do estoque de insumos
    const valorEstoqueInsumos = insumos.reduce((acc, ins) => {
      return acc + (ins.estoque_atual * ins.custo_unitario);
    }, 0);

    // Valor do estoque de produtos acabados
    const valorEstoqueProdutos = produtos?.reduce((acc, prod) => {
      const custoUnitario = prod.fichas_tecnicas?.reduce((acc, ft) => {
        return acc + (ft.quantidade * (ft.insumos?.custo_unitario || 0));
      }, 0) || 0;
      return acc + (prod.estoque_acabado * custoUnitario);
    }, 0) || 0;

    const valorTotalEstoque = valorEstoqueInsumos + valorEstoqueProdutos;

    // Insumos em baixa (estoque <= mínimo)
    const insumosEmBaixa = insumos.filter(ins => 
      ins.estoque_minimo > 0 && ins.estoque_atual <= ins.estoque_minimo
    ).sort((a, b) => {
      const percA = a.estoque_minimo > 0 ? (a.estoque_atual / a.estoque_minimo) : 1;
      const percB = b.estoque_minimo > 0 ? (b.estoque_atual / b.estoque_minimo) : 1;
      return percA - percB;
    });

    // Insumos zerados
    const insumosZerados = insumos.filter(ins => ins.estoque_atual <= 0);

    // Produtos próximos ao vencimento
    const hoje = new Date();
    const produtosVencendo = producoes?.filter(prod => {
      if (!prod.data_vencimento) return false;
      const dataVenc = parseISO(prod.data_vencimento);
      const diasParaVencer = differenceInDays(dataVenc, hoje);
      const diasAlerta = prod.dias_alerta_vencimento || 3;
      return diasParaVencer >= 0 && diasParaVencer <= diasAlerta;
    }).map(prod => ({
      ...prod,
      diasParaVencer: differenceInDays(parseISO(prod.data_vencimento!), hoje),
    })) || [];

    // Produtos já vencidos
    const produtosVencidos = producoes?.filter(prod => {
      if (!prod.data_vencimento) return false;
      const dataVenc = parseISO(prod.data_vencimento);
      return differenceInDays(dataVenc, hoje) < 0;
    }).map(prod => ({
      ...prod,
      diasVencido: Math.abs(differenceInDays(parseISO(prod.data_vencimento!), hoje)),
    })) || [];

    // Distribuição do valor do estoque
    const distribuicaoEstoque = [
      { name: 'Insumos', value: valorEstoqueInsumos, color: '#3b82f6' },
      { name: 'Produtos Acabados', value: valorEstoqueProdutos, color: '#10b981' },
    ].filter(d => d.value > 0);

    // Top 10 insumos por valor em estoque
    const topInsumosPorValor = [...insumos]
      .map(ins => ({
        ...ins,
        valorEstoque: ins.estoque_atual * ins.custo_unitario,
      }))
      .sort((a, b) => b.valorEstoque - a.valorEstoque)
      .slice(0, 10);

    return {
      valorTotalEstoque,
      valorEstoqueInsumos,
      valorEstoqueProdutos,
      totalInsumos: insumos.length,
      insumosEmBaixa,
      insumosZerados,
      produtosVencendo,
      produtosVencidos,
      distribuicaoEstoque,
      topInsumosPorValor,
    };
  }, [insumos, produtos, producoes]);

  const isLoading = loadingInsumos || loadingProducoes || loadingProdutos;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!analise) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Posição de Estoque</h1>
          </div>
        </div>
        <Card className="p-8 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium mb-2">Nenhum insumo cadastrado</h3>
          <p className="text-muted-foreground">
            Cadastre insumos para visualizar a posição de estoque.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Posição de Estoque</h1>
          <p className="text-muted-foreground">Visão geral do estoque e alertas</p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor em Estoque</p>
                <p className="text-lg font-bold">{formatCurrencyBRL(analise.valorTotalEstoque)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-success/10">
                <BoxIcon className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Insumos</p>
                <p className="text-lg font-bold">{analise.totalInsumos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={analise.insumosEmBaixa.length > 0 ? 'border-amber-500/30' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${analise.insumosEmBaixa.length > 0 ? 'bg-amber-500/10' : 'bg-muted'}`}>
                <TrendingDown className={`h-5 w-5 ${analise.insumosEmBaixa.length > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em Baixa</p>
                <p className={`text-lg font-bold ${analise.insumosEmBaixa.length > 0 ? 'text-amber-500' : ''}`}>
                  {analise.insumosEmBaixa.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={analise.produtosVencendo.length > 0 ? 'border-destructive/30' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${analise.produtosVencendo.length > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
                <Clock className={`h-5 w-5 ${analise.produtosVencendo.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencendo</p>
                <p className={`text-lg font-bold ${analise.produtosVencendo.length > 0 ? 'text-destructive' : ''}`}>
                  {analise.produtosVencendo.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição e Top Insumos */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição do Estoque</CardTitle>
            <CardDescription>Valor por tipo de item</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={analise.distribuicaoEstoque}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {analise.distribuicaoEstoque.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrencyBRL(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Insumos</span>
                <span className="font-medium">{formatCurrencyBRL(analise.valorEstoqueInsumos)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Produtos Acabados</span>
                <span className="font-medium">{formatCurrencyBRL(analise.valorEstoqueProdutos)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 por Valor em Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart 
                data={analise.topInsumosPorValor} 
                layout="vertical" 
                margin={{ left: 80, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" tickFormatter={(v) => `R$${(v).toFixed(0)}`} />
                <YAxis 
                  type="category" 
                  dataKey="nome" 
                  tick={{ fontSize: 10 }} 
                  width={75}
                  tickFormatter={(v) => v.length > 12 ? v.substring(0, 12) + '...' : v}
                />
                <Tooltip formatter={(value: number) => formatCurrencyBRL(value)} />
                <Bar dataKey="valorEstoque" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Insumos em Baixa */}
        <Card className={analise.insumosEmBaixa.length > 0 ? 'border-amber-500/30' : ''}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Insumos em Estoque Baixo
            </CardTitle>
            <CardDescription>
              {analise.insumosEmBaixa.length > 0 
                ? `${analise.insumosEmBaixa.length} insumo(s) abaixo do mínimo`
                : 'Nenhum insumo em baixa'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analise.insumosEmBaixa.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
                <p className="text-sm">Todos os insumos estão OK</p>
              </div>
            ) : (
              <ScrollArea className="h-[250px]">
                <div className="space-y-3">
                  {analise.insumosEmBaixa.map((ins) => {
                    const percentual = ins.estoque_minimo > 0 
                      ? (ins.estoque_atual / ins.estoque_minimo) * 100 
                      : 0;
                    return (
                      <div key={ins.id} className="p-3 rounded-lg border">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm">{ins.nome}</span>
                          <Badge variant={ins.estoque_atual <= 0 ? 'destructive' : 'outline'} className="text-xs">
                            {ins.estoque_atual <= 0 ? 'Zerado' : 'Baixo'}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Atual: {ins.estoque_atual} {ins.unidade_medida}</span>
                          <span>Mínimo: {ins.estoque_minimo} {ins.unidade_medida}</span>
                        </div>
                        <Progress value={Math.min(percentual, 100)} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Produtos Vencendo */}
        <Card className={analise.produtosVencendo.length > 0 ? 'border-destructive/30' : ''}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-destructive" />
              Produtos Próximos ao Vencimento
            </CardTitle>
            <CardDescription>
              {analise.produtosVencendo.length > 0 
                ? `${analise.produtosVencendo.length} lote(s) vencendo em breve`
                : 'Nenhum produto próximo ao vencimento'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analise.produtosVencendo.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
                <p className="text-sm">Nenhum produto próximo ao vencimento</p>
              </div>
            ) : (
              <ScrollArea className="h-[250px]">
                <div className="space-y-3">
                  {analise.produtosVencendo.map((prod) => (
                    <div key={prod.id} className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-medium text-sm">{prod.produtos?.nome}</span>
                          <p className="text-xs text-muted-foreground">
                            Qtd: {prod.quantidade} | Vence: {format(parseISO(prod.data_vencimento!), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <Badge variant="destructive" className="text-xs">
                          {prod.diasParaVencer === 0 ? 'Hoje' : `${prod.diasParaVencer} dia(s)`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Produtos já vencidos */}
            {analise.produtosVencidos.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-destructive mb-2">
                  ⚠️ {analise.produtosVencidos.length} lote(s) já vencido(s)
                </p>
                <div className="space-y-2">
                  {analise.produtosVencidos.slice(0, 3).map((prod) => (
                    <div key={prod.id} className="text-xs text-muted-foreground">
                      {prod.produtos?.nome} - vencido há {prod.diasVencido} dia(s)
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
