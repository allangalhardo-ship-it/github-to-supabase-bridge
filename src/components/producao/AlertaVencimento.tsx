import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';
import { format, differenceInDays, isAfter, isBefore, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProducaoComVencimento {
  id: string;
  quantidade: number;
  data_vencimento: string;
  shelf_life_dias: number;
  dias_alerta_vencimento: number;
  created_at: string;
  produtos: {
    nome: string;
  };
}

export const AlertaVencimento = () => {
  const { usuario } = useAuth();

  const { data: producoesPerto } = useQuery({
    queryKey: ['producoes-vencimento', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('producoes')
        .select(`
          id,
          quantidade,
          data_vencimento,
          shelf_life_dias,
          dias_alerta_vencimento,
          created_at,
          produtos (nome)
        `)
        .not('data_vencimento', 'is', null)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      return data as ProducaoComVencimento[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Filtrar produções que precisam de alerta
  const alertas = React.useMemo(() => {
    if (!producoesPerto) return { vencidos: [], proximos: [] };

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const vencidos: ProducaoComVencimento[] = [];
    const proximos: ProducaoComVencimento[] = [];

    producoesPerto.forEach(prod => {
      if (!prod.data_vencimento) return;
      
      const dataVenc = new Date(prod.data_vencimento);
      dataVenc.setHours(0, 0, 0, 0);
      
      const diasRestantes = differenceInDays(dataVenc, hoje);
      const diasAlerta = prod.dias_alerta_vencimento || 3;

      if (isBefore(dataVenc, hoje)) {
        vencidos.push(prod);
      } else if (diasRestantes <= diasAlerta) {
        proximos.push(prod);
      }
    });

    return { vencidos, proximos };
  }, [producoesPerto]);

  const totalAlertas = alertas.vencidos.length + alertas.proximos.length;

  if (totalAlertas === 0) return null;

  return (
    <div className="space-y-3">
      {/* Produtos Vencidos */}
      {alertas.vencidos.length > 0 && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-destructive">
                  {alertas.vencidos.length} produto(s) vencido(s)!
                </p>
                <div className="mt-2 space-y-1.5">
                  {alertas.vencidos.map(prod => {
                    const diasVencido = differenceInDays(new Date(), new Date(prod.data_vencimento));
                    return (
                      <div key={prod.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-destructive/90 truncate">
                          {prod.produtos?.nome} ({Number(prod.quantidade)} un)
                        </span>
                        <Badge variant="destructive" className="shrink-0">
                          Vencido há {diasVencido} dia(s)
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Produtos Próximos ao Vencimento */}
      {alertas.proximos.length > 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  {alertas.proximos.length} produto(s) próximo(s) ao vencimento
                </p>
                <div className="mt-2 space-y-1.5">
                  {alertas.proximos.map(prod => {
                    const hoje = new Date();
                    const dataVenc = new Date(prod.data_vencimento);
                    const diasRestantes = differenceInDays(dataVenc, hoje);
                    
                    return (
                      <div key={prod.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-amber-900 dark:text-amber-100 truncate">
                          {prod.produtos?.nome} ({Number(prod.quantidade)} un)
                        </span>
                        <Badge 
                          variant="outline" 
                          className={`shrink-0 ${
                            isToday(dataVenc) 
                              ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-950/50' 
                              : diasRestantes === 1 
                                ? 'border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-950/50'
                                : 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/50'
                          }`}
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {isToday(dataVenc) 
                            ? 'Vence HOJE' 
                            : diasRestantes === 1 
                              ? 'Vence amanhã' 
                              : `Vence em ${diasRestantes} dias`}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
