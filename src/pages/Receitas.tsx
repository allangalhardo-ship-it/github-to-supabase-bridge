import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { invalidateEmpresaCachesAndRefetch } from "@/lib/queryConfig";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChefHat, Calculator } from "lucide-react";

import {
  Receita,
  Insumo,
  Produto,
  ReceitaFormDialog,
  ReceitasList,
  IngredientesReceitaDialog,
  CalculadorFichaTecnica,
} from "@/components/receitas";
import { toast } from "sonner";

export default function Receitas() {
  const { usuario } = useAuth();
  const [activeTab, setActiveTab] = useState("receitas");

  // Receitas Tab State
  const [receitaDialogOpen, setReceitaDialogOpen] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);
  const [selectedReceita, setSelectedReceita] = useState<Receita | null>(null);
  const [ingredientesReceitaDialogOpen, setIngredientesReceitaDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Queries
  const { data: receitas, isLoading: loadingReceitas } = useQuery({
    queryKey: ["receitas", usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insumos")
        .select("*")
        .eq("is_intermediario", true)
        .order("nome");

      if (error) throw error;
      return data as Receita[];
    },
    enabled: !!usuario?.empresa_id,
  });

  const { data: insumosSimples, isLoading: loadingInsumos } = useQuery({
    queryKey: ["insumos-simples", usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insumos")
        .select("id, nome, unidade_medida, custo_unitario, is_intermediario")
        .eq("is_intermediario", false)
        .order("nome");

      if (error) throw error;
      return data as Insumo[];
    },
    enabled: !!usuario?.empresa_id,
  });

  const { data: todosInsumos } = useQuery({
    queryKey: ["todos-insumos", usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insumos")
        .select("id, nome, unidade_medida, custo_unitario, is_intermediario")
        .order("nome");

      if (error) throw error;
      return data as Insumo[];
    },
    enabled: !!usuario?.empresa_id,
  });

  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ["produtos-receitas", usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select(`
          id, 
          nome, 
          preco_venda, 
          categoria,
          rendimento_padrao,
          fichas_tecnicas (
            id,
            quantidade,
            insumos (
              id,
              nome,
              unidade_medida,
              custo_unitario
            )
          )
        `)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data as Produto[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Delete Mutation
  const deleteReceitaMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("receitas_intermediarias").delete().eq("insumo_id", id);
      const { error } = await supabase.from("insumos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast.success("Receita excluída!");
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Handlers
  const handleEditReceita = (receita: Receita) => {
    setEditingReceita(receita);
    setReceitaDialogOpen(true);
  };

  const handleOpenIngredientes = (receita: Receita) => {
    setSelectedReceita(receita);
    setIngredientesReceitaDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteReceitaMutation.mutate(itemToDelete);
    }
  };

  const isLoading = loadingReceitas || loadingInsumos || loadingProdutos;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Receitas</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Gerencie suas receitas e calcule fichas técnicas de produtos
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="receitas" className="gap-2">
            <ChefHat className="h-4 w-4" />
            Receitas
            {receitas && receitas.length > 0 && (
              <Badge variant="secondary" className="ml-1">{receitas.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="calculador" className="gap-2">
            <Calculator className="h-4 w-4" />
            Calculador de Ficha Técnica
          </TabsTrigger>
        </TabsList>

        {/* Receitas Tab */}
        <TabsContent value="receitas" className="space-y-4">
          <div className="flex justify-end">
            <ReceitaFormDialog
              open={receitaDialogOpen}
              onOpenChange={(open) => {
                setReceitaDialogOpen(open);
                if (!open) setEditingReceita(null);
              }}
              editingReceita={editingReceita}
              insumosSimples={insumosSimples}
              receitas={receitas}
            />
          </div>

          <ReceitasList
            receitas={receitas}
            isLoading={isLoading}
            onNewReceita={() => setReceitaDialogOpen(true)}
            onEditReceita={handleEditReceita}
            onOpenIngredientes={handleOpenIngredientes}
            onDeleteReceita={handleDeleteClick}
            deleteConfirmOpen={deleteConfirmOpen}
            setDeleteConfirmOpen={setDeleteConfirmOpen}
            confirmDelete={confirmDelete}
          />

          <IngredientesReceitaDialog
            open={ingredientesReceitaDialogOpen}
            onOpenChange={(open) => {
              setIngredientesReceitaDialogOpen(open);
              if (!open) setSelectedReceita(null);
            }}
            receita={selectedReceita}
            insumosSimples={insumosSimples}
            todasReceitas={receitas}
          />
        </TabsContent>

        {/* Calculador Tab */}
        <TabsContent value="calculador" className="space-y-4">
          <CalculadorFichaTecnica
            produtos={produtos}
            todosInsumos={todosInsumos}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
