import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Factory, Package, Search, ChefHat, AlertTriangle, Clock, FlaskConical } from 'lucide-react';
import { MobileDataView, Column } from '@/components/ui/mobile-data-view';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertaVencimento } from '@/components/producao/AlertaVencimento';

type TipoProducao = 'produto' | 'receita';

const Producao = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [tipoProducao, setTipoProducao] = useState<TipoProducao>('produto');
  const [formData, setFormData] = useState({
    produto_id: '',
    quantidade: '1',
    observacao: '',
    shelf_life_dias: '',
    dias_alerta_vencimento: '3',
  });
  const [receitaFormData, setReceitaFormData] = useState({
    receita_id: '',
    quantidade: '1',
    observacao: '',
  });

  // Fetch produtos com ficha técnica
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ['produtos-producao', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select(`
          *,
          fichas_tecnicas (id)
        `)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      // Filtra apenas produtos que têm ficha técnica
      return data.filter(p => p.fichas_tecnicas && p.fichas_tecnicas.length > 0);
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch receitas (insumos intermediários) com ingredientes
  const { data: receitas, isLoading: loadingReceitas } = useQuery({
    queryKey: ['receitas-producao', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select(`
          id, 
          nome, 
          unidade_medida, 
          custo_unitario, 
          estoque_atual,
          rendimento_receita
        `)
        .eq('is_intermediario', true)
        .order('nome');

      if (error) throw error;
      
      // Buscar receitas que têm ingredientes cadastrados
      const { data: receitasComIngredientes, error: ingError } = await supabase
        .from('receitas_intermediarias')
        .select('insumo_id')
        .limit(1000);
      
      if (ingError) throw ingError;
      
      const idsComIngredientes = new Set(receitasComIngredientes?.map(r => r.insumo_id) || []);
      
      // Retorna apenas receitas que têm ingredientes
      return data.filter(r => idsComIngredientes.has(r.id));
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch todos os produtos para exibir estoque acabado
  const { data: todosProdutos } = useQuery({
    queryKey: ['produtos-estoque-acabado', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, estoque_acabado, preco_venda, categoria')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch histórico de produções
  const { data: producoes, isLoading: loadingProducoes } = useQuery({
    queryKey: ['producoes', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('producoes')
        .select(`
          *,
          produtos (nome)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Filtrar produtos com estoque
  const produtosComEstoque = useMemo(() => {
    if (!todosProdutos) return [];
    let filtered = todosProdutos;
    if (buscaProduto.trim()) {
      filtered = filtered.filter(p => 
        p.nome.toLowerCase().includes(buscaProduto.toLowerCase())
      );
    }
    return filtered;
  }, [todosProdutos, buscaProduto]);

  // Produtos com estoque acabado
  const produtosEmEstoque = useMemo(() => {
    if (!todosProdutos) return [];
    return todosProdutos.filter(p => Number(p.estoque_acabado) > 0);
  }, [todosProdutos]);

  // Mutation para produção de produtos
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const shelfLife = data.shelf_life_dias ? parseInt(data.shelf_life_dias) : null;
      const dataVencimento = shelfLife ? addDays(new Date(), shelfLife) : null;
      
      const { error } = await supabase.from('producoes').insert({
        empresa_id: usuario!.empresa_id,
        produto_id: data.produto_id,
        quantidade: parseFloat(data.quantidade) || 1,
        observacao: data.observacao || null,
        shelf_life_dias: shelfLife,
        dias_alerta_vencimento: parseInt(data.dias_alerta_vencimento) || 3,
        data_vencimento: dataVencimento ? format(dataVencimento, 'yyyy-MM-dd') : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['producoes'] });
      queryClient.invalidateQueries({ queryKey: ['producoes-vencimento'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-estoque-acabado'] });
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentos'] });
      toast({ title: 'Produção registrada!', description: 'Estoque de insumos baixado e produto acabado adicionado.' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao registrar', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation para produção de receitas
  const createReceitaMutation = useMutation({
    mutationFn: async (data: typeof receitaFormData) => {
      const receita = receitas?.find(r => r.id === data.receita_id);
      if (!receita) throw new Error('Receita não encontrada');

      const quantidade = parseFloat(data.quantidade) || 1;
      const rendimento = receita.rendimento_receita || 1;
      const quantidadeProduzida = quantidade * rendimento;

      // Buscar ingredientes da receita
      const { data: ingredientes, error: ingError } = await supabase
        .from('receitas_intermediarias')
        .select(`
          quantidade,
          insumo_ingrediente:insumos!receitas_intermediarias_insumo_ingrediente_id_fkey (
            id,
            nome,
            estoque_atual
          )
        `)
        .eq('insumo_id', data.receita_id);

      if (ingError) throw ingError;

      // Baixar estoque dos ingredientes
      for (const ing of ingredientes || []) {
        const quantidadeUsada = ing.quantidade * quantidade;
        const novoEstoque = (ing.insumo_ingrediente?.estoque_atual || 0) - quantidadeUsada;

        const { error: updateError } = await supabase
          .from('insumos')
          .update({ estoque_atual: Math.max(0, novoEstoque) })
          .eq('id', ing.insumo_ingrediente?.id);

        if (updateError) throw updateError;

        // Registrar movimento de estoque
        const { error: movError } = await supabase
          .from('estoque_movimentos')
          .insert({
            empresa_id: usuario!.empresa_id,
            insumo_id: ing.insumo_ingrediente?.id,
            quantidade: -quantidadeUsada,
            tipo: 'saida',
            origem: 'producao_receita',
            observacao: `Produção de ${receita.nome}`,
          });

        if (movError) throw movError;
      }

      // Adicionar ao estoque da receita (insumo intermediário)
      const { error: updateReceitaError } = await supabase
        .from('insumos')
        .update({ 
          estoque_atual: (receita.estoque_atual || 0) + quantidadeProduzida 
        })
        .eq('id', data.receita_id);

      if (updateReceitaError) throw updateReceitaError;

      // Registrar movimento de entrada no estoque da receita
      const { error: movEntradaError } = await supabase
        .from('estoque_movimentos')
        .insert({
          empresa_id: usuario!.empresa_id,
          insumo_id: data.receita_id,
          quantidade: quantidadeProduzida,
          tipo: 'entrada',
          origem: 'producao_receita',
          observacao: data.observacao || `Produção de ${quantidade} lote(s)`,
        });

      if (movEntradaError) throw movEntradaError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receitas-producao'] });
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['insumos-simples'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentos'] });
      toast({ title: 'Receita produzida!', description: 'Ingredientes baixados e estoque da receita atualizado.' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao produzir receita', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      produto_id: '',
      quantidade: '1',
      observacao: '',
      shelf_life_dias: '',
      dias_alerta_vencimento: '3',
    });
    setReceitaFormData({
      receita_id: '',
      quantidade: '1',
      observacao: '',
    });
    setTipoProducao('produto');
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tipoProducao === 'produto') {
      if (!formData.produto_id) {
        toast({ title: 'Selecione um produto', variant: 'destructive' });
        return;
      }
      createMutation.mutate(formData);
    } else {
      if (!receitaFormData.receita_id) {
        toast({ title: 'Selecione uma receita', variant: 'destructive' });
        return;
      }
      createReceitaMutation.mutate(receitaFormData);
    }
  };

  // Info da receita selecionada
  const receitaSelecionada = useMemo(() => {
    return receitas?.find(r => r.id === receitaFormData.receita_id);
  }, [receitas, receitaFormData.receita_id]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Produção</h1>
          <p className="text-muted-foreground">Registre produção de produtos para estoque</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Produção
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Produção</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Seletor de tipo */}
              <div className="space-y-2">
                <Label>O que você vai produzir?</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={tipoProducao === 'produto' ? 'default' : 'outline'}
                    className="h-auto py-3 flex flex-col items-center gap-1"
                    onClick={() => setTipoProducao('produto')}
                  >
                    <ChefHat className="h-5 w-5" />
                    <span className="text-xs">Produto Final</span>
                  </Button>
                  <Button
                    type="button"
                    variant={tipoProducao === 'receita' ? 'default' : 'outline'}
                    className="h-auto py-3 flex flex-col items-center gap-1"
                    onClick={() => setTipoProducao('receita')}
                  >
                    <FlaskConical className="h-5 w-5" />
                    <span className="text-xs">Receita Base</span>
                  </Button>
                </div>
              </div>

              {tipoProducao === 'produto' ? (
                <>
                  {/* Formulário para Produto Final */}
                  <div className="space-y-2">
                    <Label htmlFor="produto">Produto</Label>
                    <SearchableSelect
                      options={produtos?.map((produto) => ({
                        value: produto.id,
                        label: produto.nome,
                        searchTerms: produto.nome,
                        icon: <ChefHat className="h-3 w-3 text-primary" />,
                      })) || []}
                      value={formData.produto_id}
                      onValueChange={(value) => setFormData({ ...formData, produto_id: value })}
                      placeholder="Selecione um produto..."
                      searchPlaceholder="Buscar produto..."
                      emptyMessage="Nenhum produto com ficha técnica encontrado."
                    />
                    <p className="text-xs text-muted-foreground">
                      Apenas produtos com ficha técnica podem ser produzidos
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantidade">Quantidade a Produzir</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      step="1"
                      min="1"
                      value={formData.quantidade}
                      onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                      required
                    />
                  </div>

                  {/* Campos de Shelf Life */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shelf_life_dias" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Validade (dias)
                      </Label>
                      <Input
                        id="shelf_life_dias"
                        type="number"
                        step="1"
                        min="1"
                        placeholder="Ex: 7"
                        value={formData.shelf_life_dias}
                        onChange={(e) => setFormData({ ...formData, shelf_life_dias: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dias_alerta">Alertar antes de</Label>
                      <Input
                        id="dias_alerta"
                        type="number"
                        step="1"
                        min="1"
                        placeholder="Ex: 3"
                        value={formData.dias_alerta_vencimento}
                        onChange={(e) => setFormData({ ...formData, dias_alerta_vencimento: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">
                    Defina o shelf life do produto e quantos dias antes do vencimento deseja ser notificado
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="observacao">Observação (opcional)</Label>
                    <Textarea
                      id="observacao"
                      value={formData.observacao}
                      onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                      placeholder="Ex: Produção para evento de sábado"
                      rows={2}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Formulário para Receita Base */}
                  <div className="space-y-2">
                    <Label htmlFor="receita">Receita Base</Label>
                    <SearchableSelect
                      options={receitas?.map((receita) => ({
                        value: receita.id,
                        label: receita.nome,
                        searchTerms: receita.nome,
                        icon: <FlaskConical className="h-3 w-3 text-orange-500" />,
                      })) || []}
                      value={receitaFormData.receita_id}
                      onValueChange={(value) => setReceitaFormData({ ...receitaFormData, receita_id: value })}
                      placeholder="Selecione uma receita..."
                      searchPlaceholder="Buscar receita..."
                      emptyMessage="Nenhuma receita com ingredientes encontrada."
                    />
                    <p className="text-xs text-muted-foreground">
                      Apenas receitas com ingredientes podem ser produzidas
                    </p>
                  </div>

                  {receitaSelecionada && (
                    <div className="bg-muted/50 p-3 rounded-lg space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Rendimento por lote:</span>
                        <span className="font-medium">{receitaSelecionada.rendimento_receita || 1} {receitaSelecionada.unidade_medida}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Estoque atual:</span>
                        <span className="font-medium">{receitaSelecionada.estoque_atual || 0} {receitaSelecionada.unidade_medida}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Custo por {receitaSelecionada.unidade_medida}:</span>
                        <span className="font-medium">{formatCurrency(receitaSelecionada.custo_unitario)}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="quantidade_receita">Quantidade de Lotes</Label>
                    <Input
                      id="quantidade_receita"
                      type="number"
                      step="1"
                      min="1"
                      value={receitaFormData.quantidade}
                      onChange={(e) => setReceitaFormData({ ...receitaFormData, quantidade: e.target.value })}
                      required
                    />
                    {receitaSelecionada && (
                      <p className="text-xs text-muted-foreground">
                        Produzirá {(parseFloat(receitaFormData.quantidade) || 1) * (receitaSelecionada.rendimento_receita || 1)} {receitaSelecionada.unidade_medida}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacao_receita">Observação (opcional)</Label>
                    <Textarea
                      id="observacao_receita"
                      value={receitaFormData.observacao}
                      onChange={(e) => setReceitaFormData({ ...receitaFormData, observacao: e.target.value })}
                      placeholder="Ex: Massa para a semana"
                      rows={2}
                    />
                  </div>
                </>
              )}

              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  {tipoProducao === 'produto' 
                    ? 'Ao registrar a produção, os insumos serão baixados automaticamente do estoque.'
                    : 'Ao produzir a receita, os ingredientes serão baixados e o estoque da receita será atualizado.'
                  }
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || createReceitaMutation.isPending}
                >
                  <Factory className="mr-2 h-4 w-4" />
                  {tipoProducao === 'produto' ? 'Registrar Produção' : 'Produzir Receita'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alertas de Vencimento */}
      <AlertaVencimento />

      {/* Resumo de estoque acabado */}
      {produtosEmEstoque.length > 0 && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Package className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  {produtosEmEstoque.length} produto(s) em estoque acabado
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {produtosEmEstoque.slice(0, 3).map(p => `${p.nome} (${Number(p.estoque_acabado)})`).join(', ')}
                  {produtosEmEstoque.length > 3 && ` e mais ${produtosEmEstoque.length - 3}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="estoque" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="estoque" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Estoque Acabado
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* Aba Estoque Acabado */}
        <TabsContent value="estoque" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Estoque de Produtos Acabados</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingProdutos ? (
                <div className="p-6">
                  <Skeleton className="h-64" />
                </div>
              ) : produtosComEstoque && produtosComEstoque.length > 0 ? (
                <MobileDataView
                  data={produtosComEstoque}
                  keyExtractor={(produto) => produto.id}
                  columns={[
                    { key: 'nome', header: 'Produto', mobilePriority: 1, render: (p) => <span className="font-medium truncate block max-w-[120px] sm:max-w-none">{p.nome}</span> },
                    { key: 'categoria', header: 'Categoria', mobilePriority: 4, render: (p) => <span className="text-muted-foreground truncate block max-w-[80px]">{p.categoria || '-'}</span> },
                    { key: 'estoque', header: 'Estoque Acabado', align: 'right', mobilePriority: 2, render: (p) => {
                      const estoque = Number(p.estoque_acabado);
                      return <span className={estoque === 0 ? 'text-muted-foreground' : 'font-semibold text-green-600'}>{estoque} un</span>;
                    }},
                    { key: 'preco', header: 'Preço Venda', align: 'right', mobilePriority: 5, render: (p) => <span className="text-muted-foreground">{formatCurrency(Number(p.preco_venda))}</span> },
                    { key: 'status', header: 'Status', align: 'center', mobilePriority: 3, render: (p) => {
                      const estoque = Number(p.estoque_acabado);
                      return estoque > 0 ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">Em estoque</Badge>
                      ) : (
                        <Badge variant="secondary">Sem estoque</Badge>
                      );
                    }},
                  ]}
                  renderMobileHeader={(p) => <span className="truncate block max-w-[180px]">{p.nome}</span>}
                  renderMobileSubtitle={(p) => <span className="truncate block max-w-[120px]">{p.categoria || 'Sem categoria'}</span>}
                  renderMobileHighlight={(p) => {
                    const estoque = Number(p.estoque_acabado);
                    return <span className={estoque === 0 ? 'text-muted-foreground' : 'font-semibold text-green-600'}>{estoque} un</span>;
                  }}
                  emptyMessage={buscaProduto ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
                />
              ) : (
                <div className="p-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {buscaProduto ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
                  </h3>
                  <p className="text-muted-foreground">
                    {buscaProduto ? 'Tente outra busca' : 'Cadastre produtos na página de Produtos'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Histórico */}
        <TabsContent value="historico" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Histórico de Produções</CardTitle>
                <Badge variant="secondary">{producoes?.length || 0} registro(s)</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingProducoes ? (
                <div className="p-6">
                  <Skeleton className="h-64" />
                </div>
              ) : producoes && producoes.length > 0 ? (
                <MobileDataView
                  data={producoes}
                  keyExtractor={(prod) => prod.id}
                  columns={[
                    { key: 'data', header: 'Data', mobilePriority: 3, render: (p) => <span className="text-muted-foreground whitespace-nowrap text-xs">{format(new Date(p.created_at), 'dd/MM HH:mm', { locale: ptBR })}</span> },
                    { key: 'produto', header: 'Produto', mobilePriority: 1, render: (p) => <span className="font-medium truncate block max-w-[120px] sm:max-w-none">{p.produtos?.nome}</span> },
                    { key: 'quantidade', header: 'Qtd', align: 'right', mobilePriority: 2, render: (p) => (
                      <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1.5 py-0">+{Number(p.quantidade)}</Badge>
                    )},
                    { key: 'validade', header: 'Validade', mobilePriority: 4, hideOnMobile: true, render: (p) => p.data_vencimento ? (
                      <span className="text-muted-foreground text-xs whitespace-nowrap">{format(new Date(p.data_vencimento), 'dd/MM/yy', { locale: ptBR })}</span>
                    ) : <span className="text-muted-foreground/50 text-xs">-</span> },
                    { key: 'obs', header: 'Obs', mobilePriority: 5, hideOnMobile: true, render: (p) => <span className="text-muted-foreground text-xs truncate block max-w-[80px]">{p.observacao || '-'}</span> },
                  ]}
                  renderMobileHeader={(p) => <span className="truncate block max-w-[180px]">{p.produtos?.nome || 'Produto'}</span>}
                  renderMobileSubtitle={(p) => <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(p.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>}
                  renderMobileHighlight={(p) => (
                    <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1.5 py-0">+{Number(p.quantidade)} un</Badge>
                  )}
                  emptyMessage="Nenhuma produção registrada"
                  emptyAction={
                    <Button onClick={() => setDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Produção
                    </Button>
                  }
                />
              ) : (
                <div className="p-12 text-center">
                  <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma produção registrada</h3>
                  <p className="text-muted-foreground mb-4">
                    Registre produções para alimentar o estoque de produtos acabados.
                  </p>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Produção
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Producao;
