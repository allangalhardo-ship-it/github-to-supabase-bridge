import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, FileText, Search, Package, AlertCircle } from 'lucide-react';
import BuscarInsumoDialog from './BuscarInsumoDialog';
import { InsumoIcon } from '@/lib/insumoIconUtils';
import { formatCurrencyBRL, formatCurrencySmartBRL } from '@/lib/format';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FichaTecnicaItem {
  id: string;
  quantidade: number;
  insumos: {
    id: string;
    nome: string;
    unidade_medida: string;
    custo_unitario: number;
  };
}

interface FichaTecnicaDialogProps {
  produtoId: string;
  produtoNome: string;
  fichaTecnica: FichaTecnicaItem[];
  rendimentoPadrao?: number | null;
  observacoesFicha?: string | null;
  trigger?: React.ReactNode;
}

interface InsumoSelecionado {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
}

interface LocalItem {
  tempId: string;
  id?: string;
  insumo: InsumoSelecionado;
  quantidade: number;
  isNew?: boolean;
  isDeleted?: boolean;
}

const FichaTecnicaDialog: React.FC<FichaTecnicaDialogProps> = ({ 
  produtoId, 
  produtoNome, 
  fichaTecnica, 
  rendimentoPadrao,
  observacoesFicha,
  trigger 
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [buscaOpen, setBuscaOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  
  // Estado local para edição
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [rendimento, setRendimento] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [novoInsumo, setNovoInsumo] = useState<InsumoSelecionado | null>(null);
  const [novaQuantidade, setNovaQuantidade] = useState('');

  // Inicializar estado local quando abrir o dialog
  useEffect(() => {
    if (open) {
      setLocalItems(
        fichaTecnica.map((ft, index) => ({
          tempId: `existing-${ft.id}`,
          id: ft.id,
          insumo: ft.insumos,
          quantidade: ft.quantidade,
          isNew: false,
          isDeleted: false,
        }))
      );
      setRendimento(rendimentoPadrao?.toString() || '');
      setObservacoes(observacoesFicha || '');
      setNovoInsumo(null);
      setNovaQuantidade('');
    }
  }, [open, fichaTecnica, rendimentoPadrao, observacoesFicha]);

  // Calcular custo total (apenas itens não deletados)
  const custoTotal = useMemo(() => {
    return localItems
      .filter(item => !item.isDeleted)
      .reduce((sum, item) => sum + (item.quantidade * item.insumo.custo_unitario), 0);
  }, [localItems]);

  // Calcular custo por unidade
  const custoPorUnidade = useMemo(() => {
    const rend = parseFloat(rendimento) || 0;
    if (rend <= 0 || custoTotal <= 0) return 0;
    return custoTotal / rend;
  }, [custoTotal, rendimento]);

  // Itens visíveis (não deletados)
  const itensVisiveis = localItems.filter(item => !item.isDeleted);
  
  // IDs de insumos já na lista
  const insumosNaFicha = itensVisiveis.map(item => item.insumo.id);

  // Verificar se há mudanças
  const hasChanges = useMemo(() => {
    const originalRendimento = rendimentoPadrao?.toString() || '';
    const originalObs = observacoesFicha || '';
    
    if (rendimento !== originalRendimento) return true;
    if (observacoes !== originalObs) return true;
    
    // Verificar se há itens novos ou deletados
    if (localItems.some(item => item.isNew || item.isDeleted)) return true;
    
    // Verificar se quantidades mudaram
    const originalMap = new Map(fichaTecnica.map(ft => [ft.id, ft.quantidade]));
    for (const item of localItems) {
      if (item.id && !item.isNew && !item.isDeleted) {
        const originalQty = originalMap.get(item.id);
        if (originalQty !== item.quantidade) return true;
      }
    }
    
    return false;
  }, [localItems, rendimento, observacoes, fichaTecnica, rendimentoPadrao, observacoesFicha]);

  // Adicionar item localmente
  const handleAddItem = () => {
    if (!novoInsumo || !novaQuantidade) return;
    
    const newItem: LocalItem = {
      tempId: `new-${Date.now()}`,
      insumo: novoInsumo,
      quantidade: parseFloat(novaQuantidade) || 0,
      isNew: true,
    };
    
    setLocalItems(prev => [...prev, newItem]);
    setNovoInsumo(null);
    setNovaQuantidade('');
  };

  // Remover item localmente
  const handleRemoveItem = (tempId: string) => {
    setLocalItems(prev => prev.map(item => 
      item.tempId === tempId 
        ? item.isNew 
          ? { ...item, isDeleted: true } // Itens novos são removidos da lista
          : { ...item, isDeleted: true } // Itens existentes são marcados para deleção
        : item
    ).filter(item => !(item.isNew && item.isDeleted))); // Remove novos que foram deletados
  };

  // Atualizar quantidade localmente
  const handleUpdateQuantidade = (tempId: string, newQty: number) => {
    setLocalItems(prev => prev.map(item => 
      item.tempId === tempId ? { ...item, quantidade: newQty } : item
    ));
  };

  // Salvar todas as mudanças
  const handleSave = async () => {
    setSaving(true);
    
    try {
      // 1. Atualizar produto (rendimento e observações)
      const { error: produtoError } = await supabase
        .from('produtos')
        .update({
          rendimento_padrao: parseFloat(rendimento) || null,
          observacoes_ficha: observacoes || null,
        })
        .eq('id', produtoId);
      
      if (produtoError) throw produtoError;

      // 2. Deletar itens marcados
      const itensParaDeletar = localItems.filter(item => item.isDeleted && item.id);
      for (const item of itensParaDeletar) {
        const { error } = await supabase
          .from('fichas_tecnicas')
          .delete()
          .eq('id', item.id);
        if (error) throw error;
      }

      // 3. Inserir novos itens
      const itensParaInserir = localItems.filter(item => item.isNew && !item.isDeleted);
      if (itensParaInserir.length > 0) {
        const { error } = await supabase
          .from('fichas_tecnicas')
          .insert(itensParaInserir.map(item => ({
            produto_id: produtoId,
            insumo_id: item.insumo.id,
            quantidade: item.quantidade,
          })));
        if (error) throw error;
      }

      // 4. Atualizar quantidades de itens existentes
      const itensParaAtualizar = localItems.filter(item => !item.isNew && !item.isDeleted && item.id);
      for (const item of itensParaAtualizar) {
        const original = fichaTecnica.find(ft => ft.id === item.id);
        if (original && original.quantidade !== item.quantidade) {
          const { error } = await supabase
            .from('fichas_tecnicas')
            .update({ quantidade: item.quantidade })
            .eq('id', item.id);
          if (error) throw error;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast({ title: 'Ficha técnica salva com sucesso!' });
      setOpen(false);
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Cancelar e fechar
  const handleCancel = () => {
    if (hasChanges) {
      setShowDiscardAlert(true);
    } else {
      setOpen(false);
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardAlert(false);
    setOpen(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && hasChanges) {
      setShowDiscardAlert(true);
    } else {
      setOpen(newOpen);
    }
  };

  const handleInsumoSelect = (insumo: InsumoSelecionado) => {
    setNovoInsumo(insumo);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="secondary" size="sm" className="justify-center gap-2">
              <FileText className="h-4 w-4" />
              Ficha Técnica ({fichaTecnica.length})
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-4 pb-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Ficha Técnica: {produtoNome}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Campo de Rendimento */}
            <div className="space-y-2">
              <Label htmlFor="rendimento" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Rendimento
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="rendimento"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 10"
                  value={rendimento}
                  onChange={(e) => setRendimento(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">unidades produzidas com esta ficha</span>
              </div>
            </div>

            {/* Adicionar novo insumo */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Adicionar Ingrediente</Label>
              
              {/* Insumo selecionado ou botão de busca */}
              {novoInsumo ? (
                <div className="border rounded-lg p-3 bg-accent/30">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <InsumoIcon nome={novoInsumo.nome} className="h-4 w-4 shrink-0 text-primary" />
                        <span className="font-medium text-sm">{novoInsumo.nome}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="bg-muted px-1.5 py-0.5 rounded font-medium">{novoInsumo.unidade_medida}</span>
                        <span>•</span>
                        <span>{formatCurrencySmartBRL(novoInsumo.custo_unitario)} por {novoInsumo.unidade_medida}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => setNovoInsumo(null)}
                    >
                      Trocar
                    </Button>
                  </div>
                  
                  {/* Quantidade */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <Label htmlFor="nova-quantidade" className="text-xs text-muted-foreground whitespace-nowrap">
                      Quantidade:
                    </Label>
                    <Input
                      id="nova-quantidade"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={novaQuantidade}
                      onChange={(e) => setNovaQuantidade(e.target.value)}
                      className="w-24 h-8 text-center"
                    />
                    <span className="text-sm font-medium text-muted-foreground">{novoInsumo.unidade_medida}</span>
                    <div className="flex-1" />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddItem}
                      disabled={!novaQuantidade || parseFloat(novaQuantidade) <= 0}
                      className="h-8"
                    >
                      Adicionar
                    </Button>
                  </div>
                  
                  {/* Preview do custo em tempo real */}
                  {novaQuantidade && parseFloat(novaQuantidade) > 0 && (
                    <div className="flex items-center justify-between text-xs bg-primary/10 rounded px-2 py-1.5 mt-2">
                      <span className="text-muted-foreground">
                        {parseFloat(novaQuantidade)} {novoInsumo.unidade_medida} × {formatCurrencySmartBRL(novoInsumo.custo_unitario)}
                      </span>
                      <span className="font-semibold text-primary">
                        = {formatCurrencyBRL(parseFloat(novaQuantidade) * novoInsumo.custo_unitario)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBuscaOpen(true)}
                  className="w-full justify-start gap-2 h-10"
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Buscar insumo para adicionar...</span>
                </Button>
              )}
            </div>

            {/* Lista de ingredientes */}
            {itensVisiveis.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ingredientes na Ficha</Label>
                <div className="divide-y border rounded-md">
                  {itensVisiveis.map((item) => (
                    <div
                      key={item.tempId}
                      className={`p-3 ${item.isNew ? 'bg-success/5' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate flex items-center gap-1.5">
                            <InsumoIcon nome={item.insumo.nome} className="h-3.5 w-3.5 shrink-0 text-primary" />
                            {item.insumo.nome}
                            {item.isNew && (
                              <span className="text-[10px] text-success bg-success/10 px-1 rounded">novo</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatCurrencySmartBRL(item.insumo.custo_unitario)} por {item.insumo.unidade_medida}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.quantidade}
                            className="w-16 h-8 text-center text-sm"
                            onChange={(e) => handleUpdateQuantidade(item.tempId, parseFloat(e.target.value) || 0)}
                          />
                          <span className="text-xs text-muted-foreground w-8">{item.insumo.unidade_medida}</span>
                        </div>
                        <span className="w-20 text-right text-sm font-semibold">
                          {formatCurrencyBRL(item.quantidade * item.insumo.custo_unitario)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive flex-shrink-0"
                          onClick={() => handleRemoveItem(item.tempId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estado vazio */}
            {itensVisiveis.length === 0 && (
              <div className="text-center py-6 border rounded-md bg-muted/20">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhum ingrediente adicionado.</p>
                <p className="text-xs text-muted-foreground">Clique em buscar para adicionar.</p>
              </div>
            )}

            {/* Observações */}
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações / Modo de Preparo (opcional)</Label>
              <Textarea
                id="observacoes"
                placeholder="Ex: Assar por 15 minutos a 180°C, deixar esfriar antes de embalar..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Alerta se não tem rendimento */}
            {itensVisiveis.length > 0 && !rendimento && (
              <Alert variant="default" className="bg-warning/10 border-warning/30">
                <AlertCircle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-sm">
                  Defina o rendimento para calcular o custo por unidade.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Resumo de custos */}
          <div className="border-t bg-muted/30 p-4 flex-shrink-0">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Custo Total:</span>
                <span className="font-bold text-lg">{formatCurrencyBRL(custoTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Custo/Unidade:</span>
                <span className={`font-bold text-lg ${custoPorUnidade > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {custoPorUnidade > 0 ? formatCurrencySmartBRL(custoPorUnidade) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Botões Salvar/Cancelar - Padronizados */}
          <DialogFooter className="p-4 pt-0 border-t flex-shrink-0 gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={handleSave} 
              disabled={saving || !hasChanges}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BuscarInsumoDialog
        open={buscaOpen}
        onOpenChange={setBuscaOpen}
        onSelect={handleInsumoSelect}
        insumosExcluidos={insumosNaFicha}
      />

      <AlertDialog open={showDiscardAlert} onOpenChange={setShowDiscardAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações não salvas. Deseja descartá-las?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscard}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FichaTecnicaDialog;
