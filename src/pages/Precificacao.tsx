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
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  Clock,
  Info,
  PieChart,
  Building2,
  Receipt,
  Smartphone,
  Store,
  HelpCircle,
  ChevronRight
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
  faturamento_mensal: number;
  imposto_medio_sobre_vendas: number;
}

interface CustoFixo {
  id: string;
  nome: string;
  valor_mensal: number;
}

interface TaxaApp {
  id: string;
  nome_app: string;
  taxa_percentual: number;
  ativo: boolean;
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

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const Precificacao = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [produtoSimulador, setProdutoSimulador] = useState<Produto | null>(null);
  const [margemDesejada, setMargemDesejada] = useState<number>(30);
  const [appSelecionado, setAppSelecionado] = useState<string>('balcao');
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

  // Buscar configurações completas
  const { data: config } = useQuery({
    queryKey: ['config-precificacao', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('margem_desejada_padrao, cmv_alvo, faturamento_mensal, imposto_medio_sobre_vendas')
        .eq('empresa_id', usuario?.empresa_id)
        .single();
      
      if (error) throw error;
      return data as Config;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar custos fixos
  const { data: custosFixos } = useQuery({
    queryKey: ['custos-fixos-precificacao', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custos_fixos')
        .select('id, nome, valor_mensal')
        .eq('empresa_id', usuario?.empresa_id);
      
      if (error) throw error;
      return data as CustoFixo[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar taxas de apps
  const { data: taxasApps } = useQuery({
    queryKey: ['taxas-apps-precificacao', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taxas_apps')
        .select('id, nome_app, taxa_percentual, ativo')
        .eq('empresa_id', usuario?.empresa_id)
        .eq('ativo', true);
      
      if (error) throw error;
      return data as TaxaApp[];
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
      const { error: updateError } = await supabase
        .from('produtos')
        .update({ preco_venda: novoPreco })
        .eq('id', produtoId);
      
      if (updateError) throw updateError;

      const variacao = precoAnterior > 0 
        ? ((novoPreco - precoAnterior) / precoAnterior) * 100 
        : null;

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

  // Calcular percentuais de custos
  const custosPercentuais = useMemo(() => {
    const faturamento = config?.faturamento_mensal || 0;
    const totalCustosFixos = custosFixos?.reduce((acc, cf) => acc + cf.valor_mensal, 0) || 0;
    
    const percCustoFixo = faturamento > 0 ? (totalCustosFixos / faturamento) * 100 : 0;
    const percImposto = config?.imposto_medio_sobre_vendas || 0;
    const margemDesejadaPadrao = config?.margem_desejada_padrao || 30;
    
    return {
      percCustoFixo,
      percImposto,
      margemDesejadaPadrao,
      totalCustosFixos,
      faturamento,
    };
  }, [config, custosFixos]);

  // Inicializar margem desejada quando config carregar
  React.useEffect(() => {
    if (config?.margem_desejada_padrao) {
      setMargemDesejada(config.margem_desejada_padrao);
    }
  }, [config?.margem_desejada_padrao]);

  // Função para calcular preço sugerido baseado na margem líquida desejada
  const calcularPrecoSugerido = (custoInsumos: number, taxaApp: number = 0) => {
    const { percCustoFixo, percImposto, margemDesejadaPadrao } = custosPercentuais;
    
    const margem = margemDesejadaPadrao / 100;
    const imposto = percImposto / 100;
    const custoFixo = percCustoFixo / 100;
    const taxa = taxaApp / 100;
    
    const divisor = 1 - margem - imposto - custoFixo - taxa;
    
    if (divisor <= 0) {
      return { preco: custoInsumos * 3, viavel: false };
    }
    
    return { preco: custoInsumos / divisor, viavel: true };
  };

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
      const precoBalcao = calcularPrecoSugerido(custoInsumos, 0);
      
      // Preços por app
      const precosApps = taxasApps?.map(app => ({
        ...app,
        ...calcularPrecoSugerido(custoInsumos, app.taxa_percentual)
      })) || [];
      
      // Calcular margem líquida atual (sem taxa de app)
      const { percCustoFixo, percImposto } = custosPercentuais;
      const custoFixoValor = precoVenda * (percCustoFixo / 100);
      const impostoValor = precoVenda * (percImposto / 100);
      const lucroLiquido = precoVenda - custoInsumos - custoFixoValor - impostoValor;
      const margemLiquida = precoVenda > 0 ? (lucroLiquido / precoVenda) * 100 : 0;
      
      const diferencaPreco = precoVenda - precoBalcao.preco;
      
      return {
        ...produto,
        custoInsumos,
        lucroLiquido,
        margemLiquida,
        precoBalcao: precoBalcao.preco,
        precosApps,
        diferencaPreco,
        statusPreco: diferencaPreco < -0.01 ? 'abaixo' : diferencaPreco > 0.01 ? 'acima' : 'ideal',
      };
    });
  }, [produtosComFicha, custosPercentuais, taxasApps]);

  // Métricas gerais
  const metricas = useMemo(() => {
    if (produtosComMetricas.length === 0) {
      return { margemMedia: 0, produtosAbaixo: 0, produtosAcima: 0, produtosIdeais: 0 };
    }
    
    const margemMedia = produtosComMetricas.reduce((acc, p) => acc + p.margemLiquida, 0) / produtosComMetricas.length;
    const produtosAbaixo = produtosComMetricas.filter(p => p.statusPreco === 'abaixo').length;
    const produtosAcima = produtosComMetricas.filter(p => p.statusPreco === 'acima').length;
    const produtosIdeais = produtosComMetricas.filter(p => p.statusPreco === 'ideal').length;
    
    return { margemMedia, produtosAbaixo, produtosAcima, produtosIdeais };
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

  // Cálculos do simulador com decomposição completa
  const simuladorCalcs = useMemo(() => {
    if (!produtoSimulador) return null;
    
    const custoInsumos = produtoSimulador.fichas_tecnicas?.reduce((acc, ft) => {
      return acc + (ft.quantidade * ft.insumos.custo_unitario);
    }, 0) || 0;
    
    const { percCustoFixo, percImposto } = custosPercentuais;
    
    // Taxa do app selecionado
    const taxaAppAtual = appSelecionado === 'balcao' 
      ? 0 
      : (taxasApps?.find(a => a.id === appSelecionado)?.taxa_percentual || 0);
    
    // Calcular preço baseado na margem desejada
    const margem = margemDesejada / 100;
    const imposto = percImposto / 100;
    const custoFixo = percCustoFixo / 100;
    const taxaApp = taxaAppAtual / 100;
    
    const divisor = 1 - margem - imposto - custoFixo - taxaApp;
    const novoPreco = divisor > 0 ? custoInsumos / divisor : custoInsumos * 3;
    
    // Decomposição do preço
    const valorImposto = novoPreco * imposto;
    const valorCustoFixo = novoPreco * custoFixo;
    const valorTaxaApp = novoPreco * taxaApp;
    const lucroLiquido = novoPreco - custoInsumos - valorImposto - valorCustoFixo - valorTaxaApp;
    
    // CMV
    const cmv = novoPreco > 0 ? (custoInsumos / novoPreco) * 100 : 0;
    
    const isViavel = divisor > 0 && lucroLiquido > 0;
    
    // Calcular preços para todos os canais
    const precoBalcao = calcularPrecoSugerido(custoInsumos, 0);
    const precosCanais = [
      { nome: 'Balcão/Próprio', taxa: 0, ...precoBalcao },
      ...(taxasApps?.map(app => ({
        nome: app.nome_app,
        taxa: app.taxa_percentual,
        ...calcularPrecoSugerido(custoInsumos, app.taxa_percentual)
      })) || [])
    ];
    
    return { 
      custoInsumos, 
      novoPreco, 
      valorImposto,
      valorCustoFixo,
      valorTaxaApp,
      lucroLiquido, 
      cmv,
      isViavel,
      percImposto,
      percCustoFixo,
      percTaxaApp: taxaAppAtual,
      precosCanais,
    };
  }, [produtoSimulador, margemDesejada, appSelecionado, custosPercentuais, taxasApps]);

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
          <h1 className="text-2xl font-bold text-foreground">Precificação Inteligente</h1>
          <p className="text-muted-foreground">
            Preços calculados para garantir sua margem de lucro
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
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
                {historicoProduto.map(h => (
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

      {/* Card Explicativo - Fórmula de Precificação */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Como calculamos o preço ideal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-background/80 rounded-lg p-4 mb-4">
            <p className="text-center font-mono text-sm mb-2">
              <span className="font-bold text-primary">Preço de Venda</span> = Custo dos Insumos ÷ (1 - Margem - Impostos - Custo Fixo - Taxa App)
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <TooltipProvider>
              <div className="bg-background rounded-lg p-3 text-center">
                <Tooltip>
                  <TooltipTrigger className="w-full">
                    <Package className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                    <p className="text-xs text-muted-foreground">Insumos (CMV)</p>
                    <p className="font-semibold text-sm">Custo direto</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Custo dos ingredientes/materiais do produto</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <div className="bg-background rounded-lg p-3 text-center">
                <Tooltip>
                  <TooltipTrigger className="w-full">
                    <Percent className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
                    <p className="text-xs text-muted-foreground">Margem Desejada</p>
                    <p className="font-semibold text-sm">{formatPercent(custosPercentuais.margemDesejadaPadrao)}</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Lucro líquido desejado sobre o preço de venda</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <div className="bg-background rounded-lg p-3 text-center">
                <Tooltip>
                  <TooltipTrigger className="w-full">
                    <Building2 className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-xs text-muted-foreground">Custos Fixos</p>
                    <p className="font-semibold text-sm">{formatPercent(custosPercentuais.percCustoFixo)}</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Aluguel, salários, contas - rateados pelo faturamento</p>
                    <p className="text-xs opacity-70">Total: {formatCurrency(custosPercentuais.totalCustosFixos)}/mês</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <div className="bg-background rounded-lg p-3 text-center">
                <Tooltip>
                  <TooltipTrigger className="w-full">
                    <Receipt className="h-5 w-5 mx-auto mb-1 text-red-500" />
                    <p className="text-xs text-muted-foreground">Impostos</p>
                    <p className="font-semibold text-sm">{formatPercent(custosPercentuais.percImposto)}</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Imposto médio sobre vendas (Simples, etc)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <div className="bg-background rounded-lg p-3 text-center">
                <Tooltip>
                  <TooltipTrigger className="w-full">
                    <Smartphone className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                    <p className="text-xs text-muted-foreground">Taxa de Apps</p>
                    <p className="font-semibold text-sm">Variável</p>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>iFood, Rappi, etc - cada app tem sua taxa</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
          
          {custosPercentuais.faturamento === 0 && (
            <Alert variant="default" className="mt-4 border-warning bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
                Configure seu faturamento mensal em <Link to="/configuracoes" className="underline font-medium">Configurações</Link> para calcular o % de custo fixo.
              </AlertDescription>
            </Alert>
          )}
          
          {(!taxasApps || taxasApps.length === 0) && (
            <Alert variant="default" className="mt-4 border-muted">
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                Cadastre seus apps de delivery em <Link to="/configuracoes" className="underline font-medium">Configurações</Link> para ver preços sugeridos por plataforma.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

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
                <p className="text-xs text-muted-foreground">Margem Líq. Média</p>
                <p className="text-xl font-bold">{metricas.margemMedia.toFixed(1)}%</p>
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
        {/* Lista de Produtos */}
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
              <CardDescription>
                Clique em um produto para ver preços sugeridos por canal
              </CardDescription>
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
                    const isSelected = produtoSimulador?.id === produto.id;
                    
                    return (
                      <div 
                        key={produto.id} 
                        className={`p-4 transition-colors cursor-pointer ${
                          isSelected 
                            ? 'bg-primary/10 border-l-4 border-l-primary' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => {
                          setProdutoSimulador(produto);
                          setMargemDesejada(custosPercentuais.margemDesejadaPadrao);
                          setAppSelecionado('balcao');
                        }}
                      >
                        <div className="flex flex-col gap-3">
                          {/* Linha 1: Nome e Status */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium">{produto.nome}</h3>
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
                            </div>
                            <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                          </div>
                          
                          {/* Linha 2: Métricas */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                            <div className="bg-muted/50 rounded px-2 py-1">
                              <p className="text-xs text-muted-foreground">Custo</p>
                              <p className="font-medium">{formatCurrency(produto.custoInsumos)}</p>
                            </div>
                            <div className="bg-muted/50 rounded px-2 py-1">
                              <p className="text-xs text-muted-foreground">Preço Atual</p>
                              <p className="font-medium">{formatCurrency(produto.preco_venda)}</p>
                            </div>
                            <div className="bg-muted/50 rounded px-2 py-1">
                              <p className="text-xs text-muted-foreground">Margem Atual</p>
                              <p className={`font-medium ${produto.margemLiquida >= custosPercentuais.margemDesejadaPadrao ? 'text-success' : 'text-destructive'}`}>
                                {formatPercent(produto.margemLiquida)}
                              </p>
                            </div>
                            <div className="bg-primary/10 rounded px-2 py-1">
                              <p className="text-xs text-muted-foreground">Sugerido (Balcão)</p>
                              <p className="font-semibold text-primary">{formatCurrency(produto.precoBalcao)}</p>
                            </div>
                          </div>
                          
                          {/* Linha 3: Preços por App (se houver) */}
                          {produto.precosApps.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {produto.precosApps.map(app => (
                                <div key={app.id} className="inline-flex items-center gap-1.5 bg-purple-500/10 text-purple-700 dark:text-purple-300 rounded-full px-3 py-1 text-xs">
                                  <Smartphone className="h-3 w-3" />
                                  <span className="font-medium">{app.nome_app}:</span>
                                  <span>{formatCurrency(app.preco)}</span>
                                  <span className="opacity-60">({formatPercent(app.taxa_percentual)})</span>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Ações rápidas */}
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <div className="relative flex-1">
                              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="number"
                                step="0.01"
                                value={precoEditado ?? produto.preco_venda.toFixed(2)}
                                onChange={(e) => setPrecosEditados(prev => ({ ...prev, [produto.id]: e.target.value }))}
                                className="pl-7 text-right"
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
                                variant="secondary"
                                onClick={() => handleAplicarPreco(produto.id, produto.precoBalcao, produto.preco_venda)}
                                disabled={updatePrecoMutation.isPending}
                              >
                                Aplicar sugerido
                              </Button>
                            )}
                            
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleVerHistorico(produto.id)}
                              title="Ver histórico de preços"
                            >
                              <History className="h-4 w-4" />
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
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Simulador de Preço
              </CardTitle>
              <CardDescription>
                Simule diferentes margens e canais de venda
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!produtoSimulador ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Selecione um produto da lista para simular</p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <p className="font-medium">{produtoSimulador.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      Custo: {formatCurrency(simuladorCalcs?.custoInsumos || 0)}
                    </p>
                  </div>

                  {/* Seletor de Canal */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Canal de Venda</Label>
                    <Tabs value={appSelecionado} onValueChange={setAppSelecionado} className="w-full">
                      <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
                        <TabsTrigger value="balcao" className="flex-1 min-w-[80px] gap-1 text-xs">
                          <Store className="h-3 w-3" />
                          Balcão
                        </TabsTrigger>
                        {taxasApps?.map(app => (
                          <TabsTrigger 
                            key={app.id} 
                            value={app.id}
                            className="flex-1 min-w-[80px] gap-1 text-xs"
                          >
                            <Smartphone className="h-3 w-3" />
                            {app.nome_app}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Slider de margem */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Margem líquida desejada</span>
                      <span className="font-medium text-primary">{margemDesejada.toFixed(0)}%</span>
                    </div>
                    <Slider
                      value={[margemDesejada]}
                      onValueChange={([value]) => setMargemDesejada(value)}
                      min={5}
                      max={60}
                      step={1}
                      className="py-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>5%</span>
                      <span>30%</span>
                      <span>60%</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Decomposição do preço */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-1">
                      <PieChart className="h-4 w-4" />
                      Composição do Preço
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between py-1.5 items-center">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-orange-500" />
                          Custo Insumos
                        </span>
                        <span className="font-medium">{formatCurrency(simuladorCalcs?.custoInsumos || 0)}</span>
                      </div>
                      <div className="flex justify-between py-1.5 items-center">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          Custo Fixo ({formatPercent(simuladorCalcs?.percCustoFixo || 0)})
                        </span>
                        <span>{formatCurrency(simuladorCalcs?.valorCustoFixo || 0)}</span>
                      </div>
                      <div className="flex justify-between py-1.5 items-center">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          Impostos ({formatPercent(simuladorCalcs?.percImposto || 0)})
                        </span>
                        <span>{formatCurrency(simuladorCalcs?.valorImposto || 0)}</span>
                      </div>
                      {simuladorCalcs?.percTaxaApp > 0 && (
                        <div className="flex justify-between py-1.5 items-center">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                            Taxa App ({formatPercent(simuladorCalcs?.percTaxaApp || 0)})
                          </span>
                          <span>{formatCurrency(simuladorCalcs?.valorTaxaApp || 0)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-1.5 items-center border-t pt-2">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          Lucro Líquido ({formatPercent(margemDesejada)})
                        </span>
                        <span className={simuladorCalcs?.lucroLiquido && simuladorCalcs.lucroLiquido > 0 ? 'text-success font-medium' : 'text-destructive font-medium'}>
                          {formatCurrency(simuladorCalcs?.lucroLiquido || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Preço calculado */}
                  <div className="space-y-3">
                    <div className={`flex justify-between items-center p-4 rounded-lg ${simuladorCalcs?.isViavel ? 'bg-primary/10 border border-primary/30' : 'bg-destructive/10 border border-destructive/30'}`}>
                      <div>
                        <p className="text-xs text-muted-foreground">Preço Calculado</p>
                        <p className="text-sm text-muted-foreground">
                          {appSelecionado === 'balcao' ? 'Venda direta' : taxasApps?.find(a => a.id === appSelecionado)?.nome_app}
                        </p>
                      </div>
                      <span className={`text-2xl font-bold ${simuladorCalcs?.isViavel ? 'text-primary' : 'text-destructive'}`}>
                        {formatCurrency(simuladorCalcs?.novoPreco || 0)}
                      </span>
                    </div>

                    {!simuladorCalcs?.isViavel && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Margem inviável! Reduza a margem ou revise custos.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Comparativo de canais */}
                    {simuladorCalcs?.precosCanais && simuladorCalcs.precosCanais.length > 1 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-foreground">Comparativo por Canal</h4>
                        <div className="space-y-1">
                          {simuladorCalcs.precosCanais.map((canal, idx) => (
                            <div 
                              key={idx}
                              className={`flex justify-between items-center p-2 rounded text-sm ${
                                (appSelecionado === 'balcao' && canal.taxa === 0) ||
                                (taxasApps?.find(a => a.id === appSelecionado)?.taxa_percentual === canal.taxa)
                                  ? 'bg-primary/5 border border-primary/20'
                                  : 'bg-muted/50'
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                {canal.taxa === 0 ? <Store className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                                {canal.nome}
                                {canal.taxa > 0 && <span className="text-xs text-muted-foreground">({formatPercent(canal.taxa)})</span>}
                              </span>
                              <span className={`font-medium ${canal.viavel ? '' : 'text-destructive'}`}>
                                {formatCurrency(canal.preco)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="p-2 bg-muted rounded text-center">
                        <p className="text-xs text-muted-foreground">CMV</p>
                        <p className="font-medium">
                          {simuladorCalcs?.cmv.toFixed(1)}%
                        </p>
                      </div>
                      <div className="p-2 bg-muted rounded text-center">
                        <p className="text-xs text-muted-foreground">Preço Atual</p>
                        <p className="font-medium">
                          {formatCurrency(produtoSimulador.preco_venda)}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1"
                        onClick={handleAplicarDoSimulador}
                        disabled={updatePrecoMutation.isPending || !simuladorCalcs?.isViavel}
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
        </div>
      </div>
    </div>
  );
};

export default Precificacao;
