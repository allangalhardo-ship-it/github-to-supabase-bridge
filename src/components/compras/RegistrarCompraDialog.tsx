import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calculator, Package, ArrowRight, Loader2 } from 'lucide-react';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select';

interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  estoque_atual: number;
}

interface UnidadeCompra {
  id: string;
  nome: string;
  fator_conversao: number;
  insumo_id: string;
}

interface RegistrarCompraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RegistrarCompraDialog: React.FC<RegistrarCompraDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    insumo_id: '',
    quantidade: '',
    unidade_compra_id: '',
    valor_total: '',
    fornecedor: '',
    fator_conversao_manual: '',
    nova_unidade_nome: '',
  });

  const [showNovaUnidade, setShowNovaUnidade] = useState(false);

  // Fetch insumos
  const { data: insumos } = useQuery({
    queryKey: ['insumos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .eq('is_intermediario', false)
        .order('nome');
      if (error) throw error;
      return data as Insumo[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch unidades de compra for selected insumo
  const { data: unidadesCompra } = useQuery({
    queryKey: ['unidades-compra', formData.insumo_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades_compra')
        .select('*')
        .eq('insumo_id', formData.insumo_id)
        .order('nome');
      if (error) throw error;
      return data as UnidadeCompra[];
    },
    enabled: !!formData.insumo_id,
  });

  const insumoSelecionado = insumos?.find(i => i.id === formData.insumo_id);
  const unidadeSelecionada = unidadesCompra?.find(u => u.id === formData.unidade_compra_id);

  // Calculate conversion
  const fatorConversao = useMemo(() => {
    if (formData.fator_conversao_manual) {
      return parseFloat(formData.fator_conversao_manual) || 0;
    }
    return unidadeSelecionada?.fator_conversao || 0;
  }, [unidadeSelecionada, formData.fator_conversao_manual]);

  const quantidadeComprada = parseFloat(formData.quantidade) || 0;
  const valorTotal = parseFloat(formData.valor_total) || 0;

  const quantidadeConvertida = quantidadeComprada * fatorConversao;
  const custoUnitarioProducao = quantidadeConvertida > 0 ? valorTotal / quantidadeConvertida : 0;

  // Reset form when insumo changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      unidade_compra_id: '',
      fator_conversao_manual: '',
    }));
    setShowNovaUnidade(false);
  }, [formData.insumo_id]);

  // Create unidade compra mutation
  const createUnidadeMutation = useMutation({
    mutationFn: async (data: { nome: string; fator_conversao: number }) => {
      const { data: result, error } = await supabase
        .from('unidades_compra')
        .insert({
          empresa_id: usuario!.empresa_id,
          insumo_id: formData.insumo_id,
          nome: data.nome,
          fator_conversao: data.fator_conversao,
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['unidades-compra'] });
      setFormData(prev => ({ ...prev, unidade_compra_id: data.id }));
      setShowNovaUnidade(false);
      toast({ title: 'Unidade de compra salva!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao salvar unidade', description: error.message, variant: 'destructive' });
    },
  });

  // Register purchase mutation
  const registrarCompraMutation = useMutation({
    mutationFn: async () => {
      // Get current insumo cost for history
      const { data: insumoAtual } = await supabase
        .from('insumos')
        .select('custo_unitario')
        .eq('id', formData.insumo_id)
        .single();

      const custoAnterior = insumoAtual?.custo_unitario || 0;
      const variacao = custoAnterior > 0 
        ? ((custoUnitarioProducao - custoAnterior) / custoAnterior) * 100 
        : 0;

      // Insert stock movement with conversion info
      const { error: movError } = await supabase.from('estoque_movimentos').insert({
        empresa_id: usuario!.empresa_id,
        insumo_id: formData.insumo_id,
        tipo: 'entrada',
        quantidade: quantidadeConvertida,
        quantidade_original: quantidadeComprada,
        unidade_compra: unidadeSelecionada?.nome || formData.nova_unidade_nome || 'manual',
        fator_conversao: fatorConversao,
        custo_total: valorTotal,
        origem: 'manual',
        observacao: formData.fornecedor 
          ? `Compra - ${formData.fornecedor}` 
          : 'Compra manual',
      });
      if (movError) throw movError;

      // Record price history
      await supabase.from('historico_precos').insert({
        empresa_id: usuario!.empresa_id,
        insumo_id: formData.insumo_id,
        preco_anterior: custoAnterior,
        preco_novo: custoUnitarioProducao,
        variacao_percentual: variacao,
        origem: 'manual',
        observacao: formData.fornecedor || 'Compra manual',
      });

      // Update insumo cost
      await supabase
        .from('insumos')
        .update({ custo_unitario: custoUnitarioProducao })
        .eq('id', formData.insumo_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentos'] });
      queryClient.invalidateQueries({ queryKey: ['compras-manuais'] });
      queryClient.invalidateQueries({ queryKey: ['historico-precos'] });
      toast({ title: 'Compra registrada!', description: 'Estoque e custo atualizados.' });
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast({ title: 'Erro ao registrar compra', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      insumo_id: '',
      quantidade: '',
      unidade_compra_id: '',
      valor_total: '',
      fornecedor: '',
      fator_conversao_manual: '',
      nova_unidade_nome: '',
    });
    setShowNovaUnidade(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.insumo_id || !formData.quantidade || !formData.valor_total) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    if (fatorConversao <= 0) {
      toast({ title: 'Informe o fator de conversão', variant: 'destructive' });
      return;
    }

    // If creating a new unidade, save it first
    if (showNovaUnidade && formData.nova_unidade_nome && formData.fator_conversao_manual) {
      createUnidadeMutation.mutate({
        nome: formData.nova_unidade_nome,
        fator_conversao: parseFloat(formData.fator_conversao_manual),
      });
    }

    registrarCompraMutation.mutate();
  };

  const insumoOptions: SearchableSelectOption[] = (insumos || []).map(i => ({
    value: i.id,
    label: `${i.nome} (${i.unidade_medida})`,
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Registrar Compra
          </DialogTitle>
          <DialogDescription>
            Registre uma compra com conversão automática de unidades
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Insumo Selection */}
          <div className="space-y-2">
            <Label>Insumo *</Label>
            <SearchableSelect
              options={insumoOptions}
              value={formData.insumo_id}
              onValueChange={(value) => setFormData({ ...formData, insumo_id: value })}
              placeholder="Selecione o insumo..."
            />
            {insumoSelecionado && (
              <p className="text-xs text-muted-foreground">
                Unidade de produção: <strong>{insumoSelecionado.unidade_medida}</strong>
              </p>
            )}
          </div>

          {/* Purchase Data */}
          {formData.insumo_id && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 2"
                    value={formData.quantidade}
                    onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Valor Total *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="R$ 0,00"
                    value={formData.valor_total}
                    onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
                  />
                </div>
              </div>

              {/* Unit Selection */}
              <div className="space-y-2">
                <Label>Unidade de Compra</Label>
                {!showNovaUnidade ? (
                  <div className="flex gap-2">
                    <Select
                      value={formData.unidade_compra_id}
                      onValueChange={(value) => {
                        if (value === 'nova') {
                          setShowNovaUnidade(true);
                          setFormData(prev => ({ ...prev, unidade_compra_id: '' }));
                        } else {
                          setFormData({ ...formData, unidade_compra_id: value });
                        }
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione ou crie uma unidade..." />
                      </SelectTrigger>
                      <SelectContent>
                        {unidadesCompra?.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome} (1 = {u.fator_conversao} {insumoSelecionado?.unidade_medida})
                          </SelectItem>
                        ))}
                        <SelectItem value="nova" className="text-primary font-medium">
                          <span className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Nova unidade...
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Nova Unidade de Compra</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowNovaUnidade(false)}
                      >
                        Cancelar
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome da unidade</Label>
                        <Input
                          placeholder="Ex: pacote 500g"
                          value={formData.nova_unidade_nome}
                          onChange={(e) => setFormData({ ...formData, nova_unidade_nome: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          1 unidade = X {insumoSelecionado?.unidade_medida}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Ex: 500"
                          value={formData.fator_conversao_manual}
                          onChange={(e) => setFormData({ ...formData, fator_conversao_manual: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Supplier */}
              <div className="space-y-2">
                <Label>Fornecedor (opcional)</Label>
                <Input
                  placeholder="Nome do fornecedor"
                  value={formData.fornecedor}
                  onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                />
              </div>

              {/* Calculation Summary */}
              {fatorConversao > 0 && quantidadeComprada > 0 && valorTotal > 0 && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calculator className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Resumo da Conversão</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {quantidadeComprada} × {unidadeSelecionada?.nome || formData.nova_unidade_nome || 'unidade'}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge className="bg-primary">
                          {quantidadeConvertida.toFixed(2)} {insumoSelecionado?.unidade_medida}
                        </Badge>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Custo por {insumoSelecionado?.unidade_medida}:</span>
                        <span className="font-bold text-primary">{formatCurrency(custoUnitarioProducao)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={registrarCompraMutation.isPending || !fatorConversao || !quantidadeComprada}
            >
              {registrarCompraMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar Compra
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrarCompraDialog;
