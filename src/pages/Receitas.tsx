import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileDataView, Column } from "@/components/ui/mobile-data-view";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import {
  Plus,
  Trash2,
  Calculator,
  Package,
  ChefHat,
  ArrowRight,
  FlaskConical,
  Save,
  AlertCircle,
  Divide,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

// ==================== TYPES ====================

interface Receita {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  estoque_atual: number;
  estoque_minimo: number;
  is_intermediario: boolean;
  rendimento_receita: number | null;
}

interface ReceitaIngrediente {
  id: string;
  insumo_id: string;
  insumo_ingrediente_id: string;
  quantidade: number;
  insumo_ingrediente?: {
    id: string;
    nome: string;
    unidade_medida: string;
    custo_unitario: number;
  };
}

interface IngredienteTemp {
  id: string;
  insumoId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  custoUnitario: number;
}

interface IngredienteLote {
  id: string;
  insumoId: string;
  nome: string;
  quantidadeLote: number;
  unidade: string;
  custoUnitarioInsumo: number;
  custoTotal: number;
}

interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  is_intermediario: boolean;
}

const unidadesMedida = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'pct', label: 'Pacote (pct)' },
  { value: 'dz', label: 'Dúzia (dz)' },
];

export default function Receitas() {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("receitas");

  // ==================== RECEITAS TAB STATE ====================
  const [receitaDialogOpen, setReceitaDialogOpen] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);
  const [selectedReceita, setSelectedReceita] = useState<Receita | null>(null);
  const [ingredientesReceitaDialogOpen, setIngredientesReceitaDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  const [receitaFormData, setReceitaFormData] = useState({
    nome: '',
    unidade_medida: 'kg',
    rendimento_receita: '',
  });
  const [ingredientesTemp, setIngredientesTemp] = useState<IngredienteTemp[]>([]);
  const [novoIngredienteForm, setNovoIngredienteForm] = useState({ insumo_id: '', quantidade: '' });
  const [novoIngrediente, setNovoIngrediente] = useState({ insumo_id: '', quantidade: '' });

  // ==================== CALCULADOR TAB STATE ====================
  const [calculadorDialogOpen, setCalculadorDialogOpen] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [rendimento, setRendimento] = useState("");
  const [ingredientes, setIngredientes] = useState<IngredienteLote[]>([]);
  const [insumoSelecionado, setInsumoSelecionado] = useState("");
  const [quantidadeInsumo, setQuantidadeInsumo] = useState("");

  // ==================== QUERIES ====================

  // Fetch receitas (insumos intermediários)
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

  // Fetch insumos simples (para usar nas receitas)
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

  // Fetch todos os insumos (para calculador)
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

  // Fetch ingredientes da receita selecionada
  const { data: ingredientesReceita } = useQuery({
    queryKey: ["ingredientes-receita", selectedReceita?.id],
    queryFn: async () => {
      if (!selectedReceita) return [];
      
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
        .eq("insumo_id", selectedReceita.id);

      if (error) throw error;
      return data as ReceitaIngrediente[];
    },
    enabled: !!selectedReceita?.id,
  });

  // Fetch produtos (para calculador)
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
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // ==================== UTILS ====================

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // ==================== RECEITAS MUTATIONS ====================

  const custoTotalTemp = useMemo(() => 
    ingredientesTemp.reduce((sum, ing) => sum + (ing.quantidade * ing.custoUnitario), 0),
    [ingredientesTemp]
  );

  const custoUnitarioTemp = useMemo(() => {
    const rendimento = parseFloat(receitaFormData.rendimento_receita) || 1;
    return rendimento > 0 ? custoTotalTemp / rendimento : 0;
  }, [custoTotalTemp, receitaFormData.rendimento_receita]);

  const insumosDisponiveisForm = useMemo(() => 
    (insumosSimples || []).filter(i => !ingredientesTemp.some(ing => ing.insumoId === i.id)),
    [insumosSimples, ingredientesTemp]
  );

  const insumoFormSelecionadoInfo = insumosSimples?.find(i => i.id === novoIngredienteForm.insumo_id);

  const handleAddIngredienteTemp = () => {
    if (!novoIngredienteForm.insumo_id || !novoIngredienteForm.quantidade) {
      toast.error("Selecione um insumo e informe a quantidade");
      return;
    }

    const insumo = insumosSimples?.find(i => i.id === novoIngredienteForm.insumo_id);
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
    mutationFn: async (data: typeof receitaFormData) => {
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
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
      queryClient.invalidateQueries({ queryKey: ["insumos"] });
      queryClient.invalidateQueries({ queryKey: ["todos-insumos"] });
      toast.success("Receita criada com sucesso!");
      resetReceitaForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateReceitaMutation = useMutation({
    mutationFn: async (data: typeof receitaFormData & { id: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
      queryClient.invalidateQueries({ queryKey: ["insumos"] });
      toast.success("Receita atualizada!");
      resetReceitaForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteReceitaMutation = useMutation({
    mutationFn: async (id: string) => {
      // Primeiro deletar ingredientes
      await supabase.from("receitas_intermediarias").delete().eq("insumo_id", id);
      // Depois deletar a receita
      const { error } = await supabase.from("insumos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
      queryClient.invalidateQueries({ queryKey: ["insumos"] });
      toast.success("Receita excluída!");
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Mutations para ingredientes da receita
  const addIngredienteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReceita) throw new Error("Nenhuma receita selecionada");
      
      const { error } = await supabase.from("receitas_intermediarias").insert({
        insumo_id: selectedReceita.id,
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

  const recalcularCustoReceita = async () => {
    if (!selectedReceita || !ingredientesReceita) return;

    const custoTotal = ingredientesReceita.reduce((sum, item) => {
      const custoIngrediente = item.insumo_ingrediente?.custo_unitario || 0;
      return sum + (item.quantidade * custoIngrediente);
    }, 0);

    const rendimentoVal = selectedReceita.rendimento_receita || 1;
    const custoUnitario = custoTotal / rendimentoVal;

    await supabase
      .from("insumos")
      .update({ custo_unitario: custoUnitario })
      .eq("id", selectedReceita.id);

    queryClient.invalidateQueries({ queryKey: ["receitas"] });
  };

  const resetReceitaForm = () => {
    setReceitaFormData({
      nome: '',
      unidade_medida: 'kg',
      rendimento_receita: '',
    });
    setIngredientesTemp([]);
    setNovoIngredienteForm({ insumo_id: '', quantidade: '' });
    setEditingReceita(null);
    setReceitaDialogOpen(false);
  };

  const handleEditReceita = (receita: Receita) => {
    setEditingReceita(receita);
    setReceitaFormData({
      nome: receita.nome,
      unidade_medida: receita.unidade_medida,
      rendimento_receita: receita.rendimento_receita?.toString() || '',
    });
    setReceitaDialogOpen(true);
  };

  const handleSubmitReceita = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingReceita) {
      updateReceitaMutation.mutate({ ...receitaFormData, id: editingReceita.id });
    } else {
      createReceitaMutation.mutate(receitaFormData);
    }
  };

  const openIngredientesDialog = (receita: Receita) => {
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

  // Insumos disponíveis para adicionar à receita (excluindo a própria receita e os já adicionados)
  const insumosDisponiveisReceita = (insumosSimples || []).filter(i => 
    i.id !== selectedReceita?.id && 
    !ingredientesReceita?.some(r => r.insumo_ingrediente_id === i.id)
  );

  const insumoSelecionadoReceitaInfo = insumosSimples?.find(i => i.id === novoIngrediente.insumo_id);

  // ==================== CALCULADOR ====================

  const custoTotalLote = useMemo(() => 
    ingredientes.reduce((acc, ing) => acc + ing.custoTotal, 0), 
    [ingredientes]
  );
  
  const custoUnitarioCalc = useMemo(() => 
    rendimento && parseFloat(rendimento) > 0 ? custoTotalLote / parseFloat(rendimento) : 0,
    [custoTotalLote, rendimento]
  );

  const produtoInfo = useMemo(() => 
    produtos?.find((p) => p.id === produtoSelecionado),
    [produtos, produtoSelecionado]
  );

  const margemLucro = useMemo(() => 
    produtoInfo && custoUnitarioCalc > 0
      ? ((produtoInfo.preco_venda - custoUnitarioCalc) / produtoInfo.preco_venda) * 100
      : 0,
    [produtoInfo, custoUnitarioCalc]
  );

  const insumoInfoCalc = useMemo(() => 
    todosInsumos?.find((i) => i.id === insumoSelecionado),
    [todosInsumos, insumoSelecionado]
  );

  const handleAddInsumoCalc = () => {
    if (!insumoSelecionado || !quantidadeInsumo) {
      toast.error("Selecione um insumo e informe a quantidade");
      return;
    }

    const insumo = todosInsumos?.find((i) => i.id === insumoSelecionado);
    if (!insumo) return;

    const quantidade = parseFloat(quantidadeInsumo);
    const custoCalculado = quantidade * insumo.custo_unitario;

    const novoIngrediente: IngredienteLote = {
      id: crypto.randomUUID(),
      insumoId: insumo.id,
      nome: insumo.nome,
      quantidadeLote: quantidade,
      unidade: insumo.unidade_medida,
      custoUnitarioInsumo: insumo.custo_unitario,
      custoTotal: custoCalculado,
    };

    setIngredientes([...ingredientes, novoIngrediente]);
    setInsumoSelecionado("");
    setQuantidadeInsumo("");
  };

  const handleRemoveIngredienteCalc = (id: string) => {
    setIngredientes(ingredientes.filter((ing) => ing.id !== id));
  };

  const saveFichaTecnicaMutation = useMutation({
    mutationFn: async () => {
      if (!produtoSelecionado || !rendimento || ingredientes.length === 0) {
        throw new Error("Preencha todos os campos");
      }

      const rendimentoNum = parseFloat(rendimento);
      if (rendimentoNum <= 0) {
        throw new Error("Rendimento deve ser maior que zero");
      }

      const { error: produtoError } = await supabase
        .from("produtos")
        .update({ rendimento_padrao: rendimentoNum })
        .eq("id", produtoSelecionado);

      if (produtoError) throw produtoError;

      const { error: deleteError } = await supabase
        .from("fichas_tecnicas")
        .delete()
        .eq("produto_id", produtoSelecionado);

      if (deleteError) throw deleteError;

      const fichasTecnicas = ingredientes.map((ing) => ({
        produto_id: produtoSelecionado,
        insumo_id: ing.insumoId,
        quantidade: ing.quantidadeLote / rendimentoNum,
      }));

      const { error: insertError } = await supabase
        .from("fichas_tecnicas")
        .insert(fichasTecnicas);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos-receitas"] });
      toast.success(`Ficha técnica de ${produtoInfo?.nome} salva com sucesso!`);
      setCalculadorDialogOpen(false);
      resetCalculadorForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetCalculadorForm = () => {
    setProdutoSelecionado("");
    setRendimento("");
    setIngredientes([]);
    setInsumoSelecionado("");
    setQuantidadeInsumo("");
  };

  const handleLoadExistingRecipe = (produtoId: string) => {
    const produto = produtos?.find((p) => p.id === produtoId);
    if (!produto) return;

    setProdutoSelecionado(produtoId);
    
    if (produto.rendimento_padrao) {
      setRendimento(produto.rendimento_padrao.toString());
    }

    if (produto.fichas_tecnicas && produto.fichas_tecnicas.length > 0) {
      const rendimentoExistente = produto.rendimento_padrao || 1;
      const ingredientesCarregados: IngredienteLote[] = produto.fichas_tecnicas.map((ft) => ({
        id: ft.id,
        insumoId: ft.insumos.id,
        nome: ft.insumos.nome,
        quantidadeLote: ft.quantidade * rendimentoExistente,
        unidade: ft.insumos.unidade_medida,
        custoUnitarioInsumo: ft.insumos.custo_unitario,
        custoTotal: ft.quantidade * rendimentoExistente * ft.insumos.custo_unitario,
      }));
      setIngredientes(ingredientesCarregados);
    } else {
      setIngredientes([]);
    }
  };

  const calcularCustoProduto = (produto: typeof produtos extends (infer T)[] | undefined ? T : never) => {
    if (!produto?.fichas_tecnicas) return 0;
    return produto.fichas_tecnicas.reduce((sum, ft) => {
      return sum + (ft.quantidade * (ft.insumos?.custo_unitario || 0));
    }, 0);
  };

  // ==================== RECEITAS TABLE ====================

  const receitaColumns: Column<Receita>[] = useMemo(() => [
    {
      key: 'nome',
      header: 'Nome',
      mobilePriority: 1,
      render: (receita) => (
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden max-w-full">
          <span className="shrink-0">
            <ChefHat className="h-4 w-4 text-primary" />
          </span>
          <span className="font-medium truncate flex-1 min-w-0">{receita.nome}</span>
        </div>
      ),
    },
    {
      key: 'unidade',
      header: 'Und. Rend.',
      align: 'center',
      mobilePriority: 3,
      render: (receita) => receita.unidade_medida,
    },
    {
      key: 'rendimento',
      header: 'Quanto Rende',
      align: 'center',
      mobilePriority: 4,
      render: (receita) => receita.rendimento_receita ? `${receita.rendimento_receita} ${receita.unidade_medida}` : '-',
    },
    {
      key: 'custo',
      header: 'Custo Unit.',
      align: 'right',
      mobilePriority: 2,
      render: (receita) => formatCurrency(Number(receita.custo_unitario)),
    },
  ], []);

  const renderReceitaActions = (receita: Receita) => (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-primary hover:text-primary/80"
        onClick={() => openIngredientesDialog(receita)}
        title="Ver/Editar ingredientes"
      >
        <FlaskConical className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => handleEditReceita(receita)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive"
        onClick={() => handleDeleteClick(receita.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );

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

        {/* ==================== RECEITAS TAB ==================== */}
        <TabsContent value="receitas" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={receitaDialogOpen} onOpenChange={(open) => {
              setReceitaDialogOpen(open);
              if (!open) resetReceitaForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Receita
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-primary" />
                    {editingReceita ? 'Editar Receita' : 'Nova Receita'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmitReceita} className="space-y-4">
                  <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                    <strong>💡 Receitas</strong> são preparações base que podem ser usadas como ingrediente em produtos finais (ex: ganache, recheio, calda).
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome da Receita</Label>
                    <Input
                      id="nome"
                      value={receitaFormData.nome}
                      onChange={(e) => setReceitaFormData({ ...receitaFormData, nome: e.target.value })}
                      placeholder="Ex: Ganache de Chocolate"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="unidade_medida">Unidade do rendimento</Label>
                      <Select
                        value={receitaFormData.unidade_medida}
                        onValueChange={(value) => setReceitaFormData({ ...receitaFormData, unidade_medida: value })}
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
                        value={receitaFormData.rendimento_receita}
                        onChange={(e) => setReceitaFormData({ ...receitaFormData, rendimento_receita: e.target.value })}
                        placeholder={`Ex: 0.5 ${receitaFormData.unidade_medida}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Quantidade que essa receita produz
                      </p>
                    </div>
                  </div>

                  {/* Seção de ingredientes - apenas para criação */}
                  {!editingReceita && (
                    <Card className="border-primary/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-primary" />
                          Ingredientes da Receita
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {ingredientesTemp.length > 0 && (
                          <div className="space-y-2">
                            {ingredientesTemp.map((ing) => (
                              <div key={ing.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                                <span className="font-medium">{ing.nome}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{ing.quantidade} {ing.unidade}</Badge>
                                  <span className="text-muted-foreground">
                                    {formatCurrency(ing.quantidade * ing.custoUnitario)}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive"
                                    onClick={() => handleRemoveIngredienteTemp(ing.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            
                            <div className="pt-2 border-t space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span>Custo total da receita:</span>
                                <span className="font-medium">{formatCurrency(custoTotalTemp)}</span>
                              </div>
                              {receitaFormData.rendimento_receita && parseFloat(receitaFormData.rendimento_receita) > 0 && (
                                <div className="flex justify-between text-primary font-medium">
                                  <span>Custo por {receitaFormData.unidade_medida}:</span>
                                  <span>{formatCurrency(custoUnitarioTemp)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {insumosDisponiveisForm.length > 0 ? (
                          <div className="flex gap-2">
                            <SearchableSelect
                              options={insumosDisponiveisForm.map((insumo) => ({
                                value: insumo.id,
                                label: `${insumo.nome} (${insumo.unidade_medida}) - ${formatCurrency(insumo.custo_unitario)}`,
                                searchTerms: insumo.nome,
                              }))}
                              value={novoIngredienteForm.insumo_id}
                              onValueChange={(value) => setNovoIngredienteForm({ ...novoIngredienteForm, insumo_id: value })}
                              placeholder="Buscar insumo..."
                              searchPlaceholder="Digite para buscar..."
                              emptyMessage="Nenhum insumo encontrado."
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              placeholder={insumoFormSelecionadoInfo ? `Qtd (${insumoFormSelecionadoInfo.unidade_medida})` : "Qtd"}
                              value={novoIngredienteForm.quantidade}
                              onChange={(e) => setNovoIngredienteForm({ ...novoIngredienteForm, quantidade: e.target.value })}
                              className="w-24"
                            />
                            <Button
                              type="button"
                              size="icon"
                              onClick={handleAddIngredienteTemp}
                              disabled={!novoIngredienteForm.insumo_id || !novoIngredienteForm.quantidade}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
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
                    <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                      Para editar os ingredientes, clique no ícone de frasco na tabela.
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={resetReceitaForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createReceitaMutation.isPending || updateReceitaMutation.isPending}>
                      {editingReceita ? 'Salvar' : 'Criar'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tabela de Receitas */}
          {isLoading ? (
            <Skeleton className="h-96" />
          ) : receitas && receitas.length > 0 ? (
            <MobileDataView
              data={receitas}
              columns={receitaColumns}
              keyExtractor={(receita) => receita.id}
              renderActions={renderReceitaActions}
              renderMobileHeader={(receita) => (
                <div className="flex items-start gap-2 min-w-0">
                  <span className="shrink-0 mt-0.5">
                    <ChefHat className="h-4 w-4 text-primary" />
                  </span>
                  <span className="min-w-0 whitespace-normal break-words leading-snug">
                    {receita.nome}
                  </span>
                </div>
              )}
              renderMobileSubtitle={(receita) => (
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{receita.unidade_medida}</span>
                  {receita.rendimento_receita && (
                    <Badge variant="outline" className="text-xs">
                      Rende: {receita.rendimento_receita} {receita.unidade_medida}
                    </Badge>
                  )}
                </div>
              )}
              renderMobileHighlight={(receita) => (
                <div className="text-right">
                  <p className="font-bold text-foreground">{formatCurrency(Number(receita.custo_unitario))}</p>
                  <p className="text-xs text-muted-foreground">por {receita.unidade_medida}</p>
                </div>
              )}
              emptyMessage="Nenhuma receita cadastrada"
              emptyAction={
                <Button onClick={() => setReceitaDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Receita
                </Button>
              }
            />
          ) : (
            <Card className="p-12 text-center">
              <ChefHat className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma receita cadastrada</h3>
              <p className="text-muted-foreground mb-4">
                Receitas são preparações base (ex: ganache, recheio) que podem ser usadas como ingrediente em produtos.
              </p>
              <Button onClick={() => setReceitaDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Receita
              </Button>
            </Card>
          )}

          {/* Dialog para editar ingredientes da receita */}
          <Dialog open={ingredientesReceitaDialogOpen} onOpenChange={(open) => {
            setIngredientesReceitaDialogOpen(open);
            if (!open) {
              setSelectedReceita(null);
              setNovoIngrediente({ insumo_id: '', quantidade: '' });
            }
          }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ChefHat className="h-5 w-5 text-primary" />
                  Ingredientes: {selectedReceita?.nome}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Unidade: <strong>{selectedReceita?.unidade_medida}</strong></span>
                    <span>Rendimento: <strong>{selectedReceita?.rendimento_receita || 1} {selectedReceita?.unidade_medida}</strong></span>
                    <span>Custo atual: <strong>{formatCurrency(selectedReceita?.custo_unitario || 0)}/{selectedReceita?.unidade_medida}</strong></span>
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
                  <Button onClick={() => setIngredientesReceitaDialogOpen(false)}>Fechar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <DeleteConfirmationDialog
            open={deleteConfirmOpen}
            onOpenChange={setDeleteConfirmOpen}
            onConfirm={confirmDelete}
            title="Excluir receita"
            description="Tem certeza que deseja excluir esta receita? Esta ação não pode ser desfeita."
          />
        </TabsContent>

        {/* ==================== CALCULADOR TAB ==================== */}
        <TabsContent value="calculador" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={calculadorDialogOpen} onOpenChange={(open) => {
              setCalculadorDialogOpen(open);
              if (!open) resetCalculadorForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Calculator className="h-4 w-4" />
                  Calcular Ficha Técnica
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5" />
                    Calculador de Ficha Técnica
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Passo 1: Selecionar Produto */}
                  <Card className="border-primary/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                          1
                        </div>
                        Selecione o Produto
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Select
                        value={produtoSelecionado}
                        onValueChange={handleLoadExistingRecipe}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Para qual produto é essa ficha?" />
                        </SelectTrigger>
                        <SelectContent>
                          {produtos?.map((produto) => (
                            <SelectItem key={produto.id} value={produto.id}>
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                <span>{produto.nome}</span>
                                <Badge variant="outline" className="ml-2">
                                  {formatCurrency(produto.preco_venda)}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {produtoSelecionado && produtoInfo && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                          <p className="text-sm">
                            <strong>{produtoInfo.nome}</strong> - Preço de venda:{" "}
                            {formatCurrency(produtoInfo.preco_venda)}
                            {produtoInfo.rendimento_padrao && (
                              <span className="ml-2 text-muted-foreground">
                                (Rendimento atual: {produtoInfo.rendimento_padrao} un)
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Passo 2: Montar Receita do Lote */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                          2
                        </div>
                        Monte a Receita do Lote
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                        <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <span>
                          Adicione os insumos da{" "}
                          <strong>panela/lote inteiro</strong>, não da unidade. Ex:
                          Para fazer brigadeiros, adicione 1 lata de leite
                          condensado, 0.02kg de cacau, etc.
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-[1fr,120px,auto]">
                        <SearchableSelect
                          options={(todosInsumos || []).map((insumo) => ({
                            value: insumo.id,
                            label: `${insumo.nome} (${insumo.unidade_medida}) - ${formatCurrency(insumo.custo_unitario)}`,
                            searchTerms: insumo.nome,
                            icon: insumo.is_intermediario ? (
                              <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/10">
                                <ChefHat className="h-3 w-3 text-primary" />
                              </span>
                            ) : undefined,
                          }))}
                          value={insumoSelecionado}
                          onValueChange={setInsumoSelecionado}
                          placeholder="Buscar insumo ou receita..."
                          searchPlaceholder="Digite para buscar..."
                          emptyMessage="Nenhum insumo encontrado."
                        />
                        <Input
                          type="number"
                          step="0.001"
                          placeholder={
                            insumoInfoCalc
                              ? `Qtd (${insumoInfoCalc.unidade_medida})`
                              : "Qtd"
                          }
                          value={quantidadeInsumo}
                          onChange={(e) => setQuantidadeInsumo(e.target.value)}
                        />
                        <Button onClick={handleAddInsumoCalc} className="gap-2">
                          <Plus className="h-4 w-4" />
                          Adicionar
                        </Button>
                      </div>

                      {ingredientes.length > 0 && (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Insumo</TableHead>
                                <TableHead className="text-right">
                                  Quantidade
                                </TableHead>
                                <TableHead className="text-right">Custo</TableHead>
                                <TableHead className="w-12"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <AnimatePresence>
                                {ingredientes.map((ing) => (
                                  <motion.tr
                                    key={ing.id}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="border-b"
                                  >
                                    <TableCell className="font-medium">
                                      {ing.nome}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {ing.quantidadeLote} {ing.unidade}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-primary">
                                      {formatCurrency(ing.custoTotal)}
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => handleRemoveIngredienteCalc(ing.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </motion.tr>
                                ))}
                              </AnimatePresence>
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {ingredientes.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <ChefHat className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Adicione os insumos da receita</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Passo 3: Rendimento */}
                  <Card className="border-dashed">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                          3
                        </div>
                        Informe o Rendimento
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <Label htmlFor="rendimento">
                            Quantas unidades essa receita rende?
                          </Label>
                          <Input
                            id="rendimento"
                            type="number"
                            placeholder="Ex: 30 brigadeiros"
                            value={rendimento}
                            onChange={(e) => setRendimento(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div className="text-center pt-6">
                          <p className="text-sm text-muted-foreground">unidades</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Resultado: Cálculo Automático */}
                  {ingredientes.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <Card className="bg-gradient-to-r from-primary/10 to-emerald-500/10 border-primary/30">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Calculator className="h-5 w-5 text-primary" />
                            Resultado do Cálculo
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid gap-4 md:grid-cols-4 items-center">
                            <div className="text-center p-4 bg-background rounded-lg">
                              <p className="text-sm text-muted-foreground mb-1">
                                Custo do Lote
                              </p>
                              <p className="text-2xl font-bold">
                                {formatCurrency(custoTotalLote)}
                              </p>
                            </div>

                            <div className="flex items-center justify-center">
                              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                <Divide className="h-5 w-5 text-muted-foreground" />
                              </div>
                            </div>

                            <div className="text-center p-4 bg-background rounded-lg">
                              <p className="text-sm text-muted-foreground mb-1">
                                Rendimento
                              </p>
                              <p className="text-2xl font-bold">
                                {rendimento || "0"} un
                              </p>
                            </div>

                            <div className="hidden md:flex items-center justify-center">
                              <ArrowRight className="h-6 w-6 text-primary" />
                            </div>
                          </div>

                          <div className="mt-4 p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                            <p className="text-sm text-muted-foreground mb-2">
                              Custo por Unidade (CMV)
                            </p>
                            <p className="text-4xl font-bold text-emerald-600">
                              {formatCurrency(custoUnitarioCalc)}
                            </p>
                            {produtoInfo && custoUnitarioCalc > 0 && (
                              <div className="mt-3 flex items-center justify-center gap-4 text-sm">
                                <span>
                                  Preço de venda:{" "}
                                  {formatCurrency(produtoInfo.preco_venda)}
                                </span>
                                <Badge
                                  variant={
                                    margemLucro >= 50
                                      ? "default"
                                      : margemLucro >= 30
                                      ? "secondary"
                                      : "destructive"
                                  }
                                >
                                  Margem: {margemLucro.toFixed(1)}%
                                </Badge>
                              </div>
                            )}
                          </div>

                          {rendimento && parseFloat(rendimento) > 0 && (
                            <div className="mt-4">
                              <p className="text-sm font-medium mb-2">
                                Ficha Técnica por Unidade:
                              </p>
                              <div className="grid gap-1 text-sm">
                                {ingredientes.map((ing) => {
                                  const qtdUnitaria =
                                    ing.quantidadeLote / parseFloat(rendimento);
                                  return (
                                    <div
                                      key={ing.id}
                                      className="flex justify-between p-2 bg-background rounded"
                                    >
                                      <span>{ing.nome}</span>
                                      <span className="text-muted-foreground">
                                        {qtdUnitaria.toFixed(4)} {ing.unidade} ={" "}
                                        {formatCurrency(
                                          qtdUnitaria * ing.custoUnitarioInsumo
                                        )}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={() => setCalculadorDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => saveFichaTecnicaMutation.mutate()}
                      disabled={
                        !produtoSelecionado ||
                        !rendimento ||
                        ingredientes.length === 0 ||
                        saveFichaTecnicaMutation.isPending
                      }
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {saveFichaTecnicaMutation.isPending ? "Salvando..." : "Salvar Ficha Técnica"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Lista de Produtos com Fichas Técnicas */}
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : produtos && produtos.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {produtos.map((produto) => {
                const custo = calcularCustoProduto(produto);
                const margem =
                  produto.preco_venda > 0
                    ? ((produto.preco_venda - custo) / produto.preco_venda) * 100
                    : 0;
                const temFicha =
                  produto.fichas_tecnicas && produto.fichas_tecnicas.length > 0;

                return (
                  <Card
                    key={produto.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => {
                      handleLoadExistingRecipe(produto.id);
                      setCalculadorDialogOpen(true);
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-primary" />
                          <CardTitle className="text-lg">{produto.nome}</CardTitle>
                        </div>
                        <Badge variant={temFicha ? "default" : "secondary"}>
                          {temFicha
                            ? `${produto.fichas_tecnicas?.length} insumos`
                            : "Sem ficha"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Preço Venda</p>
                          <p className="font-bold text-lg">
                            {formatCurrency(produto.preco_venda)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Custo Unitário</p>
                          <p className="font-medium">
                            {temFicha ? formatCurrency(custo) : "-"}
                          </p>
                        </div>
                      </div>

                      {temFicha && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1">
                              <span>Margem: {margem.toFixed(1)}%</span>
                              {produto.rendimento_padrao && (
                                <span className="text-muted-foreground">
                                  Rende: {produto.rendimento_padrao} un
                                </span>
                              )}
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  margem >= 50
                                    ? "bg-emerald-500"
                                    : margem >= 30
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                                }`}
                                style={{ width: `${Math.min(margem, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <Button variant="ghost" className="w-full justify-center gap-2">
                        <Calculator className="h-4 w-4" />
                        {temFicha ? "Editar Ficha" : "Criar Ficha"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum produto cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Cadastre produtos primeiro para criar as fichas técnicas.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
