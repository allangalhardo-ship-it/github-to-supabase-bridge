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
import { Trash2, FileText, Search, Calculator, ExternalLink, Lightbulb, X, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import BuscarInsumoDialog from './BuscarInsumoDialog';
import CustoMargemCard from './CustoMargemCard';
import { InsumoIcon } from '@/lib/insumoIconUtils';
import { formatCurrencyBRL, formatCurrencySmartBRL } from '@/lib/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calcularCustoItem, unidadesCompativeis } from '@/utils/custoFicha';

const GRUPOS_UNIDADE: Record<string, string[]> = {
  massa: ['mg', 'g', 'kg'],
  volume: ['ml', 'l'],
  contagem: ['un'],
};
function unidadesDoGrupo(unidadeInsumo: string): string[] {
  const u = (unidadeInsumo || '').toLowerCase();
  for (const [, arr] of Object.entries(GRUPOS_UNIDADE)) {
    if (arr.some((x) => unidadesCompativeis(x, u))) return arr;
  }
  return [u || 'un'];
}


interface FichaTecnicaItem {
  id: string;
  quantidade: number;
  unidade: string | null;
  insumos: {
    id: string;
    nome: string;
    unidade_medida: string;
    custo_unitario: number;
    fator_perda?: number | null;
  } | null;
}

interface FichaTecnicaDialogProps {
  produtoId: string;
  produtoNome: string;
  fichaTecnica: FichaTecnicaItem[];
  rendimentoPadrao?: number | null;
  observacoesFicha?: string | null;
  /** Preço base do produto (Balcão) — para mostrar margem em tempo real */
  precoBase?: number;
  /** % de imposto médio configurado — para cálculo de margem */
  impostoPercentual?: number;
  /** Margem-alvo configurada (% — para destacar verde/amarelo/vermelho) */
  margemAlvo?: number;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
  onClose?: () => void;
}


interface InsumoSelecionado {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  fator_perda?: number | null;
}

interface LocalItem {
  tempId: string;
  id?: string;
  insumo: InsumoSelecionado;
  quantidade: number;
  unidade: string; // unidade da quantidade na ficha (pode diferir da do insumo)
  isNew?: boolean;
  isDeleted?: boolean;
}

const FichaTecnicaDialog: React.FC<FichaTecnicaDialogProps> = ({ 
  produtoId, 
  produtoNome, 
  fichaTecnica, 
  rendimentoPadrao,
  observacoesFicha,
  precoBase = 0,
  impostoPercentual = 0,
  margemAlvo = 30,
  trigger,
  defaultOpen = false,
  onClose,
}) => {

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  const [buscaOpen, setBuscaOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [pendingDuplicateInsumo, setPendingDuplicateInsumo] = useState<InsumoSelecionado | null>(null);

  // Tutorial: show only on first open ever
  const [showTutorial, setShowTutorial] = useState(() => {
    return localStorage.getItem('ficha-tecnica-tutorial-seen') !== 'true';
  });

  const dismissTutorial = () => {
    localStorage.setItem('ficha-tecnica-tutorial-seen', 'true');
    setShowTutorial(false);
  };

  // Sync with defaultOpen prop
  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
    }
  }, [defaultOpen]);
  
  // Estado local para edição
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [novoInsumo, setNovoInsumo] = useState<InsumoSelecionado | null>(null);
  const [novaQuantidade, setNovaQuantidade] = useState('');
  const [novaUnidade, setNovaUnidade] = useState('');
  const [rendimentoLocal, setRendimentoLocal] = useState<string>('');
  // (mantido valor inicial vindo dos props)

  // Inicializar estado local quando abrir o dialog
  useEffect(() => {
    if (open) {
      setLocalItems(
        fichaTecnica
          .filter((ft) => ft.insumos !== null) // descarta itens com insumo deletado
          .map((ft) => ({
            tempId: `existing-${ft.id}`,
            id: ft.id,
            insumo: ft.insumos!,
            quantidade: ft.quantidade,
            unidade: ft.unidade || ft.insumos!.unidade_medida,
            isNew: false,
            isDeleted: false,
          })),
      );
      setObservacoes(observacoesFicha || '');
      setNovoInsumo(null);
      setNovaQuantidade('');
      setNovaUnidade('');
      setRendimentoLocal((rendimentoPadrao ?? '').toString());
    }
  }, [open, fichaTecnica, observacoesFicha, rendimentoPadrao]);

  // itens com insumo deletado (alerta visual)
  const itensOrfaos = fichaTecnica.filter((ft) => ft.insumos === null);

  // Calcular custo total (apenas itens não deletados) usando o util central
  const custoTotal = useMemo(() => {
    return localItems
      .filter((item) => !item.isDeleted)
      .reduce(
        (sum, item) =>
          sum +
          calcularCustoItem({
            quantidade: item.quantidade,
            unidade: item.unidade,
            insumos: item.insumo,
          }),
        0,
      );
  }, [localItems]);

  // Itens visíveis (não deletados)
  const itensVisiveis = localItems.filter(item => !item.isDeleted);
  
  // IDs de insumos já na lista
  const insumosNaFicha = itensVisiveis.map(item => item.insumo.id);

  // Verificar se há mudanças
  const hasChanges = useMemo(() => {
    const originalObs = observacoesFicha || '';
    const originalRend = (rendimentoPadrao ?? '').toString();

    if (observacoes !== originalObs) return true;
    if (rendimentoLocal !== originalRend) return true;

    // Verificar se há itens novos ou deletados
    if (localItems.some(item => item.isNew || item.isDeleted)) return true;

    // Verificar se quantidades/unidades mudaram
    const originalMap = new Map(
      fichaTecnica
        .filter(ft => ft.insumos !== null)
        .map(ft => [ft.id, { q: ft.quantidade, u: ft.unidade || ft.insumos!.unidade_medida }]),
    );
    for (const item of localItems) {
      if (item.id && !item.isNew && !item.isDeleted) {
        const orig = originalMap.get(item.id);
        if (!orig || orig.q !== item.quantidade || orig.u !== item.unidade) return true;
      }
    }

    return false;
  }, [localItems, observacoes, rendimentoLocal, rendimentoPadrao, fichaTecnica, observacoesFicha]);

  // Adicionar item localmente
  const handleAddItem = () => {
    if (!novoInsumo || !novaQuantidade) return;
    
    const newItem: LocalItem = {
      tempId: `new-${Date.now()}`,
      insumo: novoInsumo,
      quantidade: parseFloat(novaQuantidade) || 0,
      unidade: novaUnidade || novoInsumo.unidade_medida,
      isNew: true,
    };

    setLocalItems(prev => [...prev, newItem]);
    setNovoInsumo(null);
    setNovaQuantidade('');
    setNovaUnidade('');
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
      // 1. Atualizar produto (observações + rendimento)
      const rendimentoNum = parseInt(rendimentoLocal, 10);
      const { error: produtoError } = await supabase
        .from('produtos')
        .update({
          observacoes_ficha: observacoes || null,
          rendimento_padrao: Number.isFinite(rendimentoNum) && rendimentoNum > 0 ? rendimentoNum : null,
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
            unidade: item.unidade,
          })));
        if (error) throw error;
      }

      // 4. Atualizar quantidade + unidade de itens existentes
      const itensParaAtualizar = localItems.filter(item => !item.isNew && !item.isDeleted && item.id);
      for (const item of itensParaAtualizar) {
        const original = fichaTecnica.find(ft => ft.id === item.id);
        const unidadeOriginal = original?.unidade || original?.insumos?.unidade_medida;
        if (original && (original.quantidade !== item.quantidade || unidadeOriginal !== item.unidade)) {
          const { error } = await supabase
            .from('fichas_tecnicas')
            .update({ quantidade: item.quantidade, unidade: item.unidade })
            .eq('id', item.id);
          if (error) throw error;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast({ title: 'Ficha técnica salva com sucesso!' });
      setOpen(false);
      if (onClose) onClose();
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
    if (onClose) onClose();
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && hasChanges) {
      setShowDiscardAlert(true);
    } else {
      setOpen(newOpen);
      if (!newOpen && onClose) {
        onClose();
      }
    }
  };

  const handleInsumoSelect = (insumo: InsumoSelecionado) => {
    // Check if this insumo already exists in the list
    const jaExiste = insumosNaFicha.includes(insumo.id);
    if (jaExiste) {
      setPendingDuplicateInsumo(insumo);
      setShowDuplicateAlert(true);
    } else {
      setNovoInsumo(insumo);
    }
  };

  const handleConfirmDuplicate = () => {
    if (pendingDuplicateInsumo) {
      setNovoInsumo(pendingDuplicateInsumo);
    }
    setPendingDuplicateInsumo(null);
    setShowDuplicateAlert(false);
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

            {/* Tutorial para primeira vez */}
            {showTutorial && open && (
              <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Como funciona a ficha técnica?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Adicione cada ingrediente e a quantidade usada para fazer <strong>1 unidade</strong> deste produto. 
                    O sistema calcula o custo automaticamente!
                  </p>
                </div>
                <button
                  onClick={dismissTutorial}
                  className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                  aria-label="Fechar dica"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
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
                      className="w-20 h-8 text-center"
                    />
                    <Select
                      value={novaUnidade || novoInsumo.unidade_medida}
                      onValueChange={setNovaUnidade}
                    >
                      <SelectTrigger className="w-[72px] h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {unidadesDoGrupo(novoInsumo.unidade_medida).map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

                  {/* Preview do custo em tempo real (com conversão) */}
                  {novaQuantidade && parseFloat(novaQuantidade) > 0 && (() => {
                    const previewUnidade = novaUnidade || novoInsumo.unidade_medida;
                    const previewCusto = calcularCustoItem({
                      quantidade: parseFloat(novaQuantidade),
                      unidade: previewUnidade,
                      insumos: novoInsumo,
                    });
                    return (
                      <div className="flex items-center justify-between text-xs bg-primary/10 rounded px-2 py-1.5 mt-2">
                        <span className="text-muted-foreground">
                          {parseFloat(novaQuantidade)} {previewUnidade}
                          {previewUnidade !== novoInsumo.unidade_medida && (
                            <> (= {novoInsumo.unidade_medida})</>
                          )}
                        </span>
                        <span className="font-semibold text-primary">
                          = {formatCurrencyBRL(previewCusto)}
                        </span>
                      </div>
                    );
                  })()}
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

            {/* Alerta de itens órfãos (insumo deletado) */}
            {itensOrfaos.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-xs text-destructive">
                  <p className="font-semibold">{itensOrfaos.length} ingrediente(s) removido(s) do cadastro</p>
                  <p>Esses itens aparecem com custo zero. Remova a ficha ou recadastre o insumo na tela de Insumos.</p>
                </div>
              </div>
            )}

            {/* Lista de ingredientes */}
            {itensVisiveis.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ingredientes na Ficha</Label>
                <div className="divide-y border rounded-md">
                  {itensVisiveis.map((item) => {
                    const unidadesLinha = unidadesDoGrupo(item.insumo.unidade_medida);
                    const custoLinha = calcularCustoItem({
                      quantidade: item.quantidade,
                      unidade: item.unidade,
                      insumos: item.insumo,
                    });
                    return (
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
                              {Number(item.insumo.fator_perda || 0) > 0 && (
                                <> • perda {Number(item.insumo.fator_perda).toFixed(0)}%</>
                              )}
                            </p>
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.quantidade}
                            className="w-16 h-8 text-center text-sm"
                            onChange={(e) => handleUpdateQuantidade(item.tempId, parseFloat(e.target.value) || 0)}
                          />
                          <Select
                            value={item.unidade}
                            onValueChange={(v) =>
                              setLocalItems((prev) =>
                                prev.map((it) => (it.tempId === item.tempId ? { ...it, unidade: v } : it)),
                              )
                            }
                          >
                            <SelectTrigger className="w-[64px] h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {unidadesLinha.map((u) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="w-20 text-right text-sm font-semibold tabular-nums">
                            {formatCurrencyBRL(custoLinha)}
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
                    );
                  })}
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
          </div>

          {/* Resumo de custo + margem por canal (tempo real) + Link para Calculador */}
          <div className="border-t bg-muted/30 p-4 flex-shrink-0 space-y-3">
            <CustoMargemCard
              custoFicha={custoTotal}
              precoBase={precoBase}
              produtoId={produtoId}
              impostoPercentual={impostoPercentual}
              margemAlvo={margemAlvo}
              compact
            />

            {/* Link para Calculador de Ficha Técnica */}
            <Link 
              to="/receitas?tab=calculador" 
              className="flex items-center gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors group"
              onClick={() => setOpen(false)}
            >
              <Calculator className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-primary group-hover:underline">
                  Calculador de Preço por Lote
                </p>
                <p className="text-xs text-muted-foreground">
                  Informe as quantidades de ingredientes que você compra e descubra quantas unidades rende e o preço ideal de venda
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
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
        insumosExistentes={insumosNaFicha}
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

      <AlertDialog open={showDuplicateAlert} onOpenChange={setShowDuplicateAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ingrediente já adicionado</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDuplicateInsumo?.nome}" já está na ficha técnica. Deseja adicionar novamente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDuplicateInsumo(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDuplicate}>
              Adicionar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FichaTecnicaDialog;
