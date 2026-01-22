import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, Trash2, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { Receita, Insumo, ReceitaIngrediente, formatCurrency } from "./types";

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
  const queryClient = useQueryClient();
  const [novoIngrediente, setNovoIngrediente] = useState({ insumo_id: '', quantidade: '' });

  // Fetch ingredientes da receita selecionada
  const { data: ingredientesReceita } = useQuery({
    queryKey: ["ingredientes-receita", receita?.id],
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
      return data as ReceitaIngrediente[];
    },
    enabled: !!receita?.id,
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
    if (!receita || !ingredientesReceita) return;

    const custoTotal = ingredientesReceita.reduce((sum, item) => {
      const custoIngrediente = item.insumo_ingrediente?.custo_unitario || 0;
      return sum + (item.quantidade * custoIngrediente);
    }, 0);

    const rendimentoVal = receita.rendimento_receita || 1;
    const custoUnitario = custoTotal / rendimentoVal;

    await supabase
      .from("insumos")
      .update({ custo_unitario: custoUnitario })
      .eq("id", receita.id);

    queryClient.invalidateQueries({ queryKey: ["receitas"] });
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
      queryClient.invalidateQueries({ queryKey: ["ingredientes-receita"] });
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
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
      queryClient.invalidateQueries({ queryKey: ["ingredientes-receita"] });
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
      toast.success("Ingrediente removido!");
      recalcularCustoReceita();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleClose = () => {
    setNovoIngrediente({ insumo_id: '', quantidade: '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 sm:p-6 sm:pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ChefHat className="h-5 w-5 text-primary shrink-0" />
            <span className="truncate">Ingredientes: {receita?.nome}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Info da receita - responsivo */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <span>Unidade: <strong>{receita?.unidade_medida}</strong></span>
              <span>Rendimento: <strong>{receita?.rendimento_receita || 1} {receita?.unidade_medida}</strong></span>
              <span>Custo: <strong className="text-primary">{formatCurrency(receita?.custo_unitario || 0)}/{receita?.unidade_medida}</strong></span>
            </div>
          </div>

          {/* Lista de ingredientes */}
          {ingredientesReceita && ingredientesReceita.length > 0 ? (
            <div className="space-y-2">
              {ingredientesReceita.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-muted/50 rounded-lg gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{item.insumo_ingrediente?.nome}</span>
                    <Badge variant="outline" className="self-start sm:self-auto text-xs">
                      {item.quantidade} {item.insumo_ingrediente?.unidade_medida}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <span className="text-sm font-medium text-muted-foreground">
                      {formatCurrency(item.quantidade * (item.insumo_ingrediente?.custo_unitario || 0))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => removeIngredienteMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              <div className="flex justify-between pt-3 border-t font-medium text-sm">
                <span>Custo total:</span>
                <span className="text-primary">
                  {formatCurrency(
                    ingredientesReceita.reduce((sum, item) => 
                      sum + (item.quantidade * (item.insumo_ingrediente?.custo_unitario || 0)), 0
                    )
                  )}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-6 text-sm">
              Nenhum ingrediente cadastrado ainda.
            </p>
          )}
        </div>

        {/* Área de adicionar ingrediente - fixa no bottom */}
        {todosInsumosDisponiveis.length > 0 && (
          <div className="shrink-0 border-t bg-background p-4 sm:p-6 space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Adicionar ingrediente</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <SearchableSelect
                options={todosInsumosDisponiveis.map((insumo) => ({
                  value: insumo.id,
                  label: `${insumo.isReceita ? '🍳 ' : ''}${insumo.nome} (${insumo.unidade_medida})`,
                  searchTerms: insumo.nome,
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

        {/* Footer */}
        <div className="shrink-0 border-t p-4 sm:p-6 flex justify-end">
          <Button onClick={handleClose} variant="outline">Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
