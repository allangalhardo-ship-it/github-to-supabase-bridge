import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/searchable-select';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, AlertTriangle, ShoppingBasket, FlaskConical, ChefHat, Layers, ShoppingCart } from 'lucide-react';
import ListaCompras from '@/components/insumos/ListaCompras';

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

interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  estoque_atual: number;
  estoque_minimo: number;
  is_intermediario: boolean;
  rendimento_receita: number | null;
}

interface ReceitaIntermediaria {
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

// Ingrediente temporário para criação (antes de salvar no banco)
interface IngredienteTemp {
  id: string;
  insumoId: string;
  nome: string;
  quantidade: number;
  unidade: string;
  custoUnitario: number;
}

const Insumos = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receitaDialogOpen, setReceitaDialogOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [selectedIntermediario, setSelectedIntermediario] = useState<Insumo | null>(null);
  const [activeTab, setActiveTab] = useState<string>("todos");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    unidade_medida: 'kg',
    custo_unitario: '',
    estoque_atual: '',
    estoque_minimo: '',
    is_intermediario: false,
    rendimento_receita: '',
  });

  // Estado para ingredientes do formulário de criação/edição
  const [ingredientesTemp, setIngredientesTemp] = useState<IngredienteTemp[]>([]);
  const [novoIngredienteForm, setNovoIngredienteForm] = useState({ insumo_id: '', quantidade: '' });

  // Estado para receita do intermediário (dialog separado)
  const [novoIngrediente, setNovoIngrediente] = useState({ insumo_id: '', quantidade: '' });

  const { data: insumos, isLoading } = useQuery({
    queryKey: ['insumos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .order('nome');

      if (error) throw error;
      return data as Insumo[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch receita do intermediário selecionado
  const { data: receitaIntermediaria } = useQuery({
    queryKey: ['receita-intermediaria', selectedIntermediario?.id],
    queryFn: async () => {
      if (!selectedIntermediario) return [];
      
      const { data, error } = await supabase
        .from('receitas_intermediarias')
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
        .eq('insumo_id', selectedIntermediario.id);

      if (error) throw error;
      return data as ReceitaIntermediaria[];
    },
    enabled: !!selectedIntermediario?.id,
  });

  const insumosSimples = insumos?.filter(i => !i.is_intermediario) || [];
  const insumosIntermediarios = insumos?.filter(i => i.is_intermediario) || [];

  // Custo calculado dos ingredientes temporários
  const custoTotalTemp = useMemo(() => 
    ingredientesTemp.reduce((sum, ing) => sum + (ing.quantidade * ing.custoUnitario), 0),
    [ingredientesTemp]
  );

  const custoUnitarioTemp = useMemo(() => {
    const rendimento = parseFloat(formData.rendimento_receita) || 1;
    return rendimento > 0 ? custoTotalTemp / rendimento : 0;
  }, [custoTotalTemp, formData.rendimento_receita]);

  // Insumos disponíveis para adicionar no form (excluindo os já adicionados)
  const insumosDisponiveisForm = useMemo(() => 
    insumosSimples.filter(i => !ingredientesTemp.some(ing => ing.insumoId === i.id)),
    [insumosSimples, ingredientesTemp]
  );

  const insumoFormSelecionadoInfo = insumos?.find(i => i.id === novoIngredienteForm.insumo_id);

  const handleAddIngredienteTemp = () => {
    if (!novoIngredienteForm.insumo_id || !novoIngredienteForm.quantidade) {
      toast({ title: 'Selecione um insumo e informe a quantidade', variant: 'destructive' });
      return;
    }

    const insumo = insumos?.find(i => i.id === novoIngredienteForm.insumo_id);
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

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Calcular custo baseado nos ingredientes
      const custoCalculado = data.is_intermediario ? custoUnitarioTemp : (parseFloat(data.custo_unitario) || 0);

      const { data: novoInsumo, error } = await supabase.from('insumos').insert({
        empresa_id: usuario!.empresa_id,
        nome: data.nome,
        unidade_medida: data.unidade_medida,
        custo_unitario: custoCalculado,
        estoque_atual: parseFloat(data.estoque_atual) || 0,
        estoque_minimo: parseFloat(data.estoque_minimo) || 0,
        is_intermediario: data.is_intermediario,
        rendimento_receita: data.rendimento_receita ? parseFloat(data.rendimento_receita) : null,
      }).select('id').single();
      
      if (error) throw error;

      // Se for intermediário e tiver ingredientes, salvar a receita
      if (data.is_intermediario && ingredientesTemp.length > 0 && novoInsumo) {
        const receitaData = ingredientesTemp.map(ing => ({
          insumo_id: novoInsumo.id,
          insumo_ingrediente_id: ing.insumoId,
          quantidade: ing.quantidade,
        }));

        const { error: receitaError } = await supabase
          .from('receitas_intermediarias')
          .insert(receitaData);

        if (receitaError) throw receitaError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      toast({ title: 'Insumo criado com sucesso!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar insumo', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from('insumos')
        .update({
          nome: data.nome,
          unidade_medida: data.unidade_medida,
          custo_unitario: parseFloat(data.custo_unitario) || 0,
          estoque_atual: parseFloat(data.estoque_atual) || 0,
          estoque_minimo: parseFloat(data.estoque_minimo) || 0,
          is_intermediario: data.is_intermediario,
          rendimento_receita: data.rendimento_receita ? parseFloat(data.rendimento_receita) : null,
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      toast({ title: 'Insumo atualizado!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('insumos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      toast({ title: 'Insumo excluído!' });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    },
  });

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete);
    }
  };

  // Mutations para receita intermediária
  const addIngredienteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedIntermediario) throw new Error('Nenhum intermediário selecionado');
      
      const { error } = await supabase.from('receitas_intermediarias').insert({
        insumo_id: selectedIntermediario.id,
        insumo_ingrediente_id: novoIngrediente.insumo_id,
        quantidade: parseFloat(novoIngrediente.quantidade) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receita-intermediaria'] });
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      setNovoIngrediente({ insumo_id: '', quantidade: '' });
      toast({ title: 'Ingrediente adicionado!' });
      recalcularCustoIntermediario();
    },
    onError: (error) => {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
    },
  });

  const removeIngredienteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('receitas_intermediarias').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receita-intermediaria'] });
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      toast({ title: 'Ingrediente removido!' });
      recalcularCustoIntermediario();
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    },
  });

  // Recalcular custo do intermediário baseado na receita
  const recalcularCustoIntermediario = async () => {
    if (!selectedIntermediario || !receitaIntermediaria) return;

    const custoTotal = receitaIntermediaria.reduce((sum, item) => {
      const custoIngrediente = item.insumo_ingrediente?.custo_unitario || 0;
      return sum + (item.quantidade * custoIngrediente);
    }, 0);

    const rendimento = selectedIntermediario.rendimento_receita || 1;
    const custoUnitario = custoTotal / rendimento;

    const { error } = await supabase
      .from('insumos')
      .update({ custo_unitario: custoUnitario })
      .eq('id', selectedIntermediario.id);

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      unidade_medida: 'kg',
      custo_unitario: '',
      estoque_atual: '',
      estoque_minimo: '',
      is_intermediario: false,
      rendimento_receita: '',
    });
    setIngredientesTemp([]);
    setNovoIngredienteForm({ insumo_id: '', quantidade: '' });
    setEditingInsumo(null);
    setDialogOpen(false);
  };

  const handleEdit = (insumo: Insumo) => {
    setEditingInsumo(insumo);
    setFormData({
      nome: insumo.nome,
      unidade_medida: insumo.unidade_medida,
      custo_unitario: insumo.custo_unitario.toString(),
      estoque_atual: insumo.estoque_atual.toString(),
      estoque_minimo: insumo.estoque_minimo.toString(),
      is_intermediario: insumo.is_intermediario,
      rendimento_receita: insumo.rendimento_receita?.toString() || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingInsumo) {
      updateMutation.mutate({ ...formData, id: editingInsumo.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openReceitaDialog = (insumo: Insumo) => {
    setSelectedIntermediario(insumo);
    setReceitaDialogOpen(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Insumos disponíveis para adicionar à receita (excluindo o próprio intermediário e os já adicionados)
  const insumosDisponiveis = insumos?.filter(i => 
    i.id !== selectedIntermediario?.id && 
    !receitaIntermediaria?.some(r => r.insumo_ingrediente_id === i.id)
  ) || [];

  const insumoSelecionadoInfo = insumos?.find(i => i.id === novoIngrediente.insumo_id);

  const renderTable = (items: Insumo[], showIntermediarioBadge = false) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-center">Unidade</TableHead>
              <TableHead className="text-right">Custo Unit.</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="w-32"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((insumo) => {
              const estoqueBaixo = Number(insumo.estoque_atual) <= Number(insumo.estoque_minimo);
              return (
                <TableRow key={insumo.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {insumo.is_intermediario ? (
                        <FlaskConical className="h-4 w-4 text-purple-500" />
                      ) : (
                        <ShoppingBasket className="h-4 w-4 text-muted-foreground" />
                      )}
                      {insumo.nome}
                      {estoqueBaixo && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Baixo
                        </Badge>
                      )}
                      {showIntermediarioBadge && insumo.is_intermediario && (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          <Layers className="h-3 w-3 mr-1" />
                          Intermediário
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{insumo.unidade_medida}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(insumo.custo_unitario))}</TableCell>
                  <TableCell className={`text-right ${estoqueBaixo ? 'text-destructive font-medium' : ''}`}>
                    {Number(insumo.estoque_atual).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {Number(insumo.estoque_minimo).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {insumo.is_intermediario && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-purple-500 hover:text-purple-600"
                          onClick={() => openReceitaDialog(insumo)}
                          title="Editar receita"
                        >
                          <ChefHat className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(insumo)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDeleteClick(insumo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Insumos</h1>
          <p className="text-muted-foreground">Gerencie os insumos e produtos intermediários</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Insumo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Toggle Intermediário */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-purple-500" />
                  <Label htmlFor="is_intermediario" className="cursor-pointer">
                    Produto Intermediário
                  </Label>
                </div>
                <Switch
                  id="is_intermediario"
                  checked={formData.is_intermediario}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_intermediario: checked })}
                />
              </div>

              {formData.is_intermediario && (
                <p className="text-sm text-muted-foreground bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                  Produtos intermediários (ex: ganache, recheio) possuem sua própria receita e podem ser usados como ingrediente em outros produtos.
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder={formData.is_intermediario ? "Ex: Ganache de Chocolate" : "Ex: Carne moída"}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unidade_medida">Unidade</Label>
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
                </div>

                {formData.is_intermediario ? (
                  <div className="space-y-2">
                    <Label htmlFor="rendimento_receita">Rendimento da Receita</Label>
                    <Input
                      id="rendimento_receita"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.rendimento_receita}
                      onChange={(e) => setFormData({ ...formData, rendimento_receita: e.target.value })}
                      placeholder={`Ex: 0.5 ${formData.unidade_medida}`}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="custo_unitario">Custo Unitário (R$)</Label>
                    <Input
                      id="custo_unitario"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.custo_unitario}
                      onChange={(e) => setFormData({ ...formData, custo_unitario: e.target.value })}
                      placeholder="0,00"
                      required={!formData.is_intermediario}
                    />
                  </div>
                )}
              </div>

              {/* Seção de ingredientes para intermediários */}
              {formData.is_intermediario && !editingInsumo && (
                <Card className="border-purple-200 dark:border-purple-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ChefHat className="h-4 w-4 text-purple-500" />
                      Ingredientes da Receita
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Lista de ingredientes adicionados */}
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
                        
                        {/* Totais */}
                        <div className="pt-2 border-t space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Custo total da receita:</span>
                            <span className="font-medium">{formatCurrency(custoTotalTemp)}</span>
                          </div>
                          {formData.rendimento_receita && parseFloat(formData.rendimento_receita) > 0 && (
                            <div className="flex justify-between text-primary font-medium">
                              <span>Custo por {formData.unidade_medida}:</span>
                              <span>{formatCurrency(custoUnitarioTemp)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Adicionar ingrediente */}
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
                        Cadastre insumos simples primeiro para montar a receita.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              )}

              {/* Custo calculado para edição de intermediário */}
              {formData.is_intermediario && editingInsumo && (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Para editar os ingredientes, clique no ícone de chapéu de chef na tabela.
                  </p>
                  <p className="text-sm mt-1">
                    Custo atual: <strong>{formatCurrency(Number(formData.custo_unitario))}/{formData.unidade_medida}</strong>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="estoque_atual">Estoque Atual</Label>
                  <Input
                    id="estoque_atual"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.estoque_atual}
                    onChange={(e) => setFormData({ ...formData, estoque_atual: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estoque_minimo">Estoque Mínimo</Label>
                  <Input
                    id="estoque_minimo"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.estoque_minimo}
                    onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingInsumo ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dialog para editar receita do intermediário */}
      <Dialog open={receitaDialogOpen} onOpenChange={(open) => {
        setReceitaDialogOpen(open);
        if (!open) {
          setSelectedIntermediario(null);
          setNovoIngrediente({ insumo_id: '', quantidade: '' });
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-purple-500" />
              Receita: {selectedIntermediario?.nome}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Info do intermediário */}
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Unidade: <strong>{selectedIntermediario?.unidade_medida}</strong></span>
                <span>Rendimento: <strong>{selectedIntermediario?.rendimento_receita || 1} {selectedIntermediario?.unidade_medida}</strong></span>
                <span>Custo atual: <strong>{formatCurrency(selectedIntermediario?.custo_unitario || 0)}/{selectedIntermediario?.unidade_medida}</strong></span>
              </div>
            </div>

            {/* Lista de ingredientes */}
            {receitaIntermediaria && receitaIntermediaria.length > 0 ? (
              <div className="space-y-2">
                {receitaIntermediaria.map((item) => (
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
                
                {/* Total */}
                <div className="flex justify-between pt-2 border-t font-medium">
                  <span>Custo total da receita:</span>
                  <span>
                    {formatCurrency(
                      receitaIntermediaria.reduce((sum, item) => 
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

            {/* Adicionar ingrediente */}
            {insumosDisponiveis.length > 0 && (
              <div className="flex gap-2 pt-2 border-t">
                <SearchableSelect
                  options={insumosDisponiveis.map((insumo) => ({
                    value: insumo.id,
                    label: `${insumo.nome} (${insumo.unidade_medida})`,
                    searchTerms: insumo.nome,
                    icon: insumo.is_intermediario ? <FlaskConical className="h-3 w-3 text-purple-500" /> : undefined,
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
                  placeholder={insumoSelecionadoInfo ? `Qtd (${insumoSelecionadoInfo.unidade_medida})` : "Qtd"}
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
              <Button onClick={() => setReceitaDialogOpen(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : insumos && insumos.length > 0 ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="todos" className="gap-2">
              Todos
              <Badge variant="secondary" className="ml-1">{insumos.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="simples" className="gap-2">
              <ShoppingBasket className="h-4 w-4" />
              Insumos
              <Badge variant="secondary" className="ml-1">{insumosSimples.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="intermediarios" className="gap-2">
              <FlaskConical className="h-4 w-4 text-purple-500" />
              Intermediários
              <Badge variant="secondary" className="ml-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                {insumosIntermediarios.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="lista-compras" className="gap-2">
              <ShoppingCart className="h-4 w-4 text-green-600" />
              Lista de Compras
            </TabsTrigger>
          </TabsList>

          <TabsContent value="todos">
            {renderTable(insumos, true)}
          </TabsContent>

          <TabsContent value="simples">
            {insumosSimples.length > 0 ? (
              renderTable(insumosSimples)
            ) : (
              <Card className="p-8 text-center">
                <ShoppingBasket className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhum insumo simples cadastrado</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="intermediarios">
            {insumosIntermediarios.length > 0 ? (
              renderTable(insumosIntermediarios)
            ) : (
              <Card className="p-8 text-center">
                <FlaskConical className="h-10 w-10 mx-auto text-purple-400 mb-2" />
                <p className="text-muted-foreground">Nenhum produto intermediário cadastrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie um insumo e marque como "Produto Intermediário"
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="lista-compras">
            <ListaCompras />
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="p-12 text-center">
          <ShoppingBasket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum insumo cadastrado</h3>
          <p className="text-muted-foreground mb-4">
            Comece adicionando seus primeiros insumos.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Insumo
          </Button>
        </Card>
      )}

      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
        title="Excluir insumo"
        description="Tem certeza que deseja excluir este insumo? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default Insumos;