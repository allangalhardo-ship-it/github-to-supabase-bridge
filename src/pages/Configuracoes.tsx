import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Settings, Save, Loader2 } from 'lucide-react';
import TaxasAppsConfig from '@/components/configuracoes/TaxasAppsConfig';

const Configuracoes = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    margem_desejada_padrao: '',
    cmv_alvo: '',
    imposto_medio_sobre_vendas: '',
  });

  const { data: config, isLoading } = useQuery({
    queryKey: ['configuracoes', usuario?.empresa_id],
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

  useEffect(() => {
    if (config) {
      setFormData({
        margem_desejada_padrao: String(config.margem_desejada_padrao ?? 30),
        cmv_alvo: String(config.cmv_alvo ?? 35),
        imposto_medio_sobre_vendas: String(config.imposto_medio_sobre_vendas ?? 10),
      });
    }
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const configData = {
        margem_desejada_padrao: data.margem_desejada_padrao === '' ? 0 : parseFloat(data.margem_desejada_padrao),
        cmv_alvo: data.cmv_alvo === '' ? 0 : parseFloat(data.cmv_alvo),
        imposto_medio_sobre_vendas: data.imposto_medio_sobre_vendas === '' ? 0 : parseFloat(data.imposto_medio_sobre_vendas),
      };

      if (config) {
        const { error } = await supabase
          .from('configuracoes')
          .update(configData)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('configuracoes').insert({
          empresa_id: usuario!.empresa_id,
          ...configData,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes'] });
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast({ title: 'Configurações salvas!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Defina os parâmetros de cálculo do seu negócio</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Parâmetros Financeiros
            </CardTitle>
            <CardDescription>
              Estes valores serão usados para calcular o preço sugerido e analisar a saúde financeira do seu negócio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="margem_desejada_padrao">Margem de Lucro Desejada (%)</Label>
                <Input
                  id="margem_desejada_padrao"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.margem_desejada_padrao}
                  onChange={(e) => setFormData({ ...formData, margem_desejada_padrao: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Usada para calcular o preço de venda sugerido dos produtos
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cmv_alvo">CMV Alvo (%)</Label>
                <Input
                  id="cmv_alvo"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.cmv_alvo}
                  onChange={(e) => setFormData({ ...formData, cmv_alvo: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Custo da Mercadoria Vendida ideal para o seu segmento
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="imposto_medio_sobre_vendas">Imposto Médio sobre Vendas (%)</Label>
                <Input
                  id="imposto_medio_sobre_vendas"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.imposto_medio_sobre_vendas}
                  onChange={(e) => setFormData({ ...formData, imposto_medio_sobre_vendas: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Estimativa de impostos para cálculo do lucro líquido
                </p>
              </div>

            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar Configurações
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <TaxasAppsConfig />

      <Card>
        <CardHeader>
          <CardTitle>Como funcionam os cálculos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <h4 className="font-medium text-foreground">Preço Sugerido</h4>
            <p>Custo dos insumos ÷ (1 - Margem desejada%)</p>
            <p className="text-xs">Exemplo: R$ 10,00 de custo com 30% de margem = R$ 14,29</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground">CMV (Custo da Mercadoria Vendida)</h4>
            <p>Custo dos insumos ÷ Preço de venda × 100</p>
            <p className="text-xs">Quanto menor, maior sua margem de lucro bruto</p>
          </div>
          <div>
            <h4 className="font-medium text-foreground">Lucro Estimado</h4>
            <p>Receita - CMV - Custos Fixos - Impostos</p>
            <p className="text-xs">Visão completa considerando todos os custos do negócio</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Configuracoes;
