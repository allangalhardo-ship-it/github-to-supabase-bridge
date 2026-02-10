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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, ArrowUp, ArrowDown, Warehouse, Package, AlertTriangle, Search, Filter, X, Factory, Clock, PackageOpen } from 'lucide-react';
import ImplantacaoSaldoDialog from '@/components/estoque/ImplantacaoSaldoDialog';
import { InsumoIcon } from '@/lib/insumoIconUtils';
import { MobileDataView, Column } from '@/components/ui/mobile-data-view';
import { format, startOfMonth, endOfMonth, subMonths, differenceInDays, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { inserirMovimentoEstoque, calcularEstoqueDeMovimentos } from '@/lib/estoqueUtils';
import { formatCurrencySmartBRL } from '@/lib/format';
import ContextualTip from '@/components/onboarding/ContextualTip';
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
  const [buscaProduto, setBuscaProduto] = useState('');
  const [implantacaoOpen, setImplantacaoOpen] = useState(false);
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

  // Fetch produtos para estoque acabado com validades
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ['produtos-estoque', usuario?.empresa_id],
    queryFn: async () => {
      // Buscar produtos
      const { data: produtosData, error: produtosError } = await supabase
        .from('produtos')
        .select('id, nome, estoque_acabado, preco_venda, categoria')
        .eq('ativo', true)
        .order('nome');

      if (produtosError) throw produtosError;

      // Buscar produções com validade para cada produto
      const { data: producoes, error: producoesError } = await supabase
        .from('producoes')
        .select('produto_id, data_vencimento, quantidade')
        .not('data_vencimento', 'is', null)
        .order('data_vencimento', { ascending: true });

      if (producoesError) throw producoesError;

      // Mapear produtos com a próxima validade
      return produtosData.map(produto => {
        const producoesDoProdu = producoes?.filter(p => p.produto_id === produto.id) || [];
        const proximaValidade = producoesDoProdu.length > 0 ? producoesDoProdu[0].data_vencimento : null;
        
        return {
          ...produto,
          proxima_validade: proximaValidade,
        };
      });
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

  // Filtrar produtos pela busca
  const produtosFiltrados = useMemo(() => {
    if (!produtos) return [];
    if (!buscaProduto.trim()) return produtos;
    return produtos.filter(p => 
      p.nome.toLowerCase().includes(buscaProduto.toLowerCase())
    );
  }, [produtos, buscaProduto]);

  // Produtos com estoque acabado
  const produtosEmEstoque = useMemo(() => {
    if (!produtos) return [];
    return produtos.filter(p => Number(p.estoque_acabado) > 0);
  }, [produtos]);

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
      const quantidade = parseFloat(data.quantidade) || 0;
      
      // Insert the movement using helper that normalizes quantity
      await inserirMovimentoEstoque({
        empresa_id: usuario!.empresa_id,
        insumo_id: data.insumo_id,
        tipo: data.tipo,
        quantidade: quantidade,
        origem: 'manual',
        observacao: data.observacao || null,
      });

      // Get current stock - trigger already updated, but we verify
      const { data: insumo, error: insumoError } = await supabase
        .from('insumos')
        .select('estoque_atual')
        .eq('id', data.insumo_id)
        .maybeSingle();
      
      if (insumoError) throw insumoError;
      if (!insumo) throw new Error('Insumo não encontrado');
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
    <div className="space-y-4 sm:space-y-6">
      <ContextualTip
        tipKey="estoque-intro"
        title="📦 Informe o que você tem em estoque agora!"
        description="Use 'Implantação de Saldo' para registrar a quantidade e o custo dos ingredientes que você já tem. Isso ajuda a calcular o custo real dos seus produtos."
      />
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Estoque</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Acompanhe o estoque de insumos e produtos acabados</p>
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

      <Tabs defaultValue="insumos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 gap-1">
          <TabsTrigger value="insumos" className="flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm">
            <Package className="h-4 w-4 shrink-0" />
            <span className="truncate">Insumos</span>
          </TabsTrigger>
          <TabsTrigger value="acabados" className="flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm">
            <Factory className="h-4 w-4 shrink-0" />
            <span className="truncate">Acabados</span>
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm">
            <Warehouse className="h-4 w-4 shrink-0" />
            <span className="truncate">Movim.</span>
          </TabsTrigger>
        </TabsList>

        {/* Aba Estoque de Insumos */}
        <TabsContent value="insumos" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CardTitle>Estoque de Insumos</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setImplantacaoOpen(true)}
                  >
                    <PackageOpen className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Implantação de Saldo</span>
                    <span className="sm:hidden">Implantar</span>
                  </Button>
                </div>
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
                <MobileDataView
                  data={insumosFiltrados}
                  keyExtractor={(insumo) => insumo.id}
                  columns={[
                    { key: 'nome', header: 'Insumo', mobilePriority: 1, render: (i) => (
                      <span className="font-medium truncate block max-w-[120px] sm:max-w-none flex items-center gap-1.5">
                        <InsumoIcon nome={i.nome} className="h-4 w-4 shrink-0" />
                        <span className="truncate">{i.nome}</span>
                      </span>
                    ) },
                    { key: 'estoque', header: 'Estoque Atual', align: 'right', mobilePriority: 2, render: (i) => {
                      const estoqueBaixo = Number(i.estoque_atual) <= Number(i.estoque_minimo);
                      const estoqueZerado = Number(i.estoque_atual) <= 0;
                      return (
                        <span className={estoqueZerado ? 'text-red-600 font-semibold' : estoqueBaixo ? 'text-amber-600 font-semibold' : ''}>
                          {Number(i.estoque_atual).toFixed(2)} {i.unidade_medida}
                        </span>
                      );
                    }},
                    { key: 'minimo', header: 'Estoque Mínimo', align: 'right', mobilePriority: 4, hideOnMobile: true, render: (i) => (
                      <span className="text-muted-foreground text-xs whitespace-nowrap">{Number(i.estoque_minimo).toFixed(2)} {i.unidade_medida}</span>
                    )},
                    { key: 'custo', header: 'Custo Unit.', align: 'right', mobilePriority: 5, hideOnMobile: true, render: (i) => (
                      <span className="text-muted-foreground">{formatCurrencySmartBRL(Number(i.custo_unitario))}</span>
                    )},
                    { key: 'status', header: 'Status', align: 'center', mobilePriority: 3, render: (i) => {
                      const estoqueBaixo = Number(i.estoque_atual) <= Number(i.estoque_minimo);
                      const estoqueZerado = Number(i.estoque_atual) <= 0;
                      return estoqueZerado ? (
                        <Badge variant="destructive">Zerado</Badge>
                      ) : estoqueBaixo ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-600">Baixo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-600">OK</Badge>
                      );
                    }},
                  ]}
                  renderMobileHeader={(i) => (
                    <span className="truncate flex items-center gap-1.5 max-w-[180px]">
                      <InsumoIcon nome={i.nome} className="h-4 w-4 shrink-0" />
                      <span className="truncate">{i.nome}</span>
                    </span>
                  )}
                  renderMobileSubtitle={(i) => {
                    const estoqueBaixo = Number(i.estoque_atual) <= Number(i.estoque_minimo);
                    const estoqueZerado = Number(i.estoque_atual) <= 0;
                    return (
                      <span className={`whitespace-nowrap ${estoqueZerado ? 'text-red-600 font-semibold' : estoqueBaixo ? 'text-amber-600 font-semibold' : ''}`}>
                        {Number(i.estoque_atual).toFixed(2)} {i.unidade_medida}
                      </span>
                    );
                  }}
                  renderMobileHighlight={(i) => {
                    const estoqueBaixo = Number(i.estoque_atual) <= Number(i.estoque_minimo);
                    const estoqueZerado = Number(i.estoque_atual) <= 0;
                    return estoqueZerado ? (
                      <Badge variant="destructive">Zerado</Badge>
                    ) : estoqueBaixo ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-600">Baixo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-600">OK</Badge>
                    );
                  }}
                  emptyMessage={buscaInsumo ? 'Nenhum insumo encontrado' : 'Nenhum insumo cadastrado'}
                />
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

        {/* Aba Estoque de Produtos Acabados */}
        <TabsContent value="acabados" className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Estoque de Produtos Acabados</CardTitle>
                  {produtosEmEstoque.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {produtosEmEstoque.length} produto(s) em estoque
                    </p>
                  )}
                </div>
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
              ) : produtosFiltrados && produtosFiltrados.length > 0 ? (
                <MobileDataView
                  data={produtosFiltrados}
                  keyExtractor={(produto) => produto.id}
                  columns={[
                    { key: 'nome', header: 'Produto', mobilePriority: 1, render: (p) => <span className="font-medium">{p.nome}</span> },
                    { key: 'categoria', header: 'Categoria', mobilePriority: 4, render: (p) => <span className="text-muted-foreground">{p.categoria || '-'}</span> },
                    { key: 'estoque', header: 'Estoque', align: 'right', mobilePriority: 2, render: (p) => {
                      const estoque = Number(p.estoque_acabado);
                      return <span className={estoque === 0 ? 'text-muted-foreground' : 'font-semibold text-green-600'}>{estoque} un</span>;
                    }},
                    { key: 'validade', header: 'Validade', mobilePriority: 3, render: (p) => {
                      if (!p.proxima_validade) return <span className="text-muted-foreground/50 text-sm">-</span>;
                      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
                      const dataVenc = new Date(p.proxima_validade); dataVenc.setHours(0, 0, 0, 0);
                      const diasRestantes = differenceInDays(dataVenc, hoje);
                      const statusValidade = isBefore(dataVenc, hoje) ? 'vencido' : diasRestantes <= 3 ? 'proximo' : 'ok';
                      return (
                        <div className="flex items-center gap-1.5">
                          <Clock className={`h-3.5 w-3.5 ${statusValidade === 'vencido' ? 'text-destructive' : statusValidade === 'proximo' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                          <span className={`text-sm whitespace-nowrap ${statusValidade === 'vencido' ? 'text-destructive font-medium' : statusValidade === 'proximo' ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                            {format(new Date(p.proxima_validade), 'dd/MM/yy', { locale: ptBR })}
                            {statusValidade === 'vencido' && ' (vencido)'}
                            {statusValidade === 'proximo' && diasRestantes === 0 && ' (hoje)'}
                            {statusValidade === 'proximo' && diasRestantes > 0 && ` (${diasRestantes}d)`}
                          </span>
                        </div>
                      );
                    }},
                    { key: 'preco', header: 'Preço', align: 'right', mobilePriority: 5, render: (p) => <span className="text-muted-foreground">R$ {Number(p.preco_venda).toFixed(2)}</span> },
                    { key: 'status', header: 'Status', align: 'center', mobilePriority: 6, render: (p) => {
                      const estoque = Number(p.estoque_acabado);
                      return estoque > 0 ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">Em estoque</Badge>
                      ) : (
                        <Badge variant="secondary">Sem estoque</Badge>
                      );
                    }},
                  ]}
                  renderMobileHeader={(p) => p.nome}
                  renderMobileSubtitle={(p) => p.categoria || 'Sem categoria'}
                  renderMobileHighlight={(p) => {
                    const estoque = Number(p.estoque_acabado);
                    return <span className={estoque === 0 ? 'text-muted-foreground' : 'font-semibold text-green-600'}>{estoque} un</span>;
                  }}
                  emptyMessage={buscaProduto ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
                />
              ) : (
                <div className="p-12 text-center">
                  <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {buscaProduto ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
                  </h3>
                  <p className="text-muted-foreground">
                    {buscaProduto ? 'Tente outra busca' : 'Registre produções para alimentar o estoque acabado'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Movimentações */}
        <TabsContent value="movimentacoes" className="mt-6 space-y-4">
          {/* Filtros compactos para mobile */}
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Filtros</CardTitle>
                </div>
                {temFiltrosAtivos && (
                  <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-8 px-2">
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="py-2 px-4">
              {/* Mobile: 2x2 grid, Desktop: 4 columns */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Período</Label>
                  <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mes">Este mês</SelectItem>
                      <SelectItem value="mesPassado">Mês passado</SelectItem>
                      <SelectItem value="ultimos3meses">Últ. 3 meses</SelectItem>
                      <SelectItem value="todos">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Insumo</Label>
                  <Select value={filtroInsumo} onValueChange={setFiltroInsumo}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {insumos?.map((insumo) => (
                        <SelectItem key={insumo.id} value={insumo.id}>
                          <span className="flex items-center gap-2 truncate">
                            <InsumoIcon nome={insumo.nome} className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{insumo.nome}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Origem</Label>
                  <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todas" />
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
                <MobileDataView
                  data={movimentosFiltrados}
                  keyExtractor={(mov) => mov.id}
                  columns={[
                    { key: 'data', header: 'Data', mobilePriority: 3, render: (m) => (
                      <span className="text-muted-foreground whitespace-nowrap">{format(new Date(m.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                    )},
                    { key: 'insumo', header: 'Insumo', mobilePriority: 1, render: (m) => <span className="font-medium">{m.insumos?.nome}</span> },
                    { key: 'tipo', header: 'Tipo', align: 'center', mobilePriority: 2, render: (m) => m.tipo === 'entrada' ? (
                      <Badge variant="outline" className="text-green-600 border-green-600"><ArrowUp className="h-3 w-3 mr-1" />Entrada</Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 border-red-600"><ArrowDown className="h-3 w-3 mr-1" />Saída</Badge>
                    )},
                    { key: 'quantidade', header: 'Quantidade', align: 'right', mobilePriority: 4, render: (m) => (
                      <span className="whitespace-nowrap">{Number(m.quantidade).toFixed(2)} {m.insumos?.unidade_medida}</span>
                    )},
                    { key: 'origem', header: 'Origem', mobilePriority: 5, render: (m) => <Badge variant="secondary">{m.origem}</Badge> },
                    { key: 'obs', header: 'Observação', mobilePriority: 6, render: (m) => <span className="text-muted-foreground">{m.observacao || '-'}</span> },
                  ]}
                  renderMobileHeader={(m) => m.insumos?.nome}
                  renderMobileSubtitle={(m) => format(new Date(m.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  renderMobileHighlight={(m) => m.tipo === 'entrada' ? (
                    <Badge variant="outline" className="text-green-600 border-green-600"><ArrowUp className="h-3 w-3 mr-1" />+{Number(m.quantidade).toFixed(2)}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-600 border-red-600"><ArrowDown className="h-3 w-3 mr-1" />-{Number(m.quantidade).toFixed(2)}</Badge>
                  )}
                  emptyMessage={temFiltrosAtivos ? 'Nenhuma movimentação encontrada. Tente ajustar os filtros.' : 'Nenhuma movimentação registrada.'}
                  emptyAction={!temFiltrosAtivos ? (
                    <Button onClick={() => setDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Nova Movimentação
                    </Button>
                  ) : undefined}
                />
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

      <ImplantacaoSaldoDialog
        open={implantacaoOpen}
        onOpenChange={setImplantacaoOpen}
      />
    </div>
  );
};

export default Estoque;
