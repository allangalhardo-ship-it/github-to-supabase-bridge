import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Store, TrendingDown, DollarSign, Percent, BarChart3 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrencyBRL } from '@/lib/format';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';

interface Props {
  onBack: () => void;
}

export const AnalisePlataformas: React.FC<Props> = ({ onBack }) => {
  const { usuario } = useAuth();
  const [dataInicio, setDataInicio] = useState(format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const { data: vendas, isLoading } = useQuery({
    queryKey: ['vendas-plataformas', usuario?.empresa_id, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select('id, data_venda, valor_total, subtotal, taxa_entrega, taxa_servico, incentivo_plataforma, incentivo_loja, valor_liquido, plataforma, canal, origem')
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim)
        .order('data_venda');
      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id,
  });

  const plataformas = useMemo(() => {
    if (!vendas || vendas.length === 0) return [];

    const map: Record<string, {
      pedidos: number;
      receitaBruta: number;
      taxaServico: number;
      incentivoLoja: number;
      incentivoPlataforma: number;
      taxaEntrega: number;
      valorLiquido: number;
    }> = {};

    vendas.forEach(v => {
      const plat = v.plataforma || v.canal || 'Venda Direta';
      if (!map[plat]) {
        map[plat] = { pedidos: 0, receitaBruta: 0, taxaServico: 0, incentivoLoja: 0, incentivoPlataforma: 0, taxaEntrega: 0, valorLiquido: 0 };
      }
      map[plat].pedidos++;
      map[plat].receitaBruta += Number(v.subtotal || v.valor_total || 0);
      map[plat].taxaServico += Number(v.taxa_servico || 0);
      map[plat].incentivoLoja += Number(v.incentivo_loja || 0);
      map[plat].incentivoPlataforma += Number(v.incentivo_plataforma || 0);
      map[plat].taxaEntrega += Number(v.taxa_entrega || 0);
      map[plat].valorLiquido += Number(v.valor_liquido || v.valor_total || 0);
    });

    return Object.entries(map)
      .map(([nome, dados]) => {
        const custoPlataforma = dados.taxaServico + dados.incentivoLoja;
        const percentualCusto = dados.receitaBruta > 0 ? (custoPlataforma / dados.receitaBruta) * 100 : 0;
        return { nome, ...dados, custoPlataforma, percentualCusto };
      })
      .sort((a, b) => b.receitaBruta - a.receitaBruta);
  }, [vendas]);

  // Totais gerais
  const totais = useMemo(() => {
    return plataformas.reduce((acc, p) => ({
      pedidos: acc.pedidos + p.pedidos,
      receitaBruta: acc.receitaBruta + p.receitaBruta,
      taxaServico: acc.taxaServico + p.taxaServico,
      incentivoLoja: acc.incentivoLoja + p.incentivoLoja,
      incentivoPlataforma: acc.incentivoPlataforma + p.incentivoPlataforma,
      custoPlataforma: acc.custoPlataforma + p.custoPlataforma,
      valorLiquido: acc.valorLiquido + p.valorLiquido,
    }), { pedidos: 0, receitaBruta: 0, taxaServico: 0, incentivoLoja: 0, incentivoPlataforma: 0, custoPlataforma: 0, valorLiquido: 0 });
  }, [plataformas]);

  // Dados para gráfico evolutivo mensal
  const dadosMensais = useMemo(() => {
    if (!vendas || vendas.length === 0) return [];

    const porMes: Record<string, Record<string, number>> = {};

    vendas.forEach(v => {
      const mes = v.data_venda.substring(0, 7); // YYYY-MM
      const plat = v.plataforma || v.canal || 'Venda Direta';
      if (!porMes[mes]) porMes[mes] = {};
      if (!porMes[mes][plat]) porMes[mes][plat] = 0;
      porMes[mes][plat] += Number(v.taxa_servico || 0) + Number(v.incentivo_loja || 0);
    });

    return Object.entries(porMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, plats]) => ({
        mes: format(new Date(mes + '-01'), 'MMM/yy', { locale: ptBR }),
        ...plats,
        total: Object.values(plats).reduce((s, v) => s + v, 0),
      }));
  }, [vendas]);

  const chartData = useMemo(() => {
    return plataformas.map(p => ({
      nome: p.nome,
      'Receita Bruta': p.receitaBruta,
      'Taxa Serviço': p.taxaServico,
      'Incentivo Loja': p.incentivoLoja,
      'Valor Líquido': p.valorLiquido,
    }));
  }, [plataformas]);

  const platNames = plataformas.map(p => p.nome);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Store className="h-5 w-5" />
            Análise por Plataforma
          </h1>
          <p className="text-sm text-muted-foreground">Quanto cada plataforma custa para o seu negócio</p>
        </div>
      </div>

      {/* Filtro de datas */}
      <div className="flex items-center gap-2">
        <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-9 w-auto" />
        <span className="text-muted-foreground text-sm">a</span>
        <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9 w-auto" />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-64" />
        </div>
      ) : plataformas.length === 0 ? (
        <Card className="p-12 text-center">
          <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sem dados de plataformas</h3>
          <p className="text-muted-foreground">Importe vendas com dados financeiros (foto/print) para ver esta análise.</p>
        </Card>
      ) : (
        <>
          {/* Cards resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <p className="text-xs text-muted-foreground">Receita Bruta</p>
                <p className="text-lg sm:text-xl font-bold text-primary">{formatCurrencyBRL(totais.receitaBruta)}</p>
                <p className="text-xs text-muted-foreground">{totais.pedidos} pedidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <p className="text-xs text-muted-foreground">Custo das Plataformas</p>
                <p className="text-lg sm:text-xl font-bold text-destructive">{formatCurrencyBRL(totais.custoPlataforma)}</p>
                <p className="text-xs text-muted-foreground">
                  {totais.receitaBruta > 0 ? ((totais.custoPlataforma / totais.receitaBruta) * 100).toFixed(1) : 0}% da receita
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <p className="text-xs text-muted-foreground">Incentivo Plataforma</p>
                <p className="text-lg sm:text-xl font-bold text-green-600">{formatCurrencyBRL(totais.incentivoPlataforma)}</p>
                <p className="text-xs text-muted-foreground">Não sai do seu bolso</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <p className="text-xs text-muted-foreground">Valor Líquido</p>
                <p className="text-lg sm:text-xl font-bold">{formatCurrencyBRL(totais.valorLiquido)}</p>
                <p className="text-xs text-muted-foreground">O que você recebe</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela comparativa */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comparativo por Plataforma</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium">Plataforma</th>
                    <th className="text-right p-3 font-medium">Pedidos</th>
                    <th className="text-right p-3 font-medium">Receita</th>
                    <th className="text-right p-3 font-medium">Taxa Serviço</th>
                    <th className="text-right p-3 font-medium">Incentivo Loja</th>
                    <th className="text-right p-3 font-medium">Incentivo Plat.</th>
                    <th className="text-right p-3 font-medium">Custo Total</th>
                    <th className="text-right p-3 font-medium">% Custo</th>
                    <th className="text-right p-3 font-medium">Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {plataformas.map(p => (
                    <tr key={p.nome} className="border-b hover:bg-muted/20">
                      <td className="p-3 font-medium">
                        <Badge variant="secondary">{p.nome}</Badge>
                      </td>
                      <td className="p-3 text-right">{p.pedidos}</td>
                      <td className="p-3 text-right">{formatCurrencyBRL(p.receitaBruta)}</td>
                      <td className="p-3 text-right text-destructive">{formatCurrencyBRL(p.taxaServico)}</td>
                      <td className="p-3 text-right text-destructive">{formatCurrencyBRL(p.incentivoLoja)}</td>
                      <td className="p-3 text-right text-green-600">{formatCurrencyBRL(p.incentivoPlataforma)}</td>
                      <td className="p-3 text-right font-medium text-destructive">{formatCurrencyBRL(p.custoPlataforma)}</td>
                      <td className="p-3 text-right">
                        <Badge variant={p.percentualCusto > 15 ? 'destructive' : 'outline'}>
                          {p.percentualCusto.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-bold">{formatCurrencyBRL(p.valorLiquido)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-bold">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right">{totais.pedidos}</td>
                    <td className="p-3 text-right">{formatCurrencyBRL(totais.receitaBruta)}</td>
                    <td className="p-3 text-right text-destructive">{formatCurrencyBRL(totais.taxaServico)}</td>
                    <td className="p-3 text-right text-destructive">{formatCurrencyBRL(totais.incentivoLoja)}</td>
                    <td className="p-3 text-right text-green-600">{formatCurrencyBRL(totais.incentivoPlataforma)}</td>
                    <td className="p-3 text-right text-destructive">{formatCurrencyBRL(totais.custoPlataforma)}</td>
                    <td className="p-3 text-right">
                      {totais.receitaBruta > 0 ? ((totais.custoPlataforma / totais.receitaBruta) * 100).toFixed(1) : 0}%
                    </td>
                    <td className="p-3 text-right">{formatCurrencyBRL(totais.valorLiquido)}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          {/* Gráfico comparativo */}
          {chartData.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Receita vs Custos por Plataforma
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCurrencyBRL(v)} />
                    <Tooltip formatter={(v: number) => formatCurrencyBRL(v)} />
                    <Legend />
                    <Bar dataKey="Valor Líquido" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Taxa Serviço" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Incentivo Loja" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Gráfico evolutivo */}
          {dadosMensais.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Evolução do Custo das Plataformas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={dadosMensais}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCurrencyBRL(v)} />
                    <Tooltip formatter={(v: number) => formatCurrencyBRL(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="total" name="Custo Total" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4 }} />
                    {platNames.map((name, i) => (
                      <Line key={name} type="monotone" dataKey={name} stroke={`hsl(${(i * 60 + 200) % 360}, 70%, 50%)`} strokeWidth={1.5} dot={{ r: 3 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
