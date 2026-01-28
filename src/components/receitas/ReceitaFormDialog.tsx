import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { invalidateEmpresaCachesAndRefetch } from "@/lib/queryConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Trash2, ChefHat, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Receita, Insumo, IngredienteTemp, unidadesMedida, formatCurrency, formatCurrencySmart } from "./types";

interface ReceitaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingReceita: Receita | null;
  insumosSimples: Insumo[] | undefined;
  receitas?: Receita[] | undefined;
}

export function ReceitaFormDialog({
  open,
  onOpenChange,
  editingReceita,
  insumosSimples,
  receitas,
}: ReceitaFormDialogProps) {
  const { usuario } = useAuth();

  const [formData, setFormData] = useState({
    nome: editingReceita?.nome || '',
    unidade_medida: editingReceita?.unidade_medida || 'kg',
    rendimento_receita: editingReceita?.rendimento_receita?.toString() || '',
  });
  const [ingredientesTemp, setIngredientesTemp] = useState<IngredienteTemp[]>([]);
  const [novoIngredienteForm, setNovoIngredienteForm] = useState({ insumo_id: '', quantidade: '' });

  // Reset form when dialog opens/closes
  const resetForm = () => {
    setFormData({
      nome: '',
      unidade_medida: 'kg',
      rendimento_receita: '',
    });
    setIngredientesTemp([]);
    setNovoIngredienteForm({ insumo_id: '', quantidade: '' });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    } else if (editingReceita) {
      setFormData({
        nome: editingReceita.nome,
        unidade_medida: editingReceita.unidade_medida,
        rendimento_receita: editingReceita.rendimento_receita?.toString() || '',
      });
    }
    onOpenChange(isOpen);
  };

  const custoTotalTemp = useMemo(() => 
    ingredientesTemp.reduce((sum, ing) => sum + (ing.quantidade * ing.custoUnitario), 0),
    [ingredientesTemp]
  );

  const custoUnitarioTemp = useMemo(() => {
    const rendimento = parseFloat(formData.rendimento_receita) || 1;
    return rendimento > 0 ? custoTotalTemp / rendimento : 0;
  }, [custoTotalTemp, formData.rendimento_receita]);

  // Combina insumos simples + outras receitas (exceto a que está sendo editada)
  const todosInsumosDisponiveis = useMemo(() => {
    const simples = (insumosSimples || []).map(i => ({ ...i, isReceita: false }));
    const receitasDisponiveis = (receitas || [])
      .filter(r => r.id !== editingReceita?.id) // Exclui a própria receita sendo editada
      .map(r => ({
        id: r.id,
        nome: r.nome,
        unidade_medida: r.unidade_medida,
        custo_unitario: r.custo_unitario,
        isReceita: true,
      }));
    return [...simples, ...receitasDisponiveis];
  }, [insumosSimples, receitas, editingReceita?.id]);

  const insumosDisponiveisForm = useMemo(() => 
    todosInsumosDisponiveis.filter(i => !ingredientesTemp.some(ing => ing.insumoId === i.id)),
    [todosInsumosDisponiveis, ingredientesTemp]
  );

  const insumoFormSelecionadoInfo = todosInsumosDisponiveis.find(i => i.id === novoIngredienteForm.insumo_id);

  const handleAddIngredienteTemp = () => {
    if (!novoIngredienteForm.insumo_id || !novoIngredienteForm.quantidade) {
      toast.error("Selecione um insumo e informe a quantidade");
      return;
    }

    const insumo = todosInsumosDisponiveis.find(i => i.id === novoIngredienteForm.insumo_id);
    if (!insumo) return;

    const novoIng: IngredienteTemp = {
      id: crypto.randomUUID(),
      insumoId: insumo.id,
      nome: insumo.nome,
      quantidade: parseFloat(novoIngredienteForm.quantidade),
      unidade: insumo.unidade_medida,
      custoUnitario: insumo.custo_unitario,
    };

    setIngredientesTemp([...ingredientesTemp, novoIng]);
    setNovoIngredienteForm({ insumo_id: '', quantidade: '' });
  };

  const handleRemoveIngredienteTemp = (id: string) => {
    setIngredientesTemp(ingredientesTemp.filter(ing => ing.id !== id));
  };

  const createReceitaMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const custoCalculado = custoUnitarioTemp;

      const { data: novaReceita, error } = await supabase.from("insumos").insert({
        empresa_id: usuario!.empresa_id,
        nome: data.nome,
        unidade_medida: data.unidade_medida,
        custo_unitario: custoCalculado,
        estoque_atual: 0,
        estoque_minimo: 0,
        is_intermediario: true,
        rendimento_receita: data.rendimento_receita ? parseFloat(data.rendimento_receita) : null,
      }).select("id").single();
      
      if (error) throw error;

      if (ingredientesTemp.length > 0 && novaReceita) {
        const receitaData = ingredientesTemp.map(ing => ({
          insumo_id: novaReceita.id,
          insumo_ingrediente_id: ing.insumoId,
          quantidade: ing.quantidade,
        }));

        const { error: receitaError } = await supabase
          .from("receitas_intermediarias")
          .insert(receitaData);

        if (receitaError) throw receitaError;
      }
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast.success("Receita criada com sucesso!");
      handleOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateReceitaMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from("insumos")
        .update({
          nome: data.nome,
          unidade_medida: data.unidade_medida,
          rendimento_receita: data.rendimento_receita ? parseFloat(data.rendimento_receita) : null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast.success("Receita atualizada!");
      handleOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingReceita) {
      updateReceitaMutation.mutate({ ...formData, id: editingReceita.id });
    } else {
      createReceitaMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Nova Receita</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ChefHat className="h-5 w-5 text-primary shrink-0" />
            {editingReceita ? 'Editar Receita' : 'Nova Receita'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg text-xs sm:text-sm text-muted-foreground">
            <strong>💡 Receitas</strong> são preparações base que podem ser usadas como ingrediente em produtos finais.
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Receita</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Ganache de Chocolate"
              required
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unidade_medida">Unidade do rendimento</Label>
              <Select
                value={formData.unidade_medida}
                onValueChange={(value) => setFormData({ ...formData, unidade_medida: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unidadesMedida.map((un) => (
                    <SelectItem key={un.value} value={un.value}>
                      {un.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Em que unidade você mede essa receita?
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rendimento_receita">Quanto rende</Label>
              <Input
                id="rendimento_receita"
                type="number"
                step="0.01"
                min="0"
                value={formData.rendimento_receita}
                onChange={(e) => setFormData({ ...formData, rendimento_receita: e.target.value })}
                placeholder={`Ex: 0.5 ${formData.unidade_medida}`}
              />
              <p className="text-xs text-muted-foreground">
                Quantidade que essa receita produz
              </p>
            </div>
          </div>

          {/* Seção de ingredientes - apenas para criação */}
          {!editingReceita && (
            <Card className="border-primary/30">
              <CardHeader className="p-3 sm:pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-primary" />
                  Ingredientes da Receita
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-3">
                {ingredientesTemp.length > 0 && (
                  <div className="space-y-2">
                    {ingredientesTemp.map((ing) => (
                      <div key={ing.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 bg-muted/50 rounded-lg text-sm gap-2">
                        <span className="font-medium truncate">{ing.nome}</span>
                        <div className="flex items-center justify-between sm:justify-end gap-2">
                          <Badge variant="outline" className="text-xs">{ing.quantidade} {ing.unidade}</Badge>
                          <span className="text-muted-foreground text-xs">
                            {formatCurrency(ing.quantidade * ing.custoUnitario)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive shrink-0"
                            onClick={() => handleRemoveIngredienteTemp(ing.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="pt-2 border-t space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Custo total:</span>
                        <span className="font-medium">{formatCurrency(custoTotalTemp)}</span>
                      </div>
                      {formData.rendimento_receita && parseFloat(formData.rendimento_receita) > 0 && (
                        <div className="flex justify-between text-primary font-medium">
                          <span>Custo por {formData.unidade_medida}:</span>
                           <span>{formatCurrencySmart(custoUnitarioTemp)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {insumosDisponiveisForm.length > 0 ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <SearchableSelect
                      options={insumosDisponiveisForm.map((insumo) => ({
                        value: insumo.id,
                        label: `${insumo.isReceita ? '📋 ' : ''}${insumo.nome} (${insumo.unidade_medida}) - ${formatCurrencySmart(insumo.custo_unitario)}`,
                        searchTerms: insumo.nome,
                      }))}
                      value={novoIngredienteForm.insumo_id}
                      onValueChange={(value) => setNovoIngredienteForm({ ...novoIngredienteForm, insumo_id: value })}
                      placeholder="Buscar insumo..."
                      searchPlaceholder="Digite para buscar..."
                      emptyMessage="Nenhum insumo encontrado."
                      className="flex-1"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder={insumoFormSelecionadoInfo ? `Qtd (${insumoFormSelecionadoInfo.unidade_medida})` : "Quantidade"}
                        value={novoIngredienteForm.quantidade}
                        onChange={(e) => setNovoIngredienteForm({ ...novoIngredienteForm, quantidade: e.target.value })}
                        className="flex-1 sm:w-24"
                      />
                      <Button
                        type="button"
                        size="icon"
                        onClick={handleAddIngredienteTemp}
                        disabled={!novoIngredienteForm.insumo_id || !novoIngredienteForm.quantidade}
                        className="shrink-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : ingredientesTemp.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Cadastre insumos primeiro para montar a receita.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}

          {editingReceita && (
            <div className="p-3 bg-muted/50 rounded-lg text-xs sm:text-sm text-muted-foreground">
              Para editar os ingredientes, clique no ícone de frasco na tabela.
            </div>
          )}
        </form>

        {/* Footer fixo */}
        <div className="shrink-0 border-t p-4 sm:p-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createReceitaMutation.isPending || updateReceitaMutation.isPending}
            className="w-full sm:w-auto"
          >
            {editingReceita ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
