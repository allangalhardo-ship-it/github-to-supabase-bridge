import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { invalidateEmpresaCachesAndRefetch } from "@/lib/queryConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Trash2, ChefHat, ClipboardList } from "lucide-react";
import { InsumoIcon } from "@/lib/insumoIconUtils";
import { toast } from "sonner";
import { Receita, Insumo, ReceitaIngrediente, formatCurrency, formatCurrencySmart } from "./types";

interface IngredientesReceitaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receita: Receita | null;
  insumosSimples: Insumo[] | undefined;
  todasReceitas: Receita[] | undefined;
}

export function IngredientesReceitaDialog({
  open,
  onOpenChange,
  receita,
  insumosSimples,
  todasReceitas,
}: IngredientesReceitaDialogProps) {
  const { usuario } = useAuth();
  const [novoIngrediente, setNovoIngrediente] = useState({ insumo_id: '', quantidade: '' });
  const [localQuantidades, setLocalQuantidades] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch ingredientes da receita selecionada
  const { data: ingredientesReceita } = useQuery({
    queryKey: ["ingredientes-receita", usuario?.empresa_id, receita?.id],
    queryFn: async () => {
      if (!receita) return [];
      
      const { data, error } = await supabase
        .from("receitas_intermediarias")
        .select(`
          id,
          insumo_id,
          insumo_ingrediente_id,
          quantidade,
          insumo_ingrediente:insumos!receitas_intermediarias_insumo_ingrediente_id_fkey (
            id,
            nome,
            unidade_medida,
            custo_unitario
          )
        `)
        .eq("insumo_id", receita.id);

      if (error) throw error;
      
      // Initialize local quantidades from fetched data
      const quantidades: Record<string, number> = {};
      (data || []).forEach(item => {
        quantidades[item.id] = item.quantidade;
      });
      setLocalQuantidades(quantidades);
      setHasChanges(false);
      
      return data as ReceitaIngrediente[];
    },
    enabled: !!receita?.id && !!usuario?.empresa_id,
  });

  // Combina insumos simples + outras receitas (intermediários) para seleção
  const todosInsumosDisponiveis = [
    ...(insumosSimples || []).map(i => ({ ...i, isReceita: false })),
    ...(todasReceitas || [])
      .filter(r => r.id !== receita?.id) // Exclui a própria receita
      .map(r => ({ 
        id: r.id, 
        nome: r.nome, 
        unidade_medida: r.unidade_medida, 
        custo_unitario: r.custo_unitario,
        is_intermediario: true,
        isReceita: true 
      }))
  ].filter(i => 
    !ingredientesReceita?.some(r => r.insumo_ingrediente_id === i.id)
  );

  const insumoSelecionadoReceitaInfo = todosInsumosDisponiveis?.find(i => i.id === novoIngrediente.insumo_id);

  const recalcularCustoReceita = async () => {
    if (!receita) return;

    // Buscar ingredientes atualizados diretamente do banco
    const { data: ingredientesAtualizados } = await supabase
      .from("receitas_intermediarias")
      .select(`
        quantidade,
        insumo_ingrediente:insumos!receitas_intermediarias_insumo_ingrediente_id_fkey (
          custo_unitario
        )
      `)
      .eq("insumo_id", receita.id);

    const custoTotal = (ingredientesAtualizados || []).reduce((sum, item) => {
      const custoIngrediente = (item.insumo_ingrediente as any)?.custo_unitario || 0;
      return sum + (item.quantidade * custoIngrediente);
    }, 0);

    const rendimentoVal = receita.rendimento_receita || 1;
    const custoUnitario = custoTotal / rendimentoVal;

    const { error } = await supabase
      .from("insumos")
      .update({ custo_unitario: custoUnitario })
      .eq("id", receita.id);

    if (!error) {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
    }
  };

  const addIngredienteMutation = useMutation({
    mutationFn: async () => {
      if (!receita) throw new Error("Nenhuma receita selecionada");
      
      const { error } = await supabase.from("receitas_intermediarias").insert({
        insumo_id: receita.id,
        insumo_ingrediente_id: novoIngrediente.insumo_id,
        quantidade: parseFloat(novoIngrediente.quantidade) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      setNovoIngrediente({ insumo_id: '', quantidade: '' });
      toast.success("Ingrediente adicionado!");
      recalcularCustoReceita();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeIngredienteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("receitas_intermediarias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast.success("Ingrediente removido!");
      recalcularCustoReceita();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleLocalQuantidadeChange = (id: string, value: string) => {
    const quantidade = parseFloat(value) || 0;
    setLocalQuantidades(prev => ({ ...prev, [id]: quantidade }));
    
    // Check if this differs from the original
    const originalItem = ingredientesReceita?.find(item => item.id === id);
    if (originalItem && originalItem.quantidade !== quantidade) {
      setHasChanges(true);
    }
  };

  const handleSaveAll = async () => {
    if (!ingredientesReceita) return;
    
    try {
      // Update all changed quantities
      const updates = ingredientesReceita
        .filter(item => localQuantidades[item.id] !== item.quantidade && localQuantidades[item.id] > 0)
        .map(item => 
          supabase
            .from("receitas_intermediarias")
            .update({ quantidade: localQuantidades[item.id] })
            .eq("id", item.id)
        );
      
      await Promise.all(updates);
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      await recalcularCustoReceita();
      
      toast.success("Alterações salvas!");
      setHasChanges(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar");
    }
  };

  const handleClose = () => {
    setNovoIngrediente({ insumo_id: '', quantidade: '' });
    setLocalQuantidades({});
    setHasChanges(false);
    onOpenChange(false);
  };

  // Calculate custo total based on local quantities
  const custoTotal = ingredientesReceita?.reduce((sum, item) => {
    const qty = localQuantidades[item.id] ?? item.quantidade;
    return sum + (qty * (item.insumo_ingrediente?.custo_unitario || 0));
  }, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-3 sm:p-6 sm:pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ChefHat className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">Ingredientes: {receita?.nome}</span>
          </DialogTitle>
          {/* Info da receita */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground pt-2">
            <span>Unidade: <strong className="text-foreground">{receita?.unidade_medida}</strong></span>
            <span>Rendimento: <strong className="text-foreground">{receita?.rendimento_receita || 1} {receita?.unidade_medida}</strong></span>
            <span>Custo: <strong className="text-primary">{formatCurrencySmart(receita?.custo_unitario || 0)}/{receita?.unidade_medida}</strong></span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {/* Lista de ingredientes */}
          {ingredientesReceita && ingredientesReceita.length > 0 ? (
            <div className="divide-y border rounded-lg">
              {ingredientesReceita.map((item) => {
                const qty = localQuantidades[item.id] ?? item.quantidade;
                const custoItem = qty * (item.insumo_ingrediente?.custo_unitario || 0);
                
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <InsumoIcon nome={item.insumo_ingrediente?.nome || ''} className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium text-sm truncate">{item.insumo_ingrediente?.nome}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={qty}
                        onChange={(e) => handleLocalQuantidadeChange(item.id, e.target.value)}
                        className="w-20 h-8 text-center text-sm"
                      />
                      <span className="text-xs text-muted-foreground w-8">{item.insumo_ingrediente?.unidade_medida}</span>
                      <span className="text-sm font-medium w-20 text-right">
                        {formatCurrency(custoItem)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeIngredienteMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 border rounded-lg bg-muted/20">
              <ChefHat className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Nenhum ingrediente cadastrado ainda.
              </p>
            </div>
          )}

          {/* Custo total */}
          {ingredientesReceita && ingredientesReceita.length > 0 && (
            <div className="flex justify-between items-center pt-2 px-1 font-medium text-sm">
              <span className="text-muted-foreground">Custo total:</span>
              <span className="text-lg text-primary font-bold">{formatCurrency(custoTotal)}</span>
            </div>
          )}

          {/* Área de adicionar ingrediente */}
          {todosInsumosDisponiveis.length > 0 && (
            <div className="pt-4 border-t space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Adicionar ingrediente</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <SearchableSelect
                  options={todosInsumosDisponiveis.map((insumo) => ({
                    value: insumo.id,
                    label: `${insumo.nome} (${insumo.unidade_medida})`,
                    searchTerms: insumo.nome,
                    icon: insumo.isReceita 
                      ? <ClipboardList className="h-4 w-4 text-primary" />
                      : <InsumoIcon nome={insumo.nome} className="h-4 w-4" />,
                  }))}
                  value={novoIngrediente.insumo_id}
                  onValueChange={(value) => setNovoIngrediente({ ...novoIngrediente, insumo_id: value })}
                  placeholder="Buscar ingrediente ou receita..."
                  searchPlaceholder="Digite para buscar..."
                  emptyMessage="Nenhum ingrediente encontrado."
                  className="flex-1"
                />
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={insumoSelecionadoReceitaInfo ? `Qtd (${insumoSelecionadoReceitaInfo.unidade_medida})` : "Quantidade"}
                    value={novoIngrediente.quantidade}
                    onChange={(e) => setNovoIngrediente({ ...novoIngrediente, quantidade: e.target.value })}
                    className="w-full sm:w-28"
                  />
                  <Button
                    onClick={() => addIngredienteMutation.mutate()}
                    disabled={!novoIngrediente.insumo_id || !novoIngrediente.quantidade || addIngredienteMutation.isPending}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Adicionar</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer com botões */}
        <div className="shrink-0 border-t p-4 flex justify-end gap-2">
          <Button onClick={handleClose} variant="outline">
            Fechar
          </Button>
          <Button 
            onClick={handleSaveAll} 
            disabled={!hasChanges}
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}