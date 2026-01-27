import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from 'react-router-dom';
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
  useMenuEngineering,
  QuadranteMenu,
  ProdutoAnalise,
} from '@/components/precificacao-v2';

const Precificacao = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [quadranteSelecionado, setQuadranteSelecionado] = useState<QuadranteMenu | null>(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoAnalise | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    produtosAnalisados,
    resumoQuadrantes,
    metricas,
    categorias,
    config,
    taxasApps,
    isLoading,
  } = useMenuEngineering();

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
      queryClient.invalidateQueries({ queryKey: ['produtos-menu-engineering'] });
      queryClient.invalidateQueries({ queryKey: ['vendas-popularidade'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
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

  const handleAplicarPreco = (produtoId: string, novoPreco: number, precoAnterior: number) => {
    updatePrecoMutation.mutate({ produtoId, novoPreco, precoAnterior });
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
        <Button variant="outline" size="sm" asChild>
          <Link to="/configuracoes" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
        </Button>
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


          {/* Lista de Produtos */}
          <ProdutoListaCompacta
            produtos={produtosAnalisados}
            quadranteFiltro={quadranteSelecionado}
            categorias={categorias}
            onSelectProduto={handleSelectProduto}
            onAplicarPreco={handleAplicarPreco}
            isAplicando={updatePrecoMutation.isPending}
            isMobile={isMobile}
            taxasApps={taxasApps}
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
        config={config}
        taxasApps={taxasApps}
        isAplicando={updatePrecoMutation.isPending}
      />
    </div>
  );
};

export default Precificacao;
