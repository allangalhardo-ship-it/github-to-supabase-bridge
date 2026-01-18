import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  CheckCircle2, 
  Calculator,
  Percent,
  Search,
  History,
  ArrowRight,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  categoria: string | null;
  imagem_url: string | null;
  fichas_tecnicas?: {
    id: string;
    quantidade: number;
    insumos: {
      id: string;
      nome: string;
      custo_unitario: number;
      unidade_medida: string;
    };
  }[];
}

interface Config {
  margem_desejada_padrao: number;
  cmv_alvo: number;
}

interface HistoricoPreco {
  id: string;
  produto_id: string;
  preco_anterior: number | null;
  preco_novo: number;
  variacao_percentual: number | null;
  origem: string;
  observacao: string | null;
  created_at: string;
  produtos?: {
    nome: string;
  };
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const Precificacao = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [produtoSimulador, setProdutoSimulador] = useState<Produto | null>(null);
  const [markupSimulado, setMarkupSimulado] = useState<number>(100);
  const [precosEditados, setPrecosEditados] = useState<Record<string, string>>({});
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [produtoHistoricoId, setProdutoHistoricoId] = useState<string | null>(null);

  // Buscar produtos com ficha técnica
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ['produtos-precificacao', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select(`
          id,
          nome,
          preco_venda,
          categoria,
          imagem_url,
          fichas_tecnicas (
            id,
            quantidade,
            insumos (
              id,
              nome,
              custo_unitario,
              unidade_medida
            )
          )
        `)
        .eq('empresa_id', usuario?.empresa_id)
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data as Produto[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar configurações
  const { data: config } = useQuery({
    queryKey: ['config', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('margem_desejada_padrao, cmv_alvo')
        .eq('empresa_id', usuario?.empresa_id)
        .single();
      
      if (error) throw error;
      return data as Config;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar histórico geral (últimas 50 alterações)
  const { data: historicoGeral } = useQuery({
    queryKey: ['historico-precos-produtos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historico_precos_produtos')
        .select(`
          id,
          produto_id,
          preco_anterior,
          preco_novo,
          variacao_percentual,
          origem,
          observacao,
          created_at,
          produtos (nome)
        `)
        .eq('empresa_id', usuario?.empresa_id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as HistoricoPreco[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar histórico de um produto específico
  const { data: historicoProduto } = useQuery({
    queryKey: ['historico-precos-produto', produtoHistoricoId],
    queryFn: async () => {
      if (!produtoHistoricoId) return [];
      const { data, error } = await supabase
        .from('historico_precos_produtos')
        .select('*')
        .eq('produto_id', produtoHistoricoId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data as HistoricoPreco[];
    },
    enabled: !!produtoHistoricoId,
  });

  // Mutation para atualizar preço (com histórico)
  const updatePrecoMutation = useMutation({
    mutationFn: async ({ produtoId, novoPreco, precoAnterior }: { produtoId: string; novoPreco: number; precoAnterior: number }) => {
      // Atualizar o preço do produto
      const { error: updateError } = await supabase
        .from('produtos')
        .update({ preco_venda: novoPreco })
        .eq('id', produtoId);
      
      if (updateError) throw updateError;

      // Calcular variação percentual
      const variacao = precoAnterior > 0 
        ? ((novoPreco - precoAnterior) / precoAnterior) * 100 
        : null;

      // Registrar no histórico
      const { error: historicoError } = await supabase
        .from('historico_precos_produtos')
        .insert({
          empresa_id: usuario?.empresa_id,
          produto_id: produtoId,
          preco_anterior: precoAnterior,
          preco_novo: novoPreco,
          variacao_percentual: variacao,
          origem: 'precificacao',
        });
      
      if (historicoError) throw historicoError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos-precificacao'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['historico-precos-produtos'] });
      queryClient.invalidateQueries({ queryKey: ['historico-precos-produto'] });
      toast({
        title: 'Preço atualizado',
        description: 'O preço de venda foi atualizado com sucesso.',
      });
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o preço.',
        variant: 'destructive',
      });
    },
  });

  const markupAlvo = config?.margem_desejada_padrao ?? 100;

  // Separar produtos com e sem ficha técnica
  const { produtosComFicha, produtosSemFicha } = useMemo(() => {
    if (!produtos) return { produtosComFicha: [], produtosSemFicha: [] };
    
    return {
      produtosComFicha: produtos.filter(p => p.fichas_tecnicas && p.fichas_tecnicas.length > 0),
      produtosSemFicha: produtos.filter(p => !p.fichas_tecnicas || p.fichas_tecnicas.length === 0),
    };
  }, [produtos]);

  // Calcular custo e métricas de cada produto
  const produtosComMetricas = useMemo(() => {
    return produtosComFicha.map(produto => {
      const custoInsumos = produto.fichas_tecnicas?.reduce((acc, ft) => {
        return acc + (ft.quantidade * ft.insumos.custo_unitario);
      }, 0) || 0;
      
      const precoVenda = produto.preco_venda || 0;
      const lucro = precoVenda - custoInsumos;
      const markupAtual = custoInsumos > 0 ? ((precoVenda - custoInsumos) / custoInsumos) * 100 : 0;
      const precoSugerido = custoInsumos * (1 + markupAlvo / 100);
      const diferencaPreco = precoVenda - precoSugerido;
      
      return {
        ...produto,
        custoInsumos,
        lucro,
        markupAtual,
        precoSugerido,
        diferencaPreco,
        statusPreco: diferencaPreco < -0.01 ? 'abaixo' : diferencaPreco > 0.01 ? 'acima' : 'ideal',
      };
    });
  }, [produtosComFicha, markupAlvo]);

  // Métricas gerais
  const metricas = useMemo(() => {
    if (produtosComMetricas.length === 0) {
      return { markupMedio: 0, produtosAbaixo: 0, produtosAcima: 0, produtosIdeais: 0 };
    }
    
    const markupMedio = produtosComMetricas.reduce((acc, p) => acc + p.markupAtual, 0) / produtosComMetricas.length;
    const produtosAbaixo = produtosComMetricas.filter(p => p.statusPreco === 'abaixo').length;
    const produtosAcima = produtosComMetricas.filter(p => p.statusPreco === 'acima').length;
    const produtosIdeais = produtosComMetricas.filter(p => p.statusPreco === 'ideal').length;
    
    return { markupMedio, produtosAbaixo, produtosAcima, produtosIdeais };
  }, [produtosComMetricas]);

  // Categorias únicas
  const categorias = useMemo(() => {
    const cats = new Set(produtosComMetricas.map(p => p.categoria).filter(Boolean));
    return Array.from(cats) as string[];
  }, [produtosComMetricas]);

  // Filtrar produtos
  const produtosFiltrados = useMemo(() => {
    return produtosComMetricas.filter(produto => {
      const matchCategoria = filtroCategoria === 'todas' || produto.categoria === filtroCategoria;
      const matchStatus = filtroStatus === 'todos' || produto.statusPreco === filtroStatus;
      const matchBusca = produto.nome.toLowerCase().includes(busca.toLowerCase());
      return matchCategoria && matchStatus && matchBusca;
    });
  }, [produtosComMetricas, filtroCategoria, filtroStatus, busca]);

  // Cálculos do simulador
  const simuladorCalcs = useMemo(() => {
    if (!produtoSimulador) return null;
    
    const custoInsumos = produtoSimulador.fichas_tecnicas?.reduce((acc, ft) => {
      return acc + (ft.quantidade * ft.insumos.custo_unitario);
    }, 0) || 0;
    
    const novoPreco = custoInsumos * (1 + markupSimulado / 100);
    const lucroUnitario = novoPreco - custoInsumos;
    const cmv = novoPreco > 0 ? (custoInsumos / novoPreco) * 100 : 0;
    
    return { custoInsumos, novoPreco, lucroUnitario, cmv };
  }, [produtoSimulador, markupSimulado]);

  const handleAplicarPreco = (produtoId: string, novoPreco: number, precoAnterior: number) => {
    updatePrecoMutation.mutate({ produtoId, novoPreco, precoAnterior });
    setPrecosEditados(prev => {
      const next = { ...prev };
      delete next[produtoId];
      return next;
    });
  };

  const handleAplicarDoSimulador = () => {
    if (produtoSimulador && simuladorCalcs) {
      handleAplicarPreco(produtoSimulador.id, simuladorCalcs.novoPreco, produtoSimulador.preco_venda);
      setProdutoSimulador(null);
    }
  };

  const handleVerHistorico = (produtoId: string) => {
    setProdutoHistoricoId(produtoId);
    setHistoricoDialogOpen(true);
  };

  const produtoHistoricoNome = useMemo(() => {
    if (!produtoHistoricoId || !produtos) return '';
    const produto = produtos.find(p => p.id === produtoHistoricoId);
    return produto?.nome || '';
  }, [produtoHistoricoId, produtos]);

  if (loadingProdutos) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Precificação</h1>
          <p className="text-muted-foreground">
            Gerencie os preços dos seus produtos com base no markup desejado de {markupAlvo}%
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <History className="h-4 w-4" />
              Ver Histórico
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Alterações de Preço
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              {!historicoGeral || historicoGeral.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma alteração de preço registrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historicoGeral.map(h => (
                    <div key={h.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{h.produtos?.nome}</p>
                          <div className="flex items-center gap-2 text-sm mt-1">
                            <span className="text-muted-foreground">
                              {h.preco_anterior ? formatCurrency(h.preco_anterior) : 'Sem preço'}
                            </span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{formatCurrency(h.preco_novo)}</span>
                            {h.variacao_percentual !== null && (
                              <Badge 
                                variant={h.variacao_percentual >= 0 ? 'default' : 'destructive'}
                                className={h.variacao_percentual >= 0 ? 'bg-success text-success-foreground' : ''}
                              >
                                {h.variacao_percentual >= 0 ? '+' : ''}{h.variacao_percentual.toFixed(1)}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(h.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dialog de histórico de produto específico */}
      <Dialog open={historicoDialogOpen} onOpenChange={setHistoricoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico: {produtoHistoricoNome}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            {!historicoProduto || historicoProduto.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma alteração registrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historicoProduto.map((h, index) => (
                  <div key={h.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">
                        {h.preco_anterior ? formatCurrency(h.preco_anterior) : '—'}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{formatCurrency(h.preco_novo)}</span>
                      {h.variacao_percentual !== null && (
                        <Badge 
                          variant={h.variacao_percentual >= 0 ? 'default' : 'destructive'}
                          className={h.variacao_percentual >= 0 ? 'bg-success text-success-foreground' : ''}
                        >
                          {h.variacao_percentual >= 0 ? '+' : ''}{h.variacao_percentual.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(h.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Alerta para produtos sem ficha técnica */}
      {produtosSemFicha.length > 0 && (
        <Alert variant="default" className="border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Produtos sem ficha técnica</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              {produtosSemFicha.length} produto(s) não aparecem aqui pois não têm ficha técnica configurada.
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/produtos">Configurar →</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10">
                <Percent className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Markup Médio</p>
                <p className="text-xl font-bold">{metricas.markupMedio.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-destructive/10">
                <TrendingDown className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Abaixo do Ideal</p>
                <p className="text-xl font-bold text-destructive">{metricas.produtosAbaixo}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Preço Ideal</p>
                <p className="text-xl font-bold text-success">{metricas.produtosIdeais}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-blue-500/10">
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Acima do Ideal</p>
                <p className="text-xl font-bold text-blue-500">{metricas.produtosAcima}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabela de Produtos */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    {categorias.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="abaixo">Abaixo do ideal</SelectItem>
                    <SelectItem value="ideal">Preço ideal</SelectItem>
                    <SelectItem value="acima">Acima do ideal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Produtos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Produtos ({produtosFiltrados.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {produtosFiltrados.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum produto encontrado</p>
                  </div>
                ) : (
                  produtosFiltrados.map(produto => {
                    const precoEditado = precosEditados[produto.id];
                    
                    return (
                      <div key={produto.id} className="p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          {/* Info do produto */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium truncate">{produto.nome}</h3>
                              <Badge 
                                variant={
                                  produto.statusPreco === 'abaixo' ? 'destructive' : 
                                  produto.statusPreco === 'acima' ? 'default' : 
                                  'secondary'
                                }
                                className={
                                  produto.statusPreco === 'ideal' ? 'bg-success text-success-foreground' : ''
                                }
                              >
                                {produto.statusPreco === 'abaixo' && '↓ Abaixo'}
                                {produto.statusPreco === 'acima' && '↑ Acima'}
                                {produto.statusPreco === 'ideal' && '✓ Ideal'}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                              <span>Custo: {formatCurrency(produto.custoInsumos)}</span>
                              <span>Markup: {produto.markupAtual.toFixed(0)}%</span>
                              <span>Sugerido: {formatCurrency(produto.precoSugerido)}</span>
                            </div>
                          </div>

                          {/* Preço e ações */}
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                step="0.01"
                                value={precoEditado ?? produto.preco_venda.toFixed(2)}
                                onChange={(e) => setPrecosEditados(prev => ({ ...prev, [produto.id]: e.target.value }))}
                                className="w-28 pl-7 text-right"
                              />
                            </div>
                            
                            {precoEditado !== undefined && parseFloat(precoEditado) !== produto.preco_venda && (
                              <Button 
                                size="sm"
                                onClick={() => handleAplicarPreco(produto.id, parseFloat(precoEditado), produto.preco_venda)}
                                disabled={updatePrecoMutation.isPending}
                              >
                                Salvar
                              </Button>
                            )}
                            
                            {produto.statusPreco === 'abaixo' && precoEditado === undefined && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleAplicarPreco(produto.id, produto.precoSugerido, produto.preco_venda)}
                                disabled={updatePrecoMutation.isPending}
                              >
                                Aplicar sugerido
                              </Button>
                            )}
                            
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleVerHistorico(produto.id)}
                              title="Ver histórico de preços"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setProdutoSimulador(produto);
                                setMarkupSimulado(produto.markupAtual);
                              }}
                              title="Abrir simulador"
                            >
                              <Calculator className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Simulador de Preço */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Simulador de Preço
              </CardTitle>
              <CardDescription>
                Selecione um produto e ajuste o markup para simular o preço
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!produtoSimulador ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Clique no ícone <Calculator className="inline h-4 w-4" /> em um produto para simular</p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium">{produtoSimulador.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      Custo: {formatCurrency(simuladorCalcs?.custoInsumos || 0)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Markup desejado</span>
                      <span className="font-medium">{markupSimulado.toFixed(0)}%</span>
                    </div>
                    <Slider
                      value={[markupSimulado]}
                      onValueChange={([value]) => setMarkupSimulado(value)}
                      min={0}
                      max={300}
                      step={5}
                      className="py-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>150%</span>
                      <span>300%</span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                      <span className="text-sm font-medium">Novo Preço</span>
                      <span className="text-xl font-bold text-primary">
                        {formatCurrency(simuladorCalcs?.novoPreco || 0)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-muted rounded">
                        <p className="text-muted-foreground">Lucro/un</p>
                        <p className="font-medium text-success">
                          {formatCurrency(simuladorCalcs?.lucroUnitario || 0)}
                        </p>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <p className="text-muted-foreground">CMV</p>
                        <p className="font-medium">
                          {simuladorCalcs?.cmv.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1"
                        onClick={handleAplicarDoSimulador}
                        disabled={updatePrecoMutation.isPending}
                      >
                        Aplicar Preço
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setProdutoSimulador(null)}
                      >
                        Fechar
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Dica */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <h4 className="font-medium text-sm mb-2">💡 Dica</h4>
              <p className="text-xs text-muted-foreground">
                O <strong>markup de {markupAlvo}%</strong> está configurado nas suas configurações. 
                Produtos com preço abaixo do sugerido aparecem em vermelho.
              </p>
              <Button variant="link" size="sm" className="px-0 mt-1" asChild>
                <Link to="/configuracoes">Alterar markup padrão →</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Precificacao;
