// RegistrarCompraDialog - Formulário de compra manual com cálculo automático de valor total
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
import { inserirMovimentoEstoque } from '@/lib/estoqueUtils';

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
    valor_unitario: '',
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

      // Insert stock movement with conversion info - uses helper that normalizes qty
      await inserirMovimentoEstoque({
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
      valor_unitario: '',
      valor_total: '',
      fornecedor: '',
      fator_conversao_manual: '',
      nova_unidade_nome: '',
    });
    setShowNovaUnidade(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.insumo_id || !formData.quantidade || !formData.valor_unitario) {
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
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Package className="h-5 w-5 text-primary shrink-0" />
            Registrar Compra
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Registre uma compra com conversão automática de unidades
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Insumo Selection */}
          <div className="space-y-2">
            <Label className="text-sm">Insumo *</Label>
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
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="space-y-1 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Quantidade *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 2"
                    value={formData.quantidade}
                    onChange={(e) => {
                      const qtd = e.target.value;
                      const valorUnit = parseFloat(formData.valor_unitario) || 0;
                      const novoTotal = (parseFloat(qtd) || 0) * valorUnit;
                      setFormData({ 
                        ...formData, 
                        quantidade: qtd,
                        valor_total: novoTotal > 0 ? novoTotal.toFixed(2) : ''
                      });
                    }}
                    className="h-9 sm:h-10"
                  />
                </div>

                <div className="space-y-1 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Vlr Unit. *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="R$ 0,00"
                    value={formData.valor_unitario}
                    onChange={(e) => {
                      const valorUnit = e.target.value;
                      const qtd = parseFloat(formData.quantidade) || 0;
                      const novoTotal = qtd * (parseFloat(valorUnit) || 0);
                      setFormData({ 
                        ...formData, 
                        valor_unitario: valorUnit,
                        valor_total: novoTotal > 0 ? novoTotal.toFixed(2) : ''
                      });
                    }}
                    className="h-9 sm:h-10"
                  />
                </div>

                <div className="space-y-1 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Total</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="R$ 0,00"
                    value={formData.valor_total}
                    readOnly
                    className="bg-muted h-9 sm:h-10"
                  />
                </div>
              </div>

              {/* Unit Selection */}
              <div className="space-y-2">
                <Label className="text-sm">Unidade de Compra</Label>
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
                        <SelectValue placeholder="Selecione ou crie..." />
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
                      <span className="text-xs sm:text-sm font-medium">Nova Unidade</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowNovaUnidade(false)}
                        className="h-7 text-xs"
                      >
                        Cancelar
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome da unidade</Label>
                        <Input
                          placeholder="Ex: pacote 500g"
                          value={formData.nova_unidade_nome}
                          onChange={(e) => setFormData({ ...formData, nova_unidade_nome: e.target.value })}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          1 un = X {insumoSelecionado?.unidade_medida}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Ex: 500"
                          value={formData.fator_conversao_manual}
                          onChange={(e) => setFormData({ ...formData, fator_conversao_manual: e.target.value })}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Supplier */}
              <div className="space-y-2">
                <Label className="text-sm">Fornecedor (opcional)</Label>
                <Input
                  placeholder="Nome do fornecedor"
                  value={formData.fornecedor}
                  onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                />
              </div>

              {/* Calculation Summary */}
              {fatorConversao > 0 && quantidadeComprada > 0 && valorTotal > 0 && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-3 sm:pt-4">
                    <div className="flex items-center gap-2 mb-2 sm:mb-3">
                      <Calculator className="h-4 w-4 text-primary" />
                      <span className="font-medium text-xs sm:text-sm">Resumo da Conversão</span>
                    </div>
                    <div className="space-y-2 text-xs sm:text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {quantidadeComprada} × {unidadeSelecionada?.nome || formData.nova_unidade_nome || 'unidade'}
                        </Badge>
                        <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        <Badge className="bg-primary text-xs">
                          {quantidadeConvertida.toFixed(2)} {insumoSelecionado?.unidade_medida}
                        </Badge>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Custo/{insumoSelecionado?.unidade_medida}:</span>
                        <span className="font-bold text-primary">{formatCurrency(custoUnitarioProducao)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </form>

        {/* Footer fixo */}
        <div className="shrink-0 border-t p-4 sm:p-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={registrarCompraMutation.isPending || !fatorConversao || !quantidadeComprada}
            className="w-full sm:w-auto"
          >
            {registrarCompraMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Compra
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrarCompraDialog;
