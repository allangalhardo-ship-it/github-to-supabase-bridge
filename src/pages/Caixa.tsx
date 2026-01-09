import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { 
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  DollarSign,
  ShoppingCart,
  Receipt,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

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

interface Venda {
  id: string;
  valor_total: number;
  data_venda: string;
  quantidade: number;
  produto_id: string | null;
  descricao_produto: string | null;
  canal: string | null;
  produtos?: { nome: string } | null;
}

interface XmlNota {
  id: string;
  valor_total: number | null;
  data_emissao: string | null;
  fornecedor: string | null;
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

const Caixa = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipoMovimento, setTipoMovimento] = useState<'entrada' | 'saida'>('entrada');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataMovimento, setDataMovimento] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Filtros
  const [mesAtual, setMesAtual] = useState(new Date());
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'saida'>('todos');

  const dataInicio = format(startOfMonth(mesAtual), 'yyyy-MM-dd');
  const dataFim = format(endOfMonth(mesAtual), 'yyyy-MM-dd');

  // Buscar movimentos manuais
  const { data: movimentosManuais, isLoading: loadingMovimentos } = useQuery({
    queryKey: ['caixa-movimentos', usuario?.empresa_id, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('caixa_movimentos')
        .select('*')
        .gte('data_movimento', dataInicio)
        .lte('data_movimento', dataFim)
        .order('data_movimento', { ascending: false });

      if (error) throw error;
      return data as CaixaMovimento[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar vendas (entradas)
  const { data: vendas, isLoading: loadingVendas } = useQuery({
    queryKey: ['caixa-vendas', usuario?.empresa_id, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select('id, valor_total, data_venda, quantidade, produto_id, descricao_produto, canal, produtos(nome)')
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim)
        .order('data_venda', { ascending: false });

      if (error) throw error;
      return data as Venda[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar compras/notas (saídas)
  const { data: notas, isLoading: loadingNotas } = useQuery({
    queryKey: ['caixa-notas', usuario?.empresa_id, dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xml_notas')
        .select('id, valor_total, data_emissao, fornecedor')
        .gte('data_emissao', dataInicio)
        .lte('data_emissao', dataFim)
        .order('data_emissao', { ascending: false });

      if (error) throw error;
      return data as XmlNota[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Criar movimento manual
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
      toast({ title: 'Movimento registrado!', description: 'O lançamento foi salvo com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: 'Não foi possível salvar o movimento.', variant: 'destructive' });
      console.error(error);
    },
  });

  const resetForm = () => {
    setTipoMovimento('entrada');
    setCategoria('');
    setDescricao('');
    setValor('');
    setDataMovimento(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoria || !descricao || !valor) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    createMutation.mutate({
      tipo: tipoMovimento,
      categoria,
      descricao,
      valor: parseFloat(valor),
      data_movimento: dataMovimento,
    });
  };

  // Consolidar todos os movimentos
  const todosMovimentos = useMemo(() => {
    const items: Array<{
      id: string;
      tipo: 'entrada' | 'saida';
      categoria: string;
      descricao: string;
      valor: number;
      data: string;
      origem: string;
    }> = [];

    // Movimentos manuais
    movimentosManuais?.forEach(m => {
      items.push({
        id: m.id,
        tipo: m.tipo,
        categoria: m.categoria,
        descricao: m.descricao,
        valor: m.valor,
        data: m.data_movimento,
        origem: 'manual',
      });
    });

    // Vendas como entrada
    vendas?.forEach(v => {
      const produtoNome = v.produtos?.nome || v.descricao_produto || 'Produto';
      items.push({
        id: `venda-${v.id}`,
        tipo: 'entrada',
        categoria: 'Venda',
        descricao: `${produtoNome} (${v.quantidade}x) - ${v.canal || 'balcão'}`,
        valor: v.valor_total,
        data: v.data_venda,
        origem: 'venda',
      });
    });

    // Notas como saída
    notas?.forEach(n => {
      if (n.valor_total && n.data_emissao) {
        items.push({
          id: `nota-${n.id}`,
          tipo: 'saida',
          categoria: 'Compra de insumos',
          descricao: n.fornecedor || 'Fornecedor',
          valor: n.valor_total,
          data: n.data_emissao,
          origem: 'nota',
        });
      }
    });

    // Ordenar por data decrescente
    return items.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [movimentosManuais, vendas, notas]);

  // Filtrar movimentos
  const movimentosFiltrados = useMemo(() => {
    if (filtroTipo === 'todos') return todosMovimentos;
    return todosMovimentos.filter(m => m.tipo === filtroTipo);
  }, [todosMovimentos, filtroTipo]);

  // Totais
  const totalEntradas = todosMovimentos
    .filter(m => m.tipo === 'entrada')
    .reduce((sum, m) => sum + m.valor, 0);

  const totalSaidas = todosMovimentos
    .filter(m => m.tipo === 'saida')
    .reduce((sum, m) => sum + m.valor, 0);

  const saldo = totalEntradas - totalSaidas;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleMesAnterior = () => {
    setMesAtual(subMonths(mesAtual, 1));
  };

  const handleProximoMes = () => {
    const proximo = addMonths(mesAtual, 1);
    if (proximo <= new Date()) {
      setMesAtual(proximo);
    }
  };

  const isLoading = loadingMovimentos || loadingVendas || loadingNotas;

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="h-7 w-7 text-primary" />
              Caixa
            </h1>
            <p className="text-muted-foreground">
              Controle de entradas e saídas
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Lançamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Lançamento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tipo */}
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

                {/* Categoria */}
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

                {/* Descrição */}
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Ex: Pagamento fornecedor X"
                  />
                </div>

                {/* Valor */}
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

                {/* Data */}
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={dataMovimento}
                    onChange={(e) => setDataMovimento(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Salvando...' : 'Salvar Lançamento'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Navegação de mês */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="icon" onClick={handleMesAnterior}>
            <Calendar className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold min-w-[150px] text-center">
            {format(mesAtual, "MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleProximoMes}
            disabled={mesAtual >= startOfMonth(new Date())}
          >
            <Calendar className="h-4 w-4" />
          </Button>
        </div>

        {/* Cards de resumo */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Entradas</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(totalEntradas)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saídas</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totalSaidas)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={`border-l-4 ${saldo >= 0 ? 'border-l-primary' : 'border-l-red-500'}`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${saldo >= 0 ? 'bg-primary/10' : 'bg-red-100 dark:bg-red-900/30'}`}>
                    <DollarSign className={`h-6 w-6 ${saldo >= 0 ? 'text-primary' : 'text-red-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo do Mês</p>
                    <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-primary' : 'text-red-600'}`}>
                      {formatCurrency(saldo)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filtros e lista */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Movimentações
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as 'todos' | 'entrada' | 'saida')}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64" />
            ) : movimentosFiltrados.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentosFiltrados.map((movimento) => (
                    <TableRow key={movimento.id}>
                      <TableCell>
                        {format(parseISO(movimento.data), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        {movimento.tipo === 'entrada' ? (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            <ArrowUpCircle className="h-3 w-3 mr-1" />
                            Entrada
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100">
                            <ArrowDownCircle className="h-3 w-3 mr-1" />
                            Saída
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{movimento.categoria}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{movimento.descricao}</TableCell>
                      <TableCell>
                        {movimento.origem === 'venda' && (
                          <Badge variant="outline" className="gap-1">
                            <ShoppingCart className="h-3 w-3" />
                            Venda
                          </Badge>
                        )}
                        {movimento.origem === 'nota' && (
                          <Badge variant="outline" className="gap-1">
                            <Receipt className="h-3 w-3" />
                            NF-e
                          </Badge>
                        )}
                        {movimento.origem === 'manual' && (
                          <Badge variant="secondary" className="gap-1">
                            Manual
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${movimento.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                        {movimento.tipo === 'entrada' ? '+' : '-'} {formatCurrency(movimento.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma movimentação</h3>
                <p className="text-muted-foreground">
                  Não há movimentações neste período.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
};

export default Caixa;
