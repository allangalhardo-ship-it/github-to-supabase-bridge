import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  History, 
  ArrowRight,
  Clock,
  Calculator,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  ConfigChecklist,
  MetricsCards,
  UrgentAttention,
  ProdutosList,
  PriceSimulator,
  Produto,
  ProdutoComMetricas,
  Config,
  CustoFixo,
  TaxaApp,
  HistoricoPreco,
  ChecklistItem,
  formatCurrency,
} from '@/components/precificacao';

const Precificacao = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  const [produtoSimulador, setProdutoSimulador] = useState<ProdutoComMetricas | null>(null);
  const [simuladorOpen, setSimuladorOpen] = useState(false);
  const [margemDesejada, setMargemDesejada] = useState<number>(30);
  const [appSelecionado, setAppSelecionado] = useState<string>('balcao');
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [produtoHistoricoId, setProdutoHistoricoId] = useState<string | null>(null);
  const [precoManual, setPrecoManual] = useState<string>('');
  const [modoPreco, setModoPreco] = useState<'margem' | 'manual'>('margem');
  const [checklistDismissed, setChecklistDismissed] = useState<boolean>(() => {
    return localStorage.getItem('precificacao-checklist-dismissed') === 'true';
  });

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

  // Buscar histórico geral
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

  // Buscar histórico de produto específico
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

  // Mutation para atualizar preço
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

  // Inicializar margem desejada
  useEffect(() => {
    if (config?.margem_desejada_padrao) {
      setMargemDesejada(config.margem_desejada_padrao);
    }
  }, [config?.margem_desejada_padrao]);

  // Função para calcular preço sugerido
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

  // Calcular métricas de cada produto
  const produtosComMetricas: ProdutoComMetricas[] = useMemo(() => {
    return produtosComFicha.map(produto => {
      const custoInsumos = produto.fichas_tecnicas?.reduce((acc, ft) => {
        return acc + (ft.quantidade * ft.insumos.custo_unitario);
      }, 0) || 0;
      
      const precoVenda = produto.preco_venda || 0;
      const precoBalcao = calcularPrecoSugerido(custoInsumos, 0);
      
      const precosApps = taxasApps?.map(app => ({
        ...app,
        ...calcularPrecoSugerido(custoInsumos, app.taxa_percentual)
      })) || [];
      
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
      } as ProdutoComMetricas;
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

  // Checklist de configuração
  const checklistItems: ChecklistItem[] = useMemo(() => {
    return [
      {
        id: 'margem',
        label: 'Margem desejada',
        description: 'Defina a margem de lucro que você quer alcançar',
        completed: (config?.margem_desejada_padrao || 0) > 0,
        link: '/configuracoes',
        priority: 'high',
      },
      {
        id: 'imposto',
        label: 'Imposto sobre vendas',
        description: 'Configure o percentual de impostos',
        completed: (config?.imposto_medio_sobre_vendas || 0) > 0,
        link: '/configuracoes',
        priority: 'high',
      },
      {
        id: 'faturamento',
        label: 'Faturamento mensal',
        description: 'Informe seu faturamento para calcular custos fixos proporcionais',
        completed: (config?.faturamento_mensal || 0) > 0,
        link: '/configuracoes',
        priority: 'medium',
      },
      {
        id: 'custos-fixos',
        label: 'Custos fixos',
        description: 'Cadastre aluguel, energia, internet, etc.',
        completed: (custosFixos?.length || 0) > 0,
        link: '/custos-fixos',
        priority: 'medium',
      },
      {
        id: 'apps',
        label: 'Taxas de delivery',
        description: 'Configure taxas do iFood, Rappi, etc.',
        completed: (taxasApps?.length || 0) > 0,
        link: '/configuracoes',
        priority: 'low',
      },
    ];
  }, [config, custosFixos, taxasApps]);

  // Handlers
  const handleApplyPrice = (produtoId: string, novoPreco: number, precoAnterior: number) => {
    updatePrecoMutation.mutate({ produtoId, novoPreco, precoAnterior });
  };

  const handleApplySelected = (produtoIds: string[]) => {
    const produtosParaAtualizar = produtosComMetricas.filter(
      p => produtoIds.includes(p.id) && p.statusPreco === 'abaixo'
    );
    
    produtosParaAtualizar.forEach(p => {
      handleApplyPrice(p.id, p.precoBalcao, p.preco_venda);
    });
  };

  const handleApplyAllUrgent = () => {
    const urgentes = produtosComMetricas.filter(p => p.margemLiquida < 0 || p.statusPreco === 'abaixo');
    urgentes.forEach(p => {
      handleApplyPrice(p.id, p.precoBalcao, p.preco_venda);
    });
  };

  const handleSelectProduct = (produto: ProdutoComMetricas) => {
    setProdutoSimulador(produto);
    setPrecoManual('');
    setModoPreco('margem');
    if (isMobile) {
      setSimuladorOpen(true);
    }
  };

  const handleApplyFromSimulator = () => {
    if (produtoSimulador) {
      const calcs = calcularPrecoParaSimulador();
      const precoFinal = modoPreco === 'manual' && precoManual 
        ? parseFloat(precoManual) 
        : calcs.novoPreco;
      
      handleApplyPrice(produtoSimulador.id, precoFinal, produtoSimulador.preco_venda);
      setProdutoSimulador(null);
      setPrecoManual('');
      setModoPreco('margem');
      if (isMobile) {
        setSimuladorOpen(false);
      }
    }
  };

  const calcularPrecoParaSimulador = () => {
    if (!produtoSimulador) return { novoPreco: 0 };
    
    const { percCustoFixo, percImposto } = custosPercentuais;
    const taxaAppAtual = appSelecionado === 'balcao'
      ? 0
      : (taxasApps?.find(a => a.id === appSelecionado)?.taxa_percentual || 0);

    const margem = margemDesejada / 100;
    const imposto = percImposto / 100;
    const custoFixo = percCustoFixo / 100;
    const taxaApp = taxaAppAtual / 100;

    const divisor = 1 - margem - imposto - custoFixo - taxaApp;
    const novoPreco = divisor > 0 ? produtoSimulador.custoInsumos / divisor : produtoSimulador.custoInsumos * 3;

    return { novoPreco };
  };

  const handleViewHistory = (produtoId: string) => {
    setProdutoHistoricoId(produtoId);
    setHistoricoDialogOpen(true);
  };

  const produtoHistoricoNome = useMemo(() => {
    if (!produtoHistoricoId || !produtos) return '';
    const produto = produtos.find(p => p.id === produtoHistoricoId);
    return produto?.nome || '';
  }, [produtoHistoricoId, produtos]);

  const handleDismissChecklist = () => {
    setChecklistDismissed(true);
    localStorage.setItem('precificacao-checklist-dismissed', 'true');
  };

  if (loadingProdutos) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Dialog de histórico de produto */}
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

      {/* Etapa 1: Checklist de Configuração */}
      {!checklistDismissed && (
        <ConfigChecklist 
          items={checklistItems} 
          onDismiss={handleDismissChecklist}
        />
      )}

      {/* Métricas */}
      <MetricsCards
        margemMedia={metricas.margemMedia}
        produtosAbaixo={metricas.produtosAbaixo}
        produtosIdeais={metricas.produtosIdeais}
        produtosAcima={metricas.produtosAcima}
        totalProdutos={produtosComMetricas.length}
        isMobile={isMobile}
      />

      {/* Etapa 2: Atenção Urgente */}
      <UrgentAttention
        produtos={produtosComMetricas}
        onSelectProduct={handleSelectProduct}
        onApplyPrice={handleApplyPrice}
        onApplyAll={handleApplyAllUrgent}
        isApplying={updatePrecoMutation.isPending}
      />

      {/* Alerta de produtos sem ficha */}
      {produtosSemFicha.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-warning">
              {produtosSemFicha.length} produto{produtosSemFicha.length > 1 ? 's' : ''} sem ficha técnica
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-2">
              Adicione ingredientes para calcular custos e preços
            </p>
            <div className="flex flex-wrap gap-1.5">
              {produtosSemFicha.slice(0, 5).map(p => (
                <Button
                  key={p.id}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  asChild
                >
                  <Link to={`/produtos?edit=${p.id}`}>{p.nome}</Link>
                </Button>
              ))}
              {produtosSemFicha.length > 5 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link to="/produtos">+{produtosSemFicha.length - 5} mais</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Simulador Mobile - Drawer */}
      {isMobile && (
        <Drawer open={simuladorOpen} onOpenChange={setSimuladorOpen}>
          <DrawerContent className="max-h-[92vh]">
            <DrawerHeader className="pb-2 px-4">
              <DrawerTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-base">
                  <Calculator className="h-4 w-4" />
                  Simulador de Preço
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSimuladorOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-6 overflow-y-auto max-h-[calc(92vh-4rem)]">
              <PriceSimulator
                produto={produtoSimulador}
                taxasApps={taxasApps || []}
                custosPercentuais={custosPercentuais}
                margemDesejada={margemDesejada}
                setMargemDesejada={setMargemDesejada}
                appSelecionado={appSelecionado}
                setAppSelecionado={setAppSelecionado}
                precoManual={precoManual}
                setPrecoManual={setPrecoManual}
                modoPreco={modoPreco}
                setModoPreco={setModoPreco}
                onApply={handleApplyFromSimulator}
                onClose={() => {
                  setSimuladorOpen(false);
                  setProdutoSimulador(null);
                }}
                isApplying={updatePrecoMutation.isPending}
                isDrawer
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Layout Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Produtos */}
        <div className="lg:col-span-2">
          <ProdutosList
            produtos={produtosComMetricas}
            categorias={categorias}
            onSelectProduct={handleSelectProduct}
            onApplyPrice={handleApplyPrice}
            onApplySelected={handleApplySelected}
            onViewHistory={handleViewHistory}
            isApplying={updatePrecoMutation.isPending}
            isMobile={isMobile}
          />
        </div>

        {/* Simulador Desktop */}
        {!isMobile && (
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Simulador de Preço
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PriceSimulator
                  produto={produtoSimulador}
                  taxasApps={taxasApps || []}
                  custosPercentuais={custosPercentuais}
                  margemDesejada={margemDesejada}
                  setMargemDesejada={setMargemDesejada}
                  appSelecionado={appSelecionado}
                  setAppSelecionado={setAppSelecionado}
                  precoManual={precoManual}
                  setPrecoManual={setPrecoManual}
                  modoPreco={modoPreco}
                  setModoPreco={setModoPreco}
                  onApply={handleApplyFromSimulator}
                  onClose={() => setProdutoSimulador(null)}
                  isApplying={updatePrecoMutation.isPending}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Precificacao;
