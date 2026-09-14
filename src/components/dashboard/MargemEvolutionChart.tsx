import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { somarCustoVendas } from '@/lib/vendasUtils';

const MargemEvolutionChart: React.FC = () => {
  const { usuario } = useAuth();

  const { data: dadosMensais, isLoading } = useQuery({
    queryKey: ['margem-evolucao', usuario?.empresa_id],
    queryFn: async () => {
      const meses = [];
      for (let i = 5; i >= 0; i--) {
        const mesRef = subMonths(new Date(), i);
        const inicio = format(startOfMonth(mesRef), 'yyyy-MM-dd');
        const fim = format(endOfMonth(mesRef), 'yyyy-MM-dd');

        const { data } = await supabase.rpc('get_dashboard_vendas', {
          p_empresa_id: usuario?.empresa_id,
          p_data_inicio: inicio,
          p_data_fim: fim,
        });

        const receita = data?.reduce((s: number, v: any) => s + Number(v.valor_total), 0) || 0;
        const custo = somarCustoVendas(data as any);

        const margem = receita > 0 ? ((receita - custo) / receita) * 100 : 0;

        meses.push({
          mes: format(mesRef, 'MMM', { locale: ptBR }),
          margem: Number(margem.toFixed(1)),
          receita,
        });
      }
      return meses;
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 10 * 60 * 1000,
  });

  const hasData = dadosMensais?.some(m => m.receita > 0);
  if (!hasData && !isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5 text-primary" />
          Evolução da Margem (6 meses)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dadosMensais}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, 'auto']} />
              <Tooltip
                formatter={(value: number) => [`${value}%`, 'Margem']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Line
                type="monotone"
                dataKey="margem"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default MargemEvolutionChart;
