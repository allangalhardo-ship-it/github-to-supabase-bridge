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
}

export function IngredientesReceitaDialog({
  open,
  onOpenChange,
  receita,
  insumosSimples,
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

  // Insumos disponíveis para adicionar à receita
  const insumosDisponiveisReceita = (insumosSimples || []).filter(i => 
    i.id !== receita?.id && 
    !ingredientesReceita?.some(r => r.insumo_ingrediente_id === i.id)
  );

  const insumoSelecionadoReceitaInfo = insumosSimples?.find(i => i.id === novoIngrediente.insumo_id);

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-primary" />
            Ingredientes: {receita?.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Unidade: <strong>{receita?.unidade_medida}</strong></span>
              <span>Rendimento: <strong>{receita?.rendimento_receita || 1} {receita?.unidade_medida}</strong></span>
              <span>Custo atual: <strong>{formatCurrency(receita?.custo_unitario || 0)}/{receita?.unidade_medida}</strong></span>
            </div>
          </div>

          {ingredientesReceita && ingredientesReceita.length > 0 ? (
            <div className="space-y-2">
              {ingredientesReceita.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.insumo_ingrediente?.nome}</span>
                    <Badge variant="outline">{item.quantidade} {item.insumo_ingrediente?.unidade_medida}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(item.quantidade * (item.insumo_ingrediente?.custo_unitario || 0))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeIngredienteMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              <div className="flex justify-between pt-2 border-t font-medium">
                <span>Custo total da receita:</span>
                <span>
                  {formatCurrency(
                    ingredientesReceita.reduce((sum, item) => 
                      sum + (item.quantidade * (item.insumo_ingrediente?.custo_unitario || 0)), 0
                    )
                  )}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Nenhum ingrediente cadastrado ainda.
            </p>
          )}

          {insumosDisponiveisReceita.length > 0 && (
            <div className="flex gap-2 pt-2 border-t">
              <SearchableSelect
                options={insumosDisponiveisReceita.map((insumo) => ({
                  value: insumo.id,
                  label: `${insumo.nome} (${insumo.unidade_medida})`,
                  searchTerms: insumo.nome,
                }))}
                value={novoIngrediente.insumo_id}
                onValueChange={(value) => setNovoIngrediente({ ...novoIngrediente, insumo_id: value })}
                placeholder="Buscar ingrediente..."
                searchPlaceholder="Digite para buscar..."
                emptyMessage="Nenhum ingrediente encontrado."
                className="flex-1"
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder={insumoSelecionadoReceitaInfo ? `Qtd (${insumoSelecionadoReceitaInfo.unidade_medida})` : "Qtd"}
                value={novoIngrediente.quantidade}
                onChange={(e) => setNovoIngrediente({ ...novoIngrediente, quantidade: e.target.value })}
                className="w-28"
              />
              <Button
                onClick={() => addIngredienteMutation.mutate()}
                disabled={!novoIngrediente.insumo_id || !novoIngrediente.quantidade || addIngredienteMutation.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
