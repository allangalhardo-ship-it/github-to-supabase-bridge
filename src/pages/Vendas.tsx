import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MobileDataView } from '@/components/ui/mobile-data-view';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Package, User, Filter, DollarSign, ShoppingCart } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Cliente {
  id: string;
  nome: string;
  whatsapp: string | null;
}

const Vendas = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Filtros
  const [filtroDataInicio, setFiltroDataInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filtroDataFim, setFiltroDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filtroProduto, setFiltroProduto] = useState<string>('todos');
  const [filtroCanal, setFiltroCanal] = useState<string>('todos');
  const [filtroOrigem, setFiltroOrigem] = useState<string>('todos');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [vendaToDelete, setVendaToDelete] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    produto_id: '',
    quantidade: '1',
    valor_total: '',
    canal: 'balcao',
    data_venda: format(new Date(), 'yyyy-MM-dd'),
    tipo_venda: 'direto' as 'direto' | 'app',
    cliente_id: '',
  });

  // Fetch produtos para o select
  const { data: produtos } = useQuery({
    queryKey: ['produtos-select', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, preco_venda')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch apps de delivery cadastrados
  const { data: taxasApps } = useQuery({
    queryKey: ['taxas_apps', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taxas_apps')
        .select('nome_app')
        .eq('ativo', true)
        .order('nome_app');
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch clientes para vendas diretas
  const { data: clientes } = useQuery({
    queryKey: ['clientes', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, whatsapp')
        .order('nome');
      if (error) throw error;
      return data as Cliente[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Apps de delivery (exclui canais fixos)
  const appsDelivery = taxasApps?.map(t => t.nome_app) || [];

  // Fetch vendas com filtro de data
  const { data: vendas, isLoading } = useQuery({
    queryKey: ['vendas', usuario?.empresa_id, filtroDataInicio, filtroDataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select(`
          *,
          produtos (nome)
        `)
        .gte('data_venda', filtroDataInicio)
        .lte('data_venda', filtroDataFim)
        .order('data_venda', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Filtrar vendas localmente
  const vendasFiltradas = useMemo(() => {
    if (!vendas) return [];
    
    return vendas.filter(venda => {
      if (filtroProduto !== 'todos' && venda.produto_id !== filtroProduto) return false;
      if (filtroCanal !== 'todos' && venda.canal !== filtroCanal) return false;
      if (filtroOrigem !== 'todos' && venda.origem !== filtroOrigem) return false;
      return true;
    });
  }, [vendas, filtroProduto, filtroCanal, filtroOrigem]);

  // Calcular totalizadores
  const totais = useMemo(() => {
    const totalValor = vendasFiltradas.reduce((acc, v) => acc + Number(v.valor_total), 0);
    const totalQuantidade = vendasFiltradas.reduce((acc, v) => acc + Number(v.quantidade), 0);
    const totalVendas = vendasFiltradas.length;
    return { totalValor, totalQuantidade, totalVendas };
  }, [vendasFiltradas]);

  // Extrair canais únicos para o filtro
  const canaisUnicos = useMemo(() => {
    if (!vendas) return [];
    const canais = new Set(vendas.map(v => v.canal).filter(Boolean));
    return Array.from(canais) as string[];
  }, [vendas]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const produto = produtos?.find(p => p.id === data.produto_id);
      const cliente = clientes?.find(c => c.id === data.cliente_id);
      
      // Define canal baseado no tipo de venda
      let canal = data.canal;
      if (data.tipo_venda === 'direto' && cliente) {
        canal = `Cliente: ${cliente.nome}`;
      }

      const { error } = await supabase.from('vendas').insert({
        empresa_id: usuario!.empresa_id,
        produto_id: data.produto_id || null,
        descricao_produto: produto?.nome || null,
        quantidade: parseFloat(data.quantidade) || 1,
        valor_total: parseFloat(data.valor_total) || 0,
        canal: canal,
        data_venda: data.data_venda,
        origem: 'manual',
        tipo_venda: data.tipo_venda,
        cliente_id: data.tipo_venda === 'direto' ? (data.cliente_id || null) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      toast({ title: 'Venda registrada!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao registrar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vendas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      toast({ title: 'Venda excluída!' });
      setDeleteConfirmOpen(false);
      setVendaToDelete(null);
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      produto_id: '',
      quantidade: '1',
      valor_total: '',
      canal: 'balcao',
      data_venda: format(new Date(), 'yyyy-MM-dd'),
      tipo_venda: 'direto',
      cliente_id: '',
    });
    setDialogOpen(false);
  };

  const handleProdutoChange = (produtoId: string) => {
    const produto = produtos?.find(p => p.id === produtoId);
    setFormData({
      ...formData,
      produto_id: produtoId,
      valor_total: produto ? produto.preco_venda.toString() : formData.valor_total,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Vendas</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Registre e acompanhe suas vendas</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Venda
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Venda</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="produto">Produto</Label>
                <SearchableSelect
                  options={produtos?.map((produto) => ({
                    value: produto.id,
                    label: `${produto.nome} - ${formatCurrency(Number(produto.preco_venda))}`,
                    searchTerms: produto.nome,
                    icon: <Package className="h-3 w-3 text-primary" />,
                  })) || []}
                  value={formData.produto_id}
                  onValueChange={handleProdutoChange}
                  placeholder="Buscar produto..."
                  searchPlaceholder="Digite para buscar..."
                  emptyMessage="Nenhum produto encontrado."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="valor_total">Valor Total (R$)</Label>
                  <Input
                    id="valor_total"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.valor_total}
                    onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label>Tipo de Venda</Label>
                <RadioGroup
                  value={formData.tipo_venda}
                  onValueChange={(value: 'direto' | 'app') => 
                    setFormData({ ...formData, tipo_venda: value, canal: value === 'direto' ? 'balcao' : (appsDelivery[0] || 'iFood'), cliente_id: '' })
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="direto" id="direto" />
                    <Label htmlFor="direto" className="font-normal cursor-pointer">Venda Direta</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="app" id="app" />
                    <Label htmlFor="app" className="font-normal cursor-pointer">App de Delivery</Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.tipo_venda === 'direto' ? (
                <div className="space-y-2">
                  <Label htmlFor="cliente">Cliente (opcional)</Label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Sem cliente', searchTerms: 'sem cliente nenhum' },
                      ...(clientes?.map((cliente) => ({
                        value: cliente.id,
                        label: cliente.nome,
                        searchTerms: `${cliente.nome} ${cliente.whatsapp || ''}`,
                        icon: <User className="h-3 w-3 text-muted-foreground" />,
                      })) || []),
                    ]}
                    value={formData.cliente_id}
                    onValueChange={(value) => setFormData({ ...formData, cliente_id: value })}
                    placeholder="Buscar cliente..."
                    searchPlaceholder="Digite para buscar..."
                    emptyMessage="Nenhum cliente encontrado."
                  />
                  <p className="text-xs text-muted-foreground">
                    Vendas de balcão, WhatsApp ou encomendas diretas
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="canal">App de Delivery</Label>
                  <Select
                    value={formData.canal}
                    onValueChange={(value) => setFormData({ ...formData, canal: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o app" />
                    </SelectTrigger>
                    <SelectContent>
                      {appsDelivery.length > 0 ? (
                        appsDelivery.map((app) => (
                          <SelectItem key={app} value={app}>
                            {app}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="iFood">iFood</SelectItem>
                          <SelectItem value="Rappi">Rappi</SelectItem>
                          <SelectItem value="99Food">99Food</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="data_venda">Data</Label>
                <Input
                  id="data_venda"
                  type="date"
                  value={formData.data_venda}
                  onChange={(e) => setFormData({ ...formData, data_venda: e.target.value })}
                  required
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

      <div className="space-y-3 sm:space-y-4">
          {/* Totalizadores - Primeiro no mobile para dar destaque */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex flex-col items-center text-center gap-1">
                  <div className="p-1.5 sm:p-2 rounded-full bg-primary/10">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
                    <p className="text-xs sm:text-lg font-bold text-primary truncate max-w-full">{formatCurrency(totais.totalValor)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex flex-col items-center text-center gap-1">
                  <div className="p-1.5 sm:p-2 rounded-full bg-muted">
                    <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Vendas</p>
                    <p className="text-sm sm:text-lg font-bold">{totais.totalVendas}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex flex-col items-center text-center gap-1">
                  <div className="p-1.5 sm:p-2 rounded-full bg-muted">
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Itens</p>
                    <p className="text-sm sm:text-lg font-bold">{totais.totalQuantidade}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros - Compactos */}
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Filtros</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
                <div>
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">Início</Label>
                  <Input
                    type="date"
                    value={filtroDataInicio}
                    onChange={(e) => setFiltroDataInicio(e.target.value)}
                    className="h-8 sm:h-9 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">Fim</Label>
                  <Input
                    type="date"
                    value={filtroDataFim}
                    onChange={(e) => setFiltroDataFim(e.target.value)}
                    className="h-8 sm:h-9 text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">Produto</Label>
                  <Select value={filtroProduto} onValueChange={setFiltroProduto}>
                    <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {produtos?.map((produto) => (
                        <SelectItem key={produto.id} value={produto.id}>
                          {produto.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">Canal</Label>
                  <Select value={filtroCanal} onValueChange={setFiltroCanal}>
                    <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {canaisUnicos.map((canal) => (
                        <SelectItem key={canal} value={canal}>
                          {canal}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-[10px] sm:text-xs text-muted-foreground">Origem</Label>
                  <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                    <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="importacao">Importação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <Skeleton className="h-96" />
          ) : (
            <MobileDataView
              data={vendasFiltradas}
              columns={[
                {
                  key: 'data',
                  header: 'Data',
                  mobilePriority: 2,
                  render: (venda) => (
                    <span className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm">
                      {format(new Date(venda.data_venda), 'dd/MM/yy', { locale: ptBR })}
                    </span>
                  ),
                },
                {
                  key: 'produto',
                  header: 'Produto',
                  mobilePriority: 1,
                  render: (venda) => (
                    <span className="font-medium truncate block max-w-[120px] sm:max-w-[200px]">
                      {venda.produtos?.nome || venda.descricao_produto || '-'}
                    </span>
                  ),
                },
                {
                  key: 'quantidade',
                  header: 'Qtd',
                  align: 'center',
                  mobilePriority: 4,
                  hideOnMobile: true,
                  render: (venda) => Number(venda.quantidade),
                },
                {
                  key: 'valor',
                  header: 'Valor',
                  align: 'right',
                  mobilePriority: 3,
                  render: (venda) => (
                    <span className="font-medium whitespace-nowrap text-xs sm:text-sm">{formatCurrency(Number(venda.valor_total))}</span>
                  ),
                },
                {
                  key: 'canal',
                  header: 'Canal',
                  mobilePriority: 5,
                  hideOnMobile: true,
                  render: (venda) => (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 truncate max-w-[80px]">
                      {venda.canal}
                    </Badge>
                  ),
                },
                {
                  key: 'origem',
                  header: 'Origem',
                  mobilePriority: 6,
                  hideOnMobile: true,
                  render: (venda) => (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {venda.origem}
                    </Badge>
                  ),
                },
              ]}
              keyExtractor={(venda) => venda.id}
              renderActions={(venda) => (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => {
                    setVendaToDelete(venda.id);
                    setDeleteConfirmOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              renderMobileHeader={(venda) => (
                <span className="truncate block max-w-[150px]">
                  {venda.produtos?.nome || venda.descricao_produto || 'Venda'}
                </span>
              )}
              renderMobileSubtitle={(venda) => (
                <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                  <span className="text-xs whitespace-nowrap">{format(new Date(venda.data_venda), 'dd/MM/yy', { locale: ptBR })}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 truncate max-w-[70px] shrink-0">{venda.canal}</Badge>
                </div>
              )}
              renderMobileHighlight={(venda) => (
                <div className="text-right whitespace-nowrap shrink-0">
                  <p className="font-bold text-foreground text-sm">{formatCurrency(Number(venda.valor_total))}</p>
                  <p className="text-[10px] text-muted-foreground">Qtd: {Number(venda.quantidade)}</p>
                </div>
              )}
              emptyMessage={
                vendas && vendas.length > 0 
                  ? 'Nenhuma venda corresponde aos filtros selecionados.'
                  : 'Registre vendas manualmente ou importe do iFood.'
              }
              emptyAction={
                !vendas || vendas.length === 0 ? (
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Venda
                  </Button>
                ) : undefined
              }
            />
          )}
      </div>

      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={() => vendaToDelete && deleteMutation.mutate(vendaToDelete)}
        title="Excluir venda"
        description="Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default Vendas;
