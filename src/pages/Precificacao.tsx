import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateAndRefetch } from '@/lib/queryConfig';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePrecosCanais } from '@/hooks/usePrecosCanais';
import { Link } from 'react-router-dom';
import { formatCurrencyBRL } from '@/lib/format';
import {
  Settings,
  Package,
  ArrowRight,
  Info
} from 'lucide-react';

import {
  QuadranteCards,
  ProdutoListaCompacta,
  ProdutoDetalheDrawer,
  ResumoExecutivo,
  MatrizScatter,
  KpisAvancados,
  useMenuEngineering,
  QuadranteMenu,
  ProdutoAnalise,
  PeriodoBCG,
} from '@/components/precificacao-v2';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import SugestaoPrecoCanal from '@/components/precificacao-v2/SugestaoPrecoCanal';
import ImpactoReajusteReport from '@/components/precificacao-v2/ImpactoReajusteReport';
import ContextualTip from '@/components/onboarding/ContextualTip';

const Precificacao = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [quadranteSelecionado, setQuadranteSelecionado] = useState<QuadranteMenu | null>(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoAnalise | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [periodo, setPeriodo] = useState<PeriodoBCG>(30);

  const {
    produtosAnalisados,
    resumoQuadrantes,
    metricas,
    categorias,
    config,
    isLoading,
  } = useMenuEngineering(periodo);

  // Hook para gerenciar preços por canal
  const { upsertPreco, isSaving: isSavingPrecoCanal, canaisConfigurados } = usePrecosCanais();

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
      // Força refetch imediato para atualizar a UI
      invalidateAndRefetch([
        ['produtos-menu-engineering'],
        ['vendas-popularidade'],
        ['produtos'],
        ['precos-canais-todos'],
        ['produtos-analise'],
        ['top-produtos'],
      ]);
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

  // Confirmação para variação > 10%
  const [confirmacao, setConfirmacao] = useState<null | {
    tipo: 'base' | 'canal';
    produtoId: string;
    canal?: string;
    canalNome?: string;
    novoPreco: number;
    precoAnterior: number;
    variacao: number;
  }>(null);

  const aplicarPrecoBase = (produtoId: string, novoPreco: number, precoAnterior: number) => {
    updatePrecoMutation.mutate({ produtoId, novoPreco, precoAnterior });
  };

  const aplicarPrecoCanalReal = (produtoId: string, canal: string, novoPreco: number, precoAnterior: number, canalNome?: string) => {
    upsertPreco({ produtoId, canal, preco: novoPreco, canalNome });
    if (canal === 'balcao') {
      updatePrecoMutation.mutate({ produtoId, novoPreco, precoAnterior });
    } else {
      supabase.from('historico_precos_produtos').insert({
        empresa_id: usuario?.empresa_id,
        produto_id: produtoId,
        preco_anterior: precoAnterior,
        preco_novo: novoPreco,
        variacao_percentual: precoAnterior > 0 ? ((novoPreco - precoAnterior) / precoAnterior) * 100 : null,
        origem: 'precificacao',
        observacao: `Canal: ${canal}`,
      });
      invalidateAndRefetch([
        ['produtos-menu-engineering'],
        ['precos-canais-todos'],
        ['produtos-analise'],
      ]);
    }
  };

  const calcVariacao = (anterior: number, novo: number) =>
    anterior > 0 ? Math.abs(((novo - anterior) / anterior) * 100) : 0;

  const handleAplicarPreco = (produtoId: string, novoPreco: number, precoAnterior: number) => {
    const variacao = calcVariacao(precoAnterior, novoPreco);
    if (variacao > 10) {
      setConfirmacao({ tipo: 'base', produtoId, novoPreco, precoAnterior, variacao });
      return;
    }
    aplicarPrecoBase(produtoId, novoPreco, precoAnterior);
  };

  const handleAplicarPrecoCanal = (produtoId: string, canal: string, novoPreco: number, precoAnterior: number) => {
    const canalInfo = canaisConfigurados?.find(c => c.id === canal);
    const canalNome = canalInfo?.nome;
    const variacao = calcVariacao(precoAnterior, novoPreco);
    if (variacao > 10) {
      setConfirmacao({ tipo: 'canal', produtoId, canal, canalNome, novoPreco, precoAnterior, variacao });
      return;
    }
    aplicarPrecoCanalReal(produtoId, canal, novoPreco, precoAnterior, canalNome);
  };

  const confirmarAplicacao = () => {
    if (!confirmacao) return;
    if (confirmacao.tipo === 'base') {
      aplicarPrecoBase(confirmacao.produtoId, confirmacao.novoPreco, confirmacao.precoAnterior);
    } else if (confirmacao.canal) {
      aplicarPrecoCanalReal(
        confirmacao.produtoId,
        confirmacao.canal,
        confirmacao.novoPreco,
        confirmacao.precoAnterior,
        confirmacao.canalNome,
      );
    }
    setConfirmacao(null);
  };

  const handleSelectProduto = (produto: ProdutoAnalise) => {
    setProdutoSelecionado(produto);
    setDrawerOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Verificar se há configuração básica
  const configIncompleta = !config?.margem_desejada_padrao || !config?.imposto_medio_sobre_vendas;

  return (
    <div className="space-y-6">
      <ContextualTip
        tipKey="precificacao-intro"
        title="📊 Descubra quanto cobrar em cada produto!"
        description="O Menu Engineering cruza popularidade × rentabilidade. Use o simulador 'E se?' para ver o impacto de reajustes antes de aplicar."
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            📊 Menu Engineering
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Analise popularidade × rentabilidade para decisões estratégicas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(periodo)} onValueChange={(v) => setPeriodo(Number(v) as PeriodoBCG)}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Período de análise">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" asChild>
            <Link to="/configuracoes" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Alerta de configuração incompleta */}
      {configIncompleta && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Configure margem e impostos para cálculos precisos.</span>
            <Button variant="link" size="sm" asChild className="p-0 h-auto">
              <Link to="/configuracoes">
                Configurar <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Verificar se há produtos */}
      {produtosAnalisados.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <Package className="h-16 w-16 mx-auto text-muted-foreground/30" />
          <div>
            <h2 className="text-lg font-semibold">Nenhum produto com ficha técnica</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Para analisar precificação, cadastre produtos com ficha técnica
            </p>
          </div>
          <Button asChild>
            <Link to="/produtos">
              <Package className="h-4 w-4 mr-2" />
              Ir para Produtos
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Resumo Executivo */}
          <ResumoExecutivo
            metricas={metricas}
            cmvAlvo={config?.cmv_alvo || 35}
            margemAlvo={config?.margem_desejada_padrao || 30}
            isMobile={isMobile}
          />

          {/* KPIs avançados: Food Cost Teórico vs Real + Prime Cost */}
          <KpisAvancados
            cmvTeorico={metricas.cmvMedio}
            cmvAlvo={config?.cmv_alvo || 35}
            margemAlvo={config?.margem_desejada_padrao || 30}
            periodo={periodo}
            isMobile={isMobile}
          />

          {/* Cards de Quadrante */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                Classificação por Quadrante
              </h2>
              {quadranteSelecionado && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setQuadranteSelecionado(null)}
                  className="text-xs h-7"
                >
                  Limpar filtro
                </Button>
              )}
            </div>
            <QuadranteCards
              resumo={resumoQuadrantes}
              quadranteSelecionado={quadranteSelecionado}
              onSelectQuadrante={setQuadranteSelecionado}
              isMobile={isMobile}
            />
          </div>

          {/* Matriz scatter — visão gráfica da popularidade × margem */}
          <MatrizScatter
            produtos={produtosAnalisados.filter(p => p.quantidadeVendida > 0)}
            quadranteSelecionado={quadranteSelecionado}
            onSelectProduto={handleSelectProduto}
            margemAlvo={config?.margem_desejada_padrao || 30}
          />


          {/* Sugestão de preço por canal */}
          <SugestaoPrecoCanal 
            produtos={produtosAnalisados} 
            config={config}
            onAplicarPrecoCanal={handleAplicarPrecoCanal}
            isAplicando={updatePrecoMutation.isPending || isSavingPrecoCanal}
          />

          {/* Relatório de impacto de reajustes */}
          <ImpactoReajusteReport 
            produtos={produtosAnalisados} 
            config={config}
            onAplicarPreco={handleAplicarPreco}
            onAplicarPrecoCanal={handleAplicarPrecoCanal}
            isAplicando={updatePrecoMutation.isPending || isSavingPrecoCanal}
          />


          {/* Lista de Produtos */}
          <ProdutoListaCompacta
            produtos={produtosAnalisados}
            quadranteFiltro={quadranteSelecionado}
            categorias={categorias}
            onSelectProduto={handleSelectProduto}
            onAplicarPreco={handleAplicarPreco}
            onAplicarPrecoCanal={handleAplicarPrecoCanal}
            isAplicando={updatePrecoMutation.isPending}
            isMobile={isMobile}
            config={config}
          />
        </>
      )}

      {/* Drawer de Detalhe */}
      <ProdutoDetalheDrawer
        produto={produtoSelecionado}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setProdutoSelecionado(null);
        }}
        onAplicarPreco={handleAplicarPreco}
        onAplicarPrecoCanal={handleAplicarPrecoCanal}
        config={config}
        isAplicando={updatePrecoMutation.isPending || isSavingPrecoCanal}
      />

      {/* Confirmação de variação > 10% */}
      <AlertDialog open={!!confirmacao} onOpenChange={(o) => !o && setConfirmacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar reajuste de preço?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {confirmacao && (
                  <>
                    <p>
                      Você vai alterar o{' '}
                      <strong>
                        {confirmacao.tipo === 'canal' && confirmacao.canalNome
                          ? `preço do canal ${confirmacao.canalNome}`
                          : 'preço base do produto'}
                      </strong>{' '}
                      em{' '}
                      <strong className={confirmacao.novoPreco > confirmacao.precoAnterior ? 'text-green-600' : 'text-red-600'}>
                        {confirmacao.novoPreco > confirmacao.precoAnterior ? '+' : '−'}
                        {confirmacao.variacao.toFixed(1)}%
                      </strong>
                      .
                    </p>
                    <div className="flex items-center justify-between rounded-md bg-muted p-3 text-sm">
                      <span>De: <strong>{formatCurrencyBRL(confirmacao.precoAnterior)}</strong></span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span>Para: <strong>{formatCurrencyBRL(confirmacao.novoPreco)}</strong></span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Reajustes acima de 10% podem impactar fortemente vendas e percepção do cliente. Confirme se está correto.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarAplicacao}>Aplicar reajuste</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Precificacao;
