import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { subDays } from 'date-fns';
import {
  ProdutoBase,
  ProdutoAnalise,
  QuadranteMenu,
  ConfiguracoesPrecificacao,
  MetricasGerais,
  ResumoQuadrante,
  getQuadranteInfo,
} from './types';

interface VendaProduto {
  produto_id: string;
  quantidade: number;
  receita: number;
}

export function useMenuEngineering() {
  const { usuario } = useAuth();

  // Buscar produtos com ficha técnica
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ['produtos-menu-engineering', usuario?.empresa_id],
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
      return data as ProdutoBase[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar preços por canal de todos os produtos
  const { data: precosCanaisTodos } = useQuery({
    queryKey: ['precos-canais-todos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precos_canais')
        .select('produto_id, canal, preco')
        .eq('empresa_id', usuario?.empresa_id);

      if (error) throw error;

      // Criar mapa: produto_id -> { canal -> preco }
      const mapa: Record<string, Record<string, number>> = {};
      data?.forEach(p => {
        if (!mapa[p.produto_id]) {
          mapa[p.produto_id] = {};
        }
        mapa[p.produto_id][p.canal] = p.preco;
      });
      return mapa;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar configurações
  const { data: config } = useQuery({
    queryKey: ['config-menu-engineering', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('margem_desejada_padrao, cmv_alvo, imposto_medio_sobre_vendas, faturamento_mensal')
        .eq('empresa_id', usuario?.empresa_id)
        .single();

      if (error) throw error;
      return data as ConfiguracoesPrecificacao;
    },
    enabled: !!usuario?.empresa_id,
  });


  // Buscar vendas dos últimos 30 dias para popularidade
  const { data: vendasAgregadas } = useQuery({
    queryKey: ['vendas-popularidade', usuario?.empresa_id],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), 30).toISOString().split('T')[0];
      const dataFim = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('vendas')
        .select('produto_id, quantidade, valor_total')
        .eq('empresa_id', usuario?.empresa_id)
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim)
        .not('produto_id', 'is', null);

      if (error) throw error;

      // Agregar por produto
      const agregado: Record<string, VendaProduto> = {};
      data?.forEach(v => {
        if (!v.produto_id) return;
        if (!agregado[v.produto_id]) {
          agregado[v.produto_id] = { produto_id: v.produto_id, quantidade: 0, receita: 0 };
        }
        agregado[v.produto_id].quantidade += v.quantidade || 1;
        agregado[v.produto_id].receita += v.valor_total || 0;
      });

      return agregado;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Processar produtos e classificar
  const produtosAnalisados: ProdutoAnalise[] = useMemo(() => {
    if (!produtos || !config) return [];

    const produtosComFicha = produtos.filter(p => p.fichas_tecnicas && p.fichas_tecnicas.length > 0);
    
    // Calcular medianas para classificação
    const todasMargens: number[] = [];
    const todasQuantidades: number[] = [];

    // Primeiro passo: calcular métricas brutas
    const produtosComMetricas = produtosComFicha.map(produto => {
      const custoInsumos = produto.fichas_tecnicas?.reduce((acc, ft) => {
        return acc + (ft.quantidade * ft.insumos.custo_unitario);
      }, 0) || 0;

      const vendas = vendasAgregadas?.[produto.id];
      const quantidadeVendida = vendas?.quantidade || 0;
      const receitaTotal = vendas?.receita || 0;

      // Buscar preços por canal deste produto
      const precosCanaisProduto = precosCanaisTodos?.[produto.id] || {};

      // Usar preço efetivo de venda (receita/quantidade) quando há vendas,
      // senão usar preco_venda do cadastro. Isso garante consistência entre
      // receitaTotal e o preço usado nos cálculos de margem/CMV.
      const precoVendaCadastro = produto.preco_venda || 0;
      const precoEfetivo = (quantidadeVendida > 0 && receitaTotal > 0)
        ? receitaTotal / quantidadeVendida
        : precoVendaCadastro;

      const cmv = precoEfetivo > 0 ? (custoInsumos / precoEfetivo) * 100 : 100;
      
      // Margem de contribuição (sem custos fixos)
      const impostoValor = precoEfetivo * (config.imposto_medio_sobre_vendas / 100);
      const lucroUnitario = precoEfetivo - custoInsumos - impostoValor;
      const margemContribuicao = precoEfetivo > 0 ? (lucroUnitario / precoEfetivo) * 100 : 0;

      // Calcular preço sugerido
      const margem = config.margem_desejada_padrao / 100;
      const imposto = config.imposto_medio_sobre_vendas / 100;
      const divisor = 1 - margem - imposto;
      const precoSugeridoViavel = divisor > 0;
      const precoSugerido = precoSugeridoViavel ? custoInsumos / divisor : custoInsumos * 2;

      // Saúde
      const saudeMargem: 'critico' | 'atencao' | 'saudavel' = 
        margemContribuicao < 0 ? 'critico' :
        margemContribuicao < config.margem_desejada_padrao * 0.7 ? 'atencao' : 'saudavel';
      
      const saudeCmv: 'critico' | 'atencao' | 'saudavel' = 
        cmv > config.cmv_alvo + 15 ? 'critico' :
        cmv > config.cmv_alvo ? 'atencao' : 'saudavel';

      todasMargens.push(margemContribuicao);
      todasQuantidades.push(quantidadeVendida);

      return {
        ...produto,
        custoInsumos,
        margemContribuicao,
        lucroUnitario,
        cmv,
        quantidadeVendida,
        receitaTotal,
        precoSugerido,
        precoSugeridoViavel,
        saudeMargem,
        saudeCmv,
        precosCanais: precosCanaisProduto,
        quadrante: 'desafio' as QuadranteMenu, // placeholder
      };
    });

    // Calcular medianas
    const sortedMargens = [...todasMargens].sort((a, b) => a - b);
    const sortedQtds = [...todasQuantidades].sort((a, b) => a - b);
    const medianaMargens = sortedMargens[Math.floor(sortedMargens.length / 2)] || config.margem_desejada_padrao;
    const medianaQtds = sortedQtds[Math.floor(sortedQtds.length / 2)] || 0;

    // Classificar em quadrantes
    return produtosComMetricas.map(produto => {
      const altaMargem = produto.margemContribuicao >= medianaMargens;
      const altaPopularidade = produto.quantidadeVendida >= medianaQtds;

      let quadrante: QuadranteMenu;
      if (altaMargem && altaPopularidade) {
        quadrante = 'estrela';
      } else if (!altaMargem && altaPopularidade) {
        quadrante = 'burro-de-carga';
      } else if (altaMargem && !altaPopularidade) {
        quadrante = 'desafio';
      } else {
        quadrante = 'cao';
      }

      return { ...produto, quadrante };
    });
  }, [produtos, config, vendasAgregadas, precosCanaisTodos]);

  // Resumo por quadrante
  const resumoQuadrantes: ResumoQuadrante[] = useMemo(() => {
    const contagem: Record<QuadranteMenu, number> = {
      'estrela': 0,
      'burro-de-carga': 0,
      'desafio': 0,
      'cao': 0,
    };

    produtosAnalisados.forEach(p => {
      contagem[p.quadrante]++;
    });

    return (['estrela', 'burro-de-carga', 'desafio', 'cao'] as QuadranteMenu[]).map(q => ({
      ...getQuadranteInfo(q),
      quantidade: contagem[q],
    }));
  }, [produtosAnalisados]);

  // Métricas gerais
  const metricas: MetricasGerais = useMemo(() => {
    if (produtosAnalisados.length === 0) {
      return {
        totalProdutos: 0,
        margemMedia: 0,
        cmvMedio: 0,
        produtosCriticos: 0,
        receitaPotencial: 0,
      };
    }

    const margemMedia = produtosAnalisados.reduce((acc, p) => acc + p.margemContribuicao, 0) / produtosAnalisados.length;
    const cmvMedio = produtosAnalisados.reduce((acc, p) => acc + p.cmv, 0) / produtosAnalisados.length;
    const produtosCriticos = produtosAnalisados.filter(p => p.saudeMargem === 'critico').length;
    
    // Receita potencial: diferença se todos estivessem no preço sugerido
    const receitaPotencial = produtosAnalisados.reduce((acc, p) => {
      const diferencaPreco = p.precoSugerido - p.preco_venda;
      const ganhoMensal = diferencaPreco * (p.quantidadeVendida || 1);
      return acc + (ganhoMensal > 0 ? ganhoMensal : 0);
    }, 0);

    return {
      totalProdutos: produtosAnalisados.length,
      margemMedia,
      cmvMedio,
      produtosCriticos,
      receitaPotencial,
    };
  }, [produtosAnalisados]);

  // Categorias únicas
  const categorias = useMemo(() => {
    const cats = new Set(produtosAnalisados.map(p => p.categoria).filter(Boolean));
    return Array.from(cats) as string[];
  }, [produtosAnalisados]);

  return {
    produtosAnalisados,
    resumoQuadrantes,
    metricas,
    categorias,
    config,
    isLoading: loadingProdutos,
  };
}
