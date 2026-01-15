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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Factory, Package, Search, ChefHat, AlertTriangle, Clock } from 'lucide-react';
import { ScrollableTableWrapper } from '@/components/ui/scrollable-table-wrapper';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertaVencimento } from '@/components/producao/AlertaVencimento';

const Producao = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [formData, setFormData] = useState({
    produto_id: '',
    quantidade: '1',
    observacao: '',
    shelf_life_dias: '',
    dias_alerta_vencimento: '3',
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

  const resetForm = () => {
    setFormData({
      produto_id: '',
      quantidade: '1',
      observacao: '',
      shelf_life_dias: '',
      dias_alerta_vencimento: '3',
    });
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.produto_id) {
      toast({ title: 'Selecione um produto', variant: 'destructive' });
      return;
    }
    createMutation.mutate(formData);
  };

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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Produção</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Ao registrar a produção, os insumos serão baixados automaticamente do estoque.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  <Factory className="mr-2 h-4 w-4" />
                  Registrar Produção
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
              <ScrollableTableWrapper>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Produto</TableHead>
                        <TableHead className="min-w-[100px]">Categoria</TableHead>
                        <TableHead className="text-right min-w-[120px]">Estoque Acabado</TableHead>
                        <TableHead className="text-right min-w-[100px]">Preço Venda</TableHead>
                        <TableHead className="text-center min-w-[100px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produtosComEstoque.map((produto) => {
                        const estoque = Number(produto.estoque_acabado);
                        return (
                          <TableRow key={produto.id}>
                            <TableCell className="font-medium">
                              {produto.nome}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {produto.categoria || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={estoque === 0 ? 'text-muted-foreground' : 'font-semibold text-green-600'}>
                                {estoque} un
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {formatCurrency(Number(produto.preco_venda))}
                            </TableCell>
                            <TableCell className="text-center">
                              {estoque > 0 ? (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  Em estoque
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  Sem estoque
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollableTableWrapper>
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
              <ScrollableTableWrapper>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[130px]">Data</TableHead>
                        <TableHead className="min-w-[120px]">Produto</TableHead>
                        <TableHead className="text-right min-w-[100px]">Quantidade</TableHead>
                        <TableHead className="min-w-[100px]">Validade</TableHead>
                        <TableHead className="min-w-[120px]">Observação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {producoes.map((prod) => (
                        <TableRow key={prod.id}>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {format(new Date(prod.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-medium">
                            {prod.produtos?.nome}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              +{Number(prod.quantidade)} un
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {prod.data_vencimento ? (
                              <span className="text-muted-foreground text-sm">
                                {format(new Date(prod.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50 text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-48 truncate">
                            {prod.observacao || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollableTableWrapper>
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
