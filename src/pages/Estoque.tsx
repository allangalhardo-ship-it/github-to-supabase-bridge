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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, ArrowUp, ArrowDown, Warehouse, Package, AlertTriangle, Search, Filter, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Estoque = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    insumo_id: '',
    tipo: 'entrada' as 'entrada' | 'saida',
    quantidade: '',
    observacao: '',
  });

  // Filtros para movimentações
  const [filtroInsumo, setFiltroInsumo] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroOrigem, setFiltroOrigem] = useState<string>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('mes');
  const [buscaInsumo, setBuscaInsumo] = useState('');

  // Fetch insumos para o select e lista de saldo
  const { data: insumos, isLoading: loadingInsumos } = useQuery({
    queryKey: ['insumos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .order('nome');

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch movimentos
  const { data: movimentos, isLoading: loadingMovimentos } = useQuery({
    queryKey: ['estoque-movimentos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentos')
        .select(`
          *,
          insumos (nome, unidade_medida)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Filtrar insumos pela busca
  const insumosFiltrados = useMemo(() => {
    if (!insumos) return [];
    if (!buscaInsumo.trim()) return insumos;
    return insumos.filter(i => 
      i.nome.toLowerCase().includes(buscaInsumo.toLowerCase())
    );
  }, [insumos, buscaInsumo]);

  // Insumos com estoque baixo
  const insumosEstoqueBaixo = useMemo(() => {
    if (!insumos) return [];
    return insumos.filter(i => Number(i.estoque_atual) <= Number(i.estoque_minimo));
  }, [insumos]);

  // Filtrar movimentações
  const movimentosFiltrados = useMemo(() => {
    if (!movimentos) return [];

    let filtered = [...movimentos];

    // Filtro por insumo
    if (filtroInsumo !== 'todos') {
      filtered = filtered.filter(m => m.insumo_id === filtroInsumo);
    }

    // Filtro por tipo
    if (filtroTipo !== 'todos') {
      filtered = filtered.filter(m => m.tipo === filtroTipo);
    }

    // Filtro por origem
    if (filtroOrigem !== 'todos') {
      filtered = filtered.filter(m => m.origem === filtroOrigem);
    }

    // Filtro por período
    const hoje = new Date();
    let dataInicio: Date | null = null;

    switch (filtroPeriodo) {
      case 'mes':
        dataInicio = startOfMonth(hoje);
        break;
      case 'mesPassado':
        dataInicio = startOfMonth(subMonths(hoje, 1));
        const fimMesPassado = endOfMonth(subMonths(hoje, 1));
        filtered = filtered.filter(m => {
          const data = new Date(m.created_at);
          return data >= dataInicio! && data <= fimMesPassado;
        });
        return filtered;
      case 'ultimos3meses':
        dataInicio = startOfMonth(subMonths(hoje, 2));
        break;
      case 'todos':
        break;
    }

    if (dataInicio && filtroPeriodo !== 'mesPassado') {
      filtered = filtered.filter(m => new Date(m.created_at) >= dataInicio!);
    }

    return filtered;
  }, [movimentos, filtroInsumo, filtroTipo, filtroOrigem, filtroPeriodo]);

  // Origens únicas para filtro
  const origensUnicas = useMemo(() => {
    if (!movimentos) return [];
    return [...new Set(movimentos.map(m => m.origem))];
  }, [movimentos]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('estoque_movimentos').insert({
        empresa_id: usuario!.empresa_id,
        insumo_id: data.insumo_id,
        tipo: data.tipo,
        quantidade: parseFloat(data.quantidade) || 0,
        origem: 'manual',
        observacao: data.observacao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentos'] });
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      toast({ title: 'Movimento registrado!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao registrar', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      insumo_id: '',
      tipo: 'entrada',
      quantidade: '',
      observacao: '',
    });
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const limparFiltros = () => {
    setFiltroInsumo('todos');
    setFiltroTipo('todos');
    setFiltroOrigem('todos');
    setFiltroPeriodo('mes');
  };

  const temFiltrosAtivos = filtroInsumo !== 'todos' || filtroTipo !== 'todos' || filtroOrigem !== 'todos' || filtroPeriodo !== 'mes';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Estoque</h1>
          <p className="text-muted-foreground">Gerencie o estoque de insumos</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Movimentação
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Movimentação</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="insumo">Insumo</Label>
                <Select
                  value={formData.insumo_id}
                  onValueChange={(value) => setFormData({ ...formData, insumo_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    {insumos?.map((insumo) => (
                      <SelectItem key={insumo.id} value={insumo.id}>
                        {insumo.nome} ({insumo.unidade_medida})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value: 'entrada' | 'saida') => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">
                        <span className="flex items-center gap-2">
                          <ArrowUp className="h-4 w-4 text-green-600" />
                          Entrada
                        </span>
                      </SelectItem>
                      <SelectItem value="saida">
                        <span className="flex items-center gap-2">
                          <ArrowDown className="h-4 w-4 text-red-600" />
                          Saída
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.quantidade}
                    onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                    placeholder="0"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="observacao">Observação</Label>
                <Textarea
                  id="observacao"
                  value={formData.observacao}
                  onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                  placeholder="Ex: Compra de fornecedor X"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  Registrar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alerta de estoque baixo */}
      {insumosEstoqueBaixo.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {insumosEstoqueBaixo.length} insumo(s) com estoque baixo
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {insumosEstoqueBaixo.slice(0, 3).map(i => i.nome).join(', ')}
                  {insumosEstoqueBaixo.length > 3 && ` e mais ${insumosEstoqueBaixo.length - 3}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="saldo" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="saldo" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Saldo Atual
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="flex items-center gap-2">
            <Warehouse className="h-4 w-4" />
            Movimentações
          </TabsTrigger>
        </TabsList>

        {/* Aba Saldo Atual */}
        <TabsContent value="saldo" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Saldo de Estoque</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar insumo..."
                    value={buscaInsumo}
                    onChange={(e) => setBuscaInsumo(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingInsumos ? (
                <div className="p-6">
                  <Skeleton className="h-64" />
                </div>
              ) : insumosFiltrados && insumosFiltrados.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Insumo</TableHead>
                      <TableHead className="text-right">Estoque Atual</TableHead>
                      <TableHead className="text-right">Estoque Mínimo</TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insumosFiltrados.map((insumo) => {
                      const estoqueBaixo = Number(insumo.estoque_atual) <= Number(insumo.estoque_minimo);
                      const estoqueZerado = Number(insumo.estoque_atual) <= 0;
                      return (
                        <TableRow key={insumo.id}>
                          <TableCell className="font-medium">
                            {insumo.nome}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={estoqueZerado ? 'text-red-600 font-semibold' : estoqueBaixo ? 'text-amber-600 font-semibold' : ''}>
                              {Number(insumo.estoque_atual).toFixed(2)} {insumo.unidade_medida}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {Number(insumo.estoque_minimo).toFixed(2)} {insumo.unidade_medida}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            R$ {Number(insumo.custo_unitario).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            {estoqueZerado ? (
                              <Badge variant="destructive">Zerado</Badge>
                            ) : estoqueBaixo ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-600">Baixo</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-600">OK</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {buscaInsumo ? 'Nenhum insumo encontrado' : 'Nenhum insumo cadastrado'}
                  </h3>
                  <p className="text-muted-foreground">
                    {buscaInsumo ? 'Tente outra busca' : 'Cadastre insumos na página de Insumos'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Movimentações */}
        <TabsContent value="movimentacoes" className="mt-6 space-y-4">
          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Filtros</CardTitle>
                </div>
                {temFiltrosAtivos && (
                  <Button variant="ghost" size="sm" onClick={limparFiltros}>
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mes">Este mês</SelectItem>
                      <SelectItem value="mesPassado">Mês passado</SelectItem>
                      <SelectItem value="ultimos3meses">Últimos 3 meses</SelectItem>
                      <SelectItem value="todos">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Insumo</Label>
                  <Select value={filtroInsumo} onValueChange={setFiltroInsumo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {insumos?.map((insumo) => (
                        <SelectItem key={insumo.id} value={insumo.id}>
                          {insumo.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      {origensUnicas.map((origem) => (
                        <SelectItem key={origem} value={origem}>
                          {origem}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de movimentações */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Histórico de Movimentações</CardTitle>
                <Badge variant="secondary">{movimentosFiltrados.length} registro(s)</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingMovimentos ? (
                <div className="p-6">
                  <Skeleton className="h-64" />
                </div>
              ) : movimentosFiltrados && movimentosFiltrados.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Insumo</TableHead>
                      <TableHead className="text-center">Tipo</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentosFiltrados.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {format(new Date(mov.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {mov.insumos?.nome}
                        </TableCell>
                        <TableCell className="text-center">
                          {mov.tipo === 'entrada' ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <ArrowUp className="h-3 w-3 mr-1" />
                              Entrada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-600">
                              <ArrowDown className="h-3 w-3 mr-1" />
                              Saída
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {Number(mov.quantidade).toFixed(2)} {mov.insumos?.unidade_medida}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{mov.origem}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-48 truncate">
                          {mov.observacao || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center">
                  <Warehouse className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma movimentação encontrada</h3>
                  <p className="text-muted-foreground mb-4">
                    {temFiltrosAtivos ? 'Tente ajustar os filtros' : 'Registre entradas e saídas de estoque.'}
                  </p>
                  {!temFiltrosAtivos && (
                    <Button onClick={() => setDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Movimentação
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Estoque;
