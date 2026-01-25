import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Trash2, 
  Pencil,
  Wallet, 
  Filter, 
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { formatCurrencyBRL } from '@/lib/format';
import { ptBR } from 'date-fns/locale';

interface CaixaMovimento {
  id: string;
  tipo: 'entrada' | 'saida';
  categoria: string;
  descricao: string;
  valor: number;
  data_movimento: string;
  origem: string;
  created_at: string;
}

const CATEGORIAS_ENTRADA = [
  'Venda',
  'Devolução',
  'Empréstimo recebido',
  'Aporte',
  'Outros'
];

const CATEGORIAS_SAIDA = [
  'Compra de insumos',
  'Retirada',
  'Pagamento fornecedor',
  'Despesa operacional',
  'Salários',
  'Aluguel',
  'Contas',
  'Outros'
];

const LancamentosManuaisTab = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [filtroDataInicio, setFiltroDataInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filtroDataFim, setFiltroDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos');
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [movimentoToDelete, setMovimentoToDelete] = useState<string | null>(null);
  
  const [tipoMovimento, setTipoMovimento] = useState<'entrada' | 'saida'>('entrada');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataMovimento, setDataMovimento] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: movimentos, isLoading } = useQuery({
    queryKey: ['caixa-movimentos-gestao', usuario?.empresa_id, filtroDataInicio, filtroDataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .select('*')
        .gte('data_movimento', filtroDataInicio)
        .lte('data_movimento', filtroDataFim)
        .order('data_movimento', { ascending: false });

      if (error) throw error;
      return data as CaixaMovimento[];
    },
    enabled: !!usuario?.empresa_id,
  });

  const movimentosFiltrados = React.useMemo(() => {
    if (!movimentos) return [];
    if (filtroTipo === 'todos') return movimentos;
    return movimentos.filter(m => m.tipo === filtroTipo);
  }, [movimentos, filtroTipo]);

  const createMutation = useMutation({
    mutationFn: async (movimento: {
      tipo: 'entrada' | 'saida';
      categoria: string;
      descricao: string;
      valor: number;
      data_movimento: string;
    }) => {
      const { error } = await supabase
        .from('caixa_movimentos')
        .insert({
          ...movimento,
          empresa_id: usuario?.empresa_id,
          origem: 'manual',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      setDialogOpen(false);
      resetForm();
      toast({ title: 'Lançamento criado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...movimento }: {
      id: string;
      tipo: 'entrada' | 'saida';
      categoria: string;
      descricao: string;
      valor: number;
      data_movimento: string;
    }) => {
      const { error } = await supabase
        .from('caixa_movimentos')
        .update(movimento)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      setDialogOpen(false);
      resetForm();
      toast({ title: 'Lançamento atualizado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('caixa_movimentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      toast({ title: 'Lançamento excluído!' });
      setDeleteConfirmOpen(false);
      setMovimentoToDelete(null);
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setTipoMovimento('entrada');
    setCategoria('');
    setDescricao('');
    setValor('');
    setDataMovimento(format(new Date(), 'yyyy-MM-dd'));
    setEditingId(null);
  };

  const handleEdit = (movimento: CaixaMovimento) => {
    setEditingId(movimento.id);
    setTipoMovimento(movimento.tipo);
    setCategoria(movimento.categoria);
    setDescricao(movimento.descricao);
    setValor(movimento.valor.toString());
    setDataMovimento(movimento.data_movimento);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoria || !descricao || !valor) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    
    const data = {
      tipo: tipoMovimento,
      categoria,
      descricao,
      valor: parseFloat(valor),
      data_movimento: dataMovimento,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatCurrency = formatCurrencyBRL;

  const totalEntradas = movimentosFiltrados
    .filter(m => m.tipo === 'entrada')
    .reduce((sum, m) => sum + m.valor, 0);

  const totalSaidas = movimentosFiltrados
    .filter(m => m.tipo === 'saida')
    .reduce((sum, m) => sum + m.valor, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Lançamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs value={tipoMovimento} onValueChange={(v) => {
                setTipoMovimento(v as 'entrada' | 'saida');
                setCategoria('');
              }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="entrada" className="gap-2">
                    <ArrowUpCircle className="h-4 w-4" />
                    Entrada
                  </TabsTrigger>
                  <TabsTrigger value="saida" className="gap-2">
                    <ArrowDownCircle className="h-4 w-4" />
                    Saída
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {(tipoMovimento === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA).map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Pagamento fornecedor X"
                />
              </div>

              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={dataMovimento}
                  onChange={(e) => setDataMovimento(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data Início</Label>
              <Input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Fim</Label>
              <Input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as 'todos' | 'entrada' | 'saida')}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totalizadores */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Entradas</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalEntradas)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Saídas</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalSaidas)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : movimentosFiltrados && movimentosFiltrados.length > 0 ? (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[70px]">Data</TableHead>
                  <TableHead className="w-[80px]">Tipo</TableHead>
                  <TableHead className="w-[90px]">Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right w-[100px]">Valor</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentosFiltrados.map((movimento) => (
                  <TableRow key={movimento.id}>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {format(new Date(movimento.data_movimento), 'dd/MM/yy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={movimento.tipo === 'entrada' ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                        {movimento.tipo === 'entrada' ? '↑' : '↓'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs truncate max-w-[80px]">{movimento.categoria}</TableCell>
                    <TableCell className="font-medium max-w-[120px] truncate text-sm">
                      {movimento.descricao}
                    </TableCell>
                    <TableCell className={`text-right font-medium whitespace-nowrap text-sm ${movimento.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                      {movimento.tipo === 'entrada' ? '+' : '-'} {formatCurrency(movimento.valor)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(movimento)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            setMovimentoToDelete(movimento.id);
                            setDeleteConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum lançamento encontrado</h3>
          <p className="text-muted-foreground mb-4">
            Registre entradas e saídas manuais do caixa.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Lançamento
          </Button>
        </Card>
      )}

      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={() => movimentoToDelete && deleteMutation.mutate(movimentoToDelete)}
        title="Excluir lançamento"
        description="Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default LancamentosManuaisTab;
