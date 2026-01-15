import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Minus, History } from 'lucide-react';

interface HistoricoPrecosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insumoId: string;
  insumoNome: string;
  custoAtual: number;
}

const HistoricoPrecos: React.FC<HistoricoPrecosProps> = ({
  open,
  onOpenChange,
  insumoId,
  insumoNome,
  custoAtual,
}) => {
  const { usuario } = useAuth();

  const { data: historico, isLoading } = useQuery({
    queryKey: ['historico-precos', insumoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historico_precos')
        .select('*')
        .eq('insumo_id', insumoId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open && !!insumoId,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  // Prepare chart data
  const chartData = React.useMemo(() => {
    if (!historico || historico.length === 0) return [];
    
    return historico.map((item) => ({
      date: formatDate(item.created_at),
      fullDate: formatDateTime(item.created_at),
      preco: Number(item.preco_novo),
      origem: item.origem,
    }));
  }, [historico]);

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!historico || historico.length === 0) {
      return { min: custoAtual, max: custoAtual, avg: custoAtual, variation: 0, trend: 'stable' as const };
    }

    const precos = historico.map(h => Number(h.preco_novo));
    const min = Math.min(...precos);
    const max = Math.max(...precos);
    const avg = precos.reduce((a, b) => a + b, 0) / precos.length;
    
    // Calculate trend from last 3 entries
    const recent = historico.slice(-3);
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (recent.length >= 2) {
      const first = Number(recent[0].preco_novo);
      const last = Number(recent[recent.length - 1].preco_novo);
      const diff = ((last - first) / first) * 100;
      if (diff > 5) trend = 'up';
      else if (diff < -5) trend = 'down';
    }

    // Total variation from first to last
    const firstPrice = Number(historico[0].preco_novo);
    const lastPrice = Number(historico[historico.length - 1].preco_novo);
    const variation = ((lastPrice - firstPrice) / firstPrice) * 100;

    return { min, max, avg, variation, trend };
  }, [historico, custoAtual]);

  const getOrigemLabel = (origem: string) => {
    switch (origem) {
      case 'xml': return 'NF-e';
      case 'manual': return 'Manual';
      case 'ajuste': return 'Ajuste';
      default: return origem;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.fullDate}</p>
          <p className="text-lg font-bold text-primary">{formatCurrency(data.preco)}</p>
          <Badge variant="outline" className="mt-1">{getOrigemLabel(data.origem)}</Badge>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Preços - {insumoNome}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        ) : !historico || historico.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum histórico de preços encontrado.</p>
            <p className="text-sm">O histórico será registrado automaticamente nas próximas compras.</p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Preço atual</p>
              <p className="text-2xl font-bold">{formatCurrency(custoAtual)}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Preço Atual</p>
                  <p className="text-lg font-bold">{formatCurrency(custoAtual)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Média</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.avg)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Mínimo</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(stats.min)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Máximo</p>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(stats.max)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Trend Indicator */}
            <Card>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {stats.trend === 'up' ? (
                    <TrendingUp className="h-5 w-5 text-red-500" />
                  ) : stats.trend === 'down' ? (
                    <TrendingDown className="h-5 w-5 text-green-500" />
                  ) : (
                    <Minus className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="text-sm">Tendência recente</span>
                </div>
                <Badge 
                  variant={stats.trend === 'up' ? 'destructive' : stats.trend === 'down' ? 'default' : 'secondary'}
                >
                  {stats.trend === 'up' ? 'Subindo' : stats.trend === 'down' ? 'Caindo' : 'Estável'}
                </Badge>
              </CardContent>
            </Card>

            {/* Chart */}
            {chartData.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Evolução do Preço</CardTitle>
                  <CardDescription>
                    Variação total: {stats.variation > 0 ? '+' : ''}{stats.variation.toFixed(1)}%
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorPreco" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                        />
                        <YAxis 
                          tickFormatter={(value) => `R$${value.toFixed(2)}`}
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                          width={70}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="preco" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          fill="url(#colorPreco)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* History List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Registros ({historico.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {[...historico].reverse().map((item, index) => (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-muted-foreground w-20">
                          {formatDate(item.created_at)}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {getOrigemLabel(item.origem)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(Number(item.preco_novo))}</span>
                        {item.variacao_percentual !== null && item.variacao_percentual !== 0 && (
                          <span className={`text-xs ${Number(item.variacao_percentual) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {Number(item.variacao_percentual) > 0 ? '+' : ''}{Number(item.variacao_percentual).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default HistoricoPrecos;
