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

  // Buscar canais de venda + taxas agregadas (taxa efetiva por canal)
  const { data: canaisInfo } = useQuery({
    queryKey: ['canais-com-taxas', usuario?.empresa_id],
    queryFn: async () => {
      const { data: canaisData, error: canaisError } = await supabase
        .from('canais_venda')
        .select('id, nome, tipo, ativo')
        .eq('empresa_id', usuario?.empresa_id)
        .eq('ativo', true);
      if (canaisError) throw canaisError;

      const { data: taxasData, error: taxasError } = await supabase
        .from('taxas_canais')
        .select('canal_id, percentual');
      if (taxasError) throw taxasError;

      // Mapa: canalId -> { taxa, isBalcao }
      const mapa: Record<string, { taxa: number; isBalcao: boolean; nome: string }> = {};
      (canaisData || []).forEach(c => {
        const taxaTotal = (taxasData || [])
          .filter(t => t.canal_id === c.id)
          .reduce((sum, t) => sum + Number(t.percentual || 0), 0);
        mapa[c.id] = {
          taxa: taxaTotal,
          isBalcao: c.tipo === 'presencial',
          nome: c.nome,
        };
      });
      return mapa;
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

      // SEMPRE usar o preço de cadastro atual como fonte de verdade para margem/CMV.
      // Assim, ao alterar o preço, os indicadores refletem imediatamente o novo cenário.
      // (Antes usávamos receita/quantidade, que congelava os cálculos no preço médio
      // histórico das vendas, fazendo o painel não reagir a reajustes de preço.)
      const precoEfetivo = produto.preco_venda || 0;

      const cmv = precoEfetivo > 0 ? (custoInsumos / precoEfetivo) * 100 : 100;

      // === Taxa do canal: agora considerada nos cálculos ===
      // Estratégia:
      //  - Se o produto tem preços por canal cadastrados, calculamos a MÉDIA PONDERADA
      //    da taxa pelos preços de cada canal (canais mais caros pesam mais).
      //  - Caso contrário, usamos a taxa do canal "balcão/presencial" (geralmente 0%).
      //  - Isso evita a margem otimista que ignorava o iFood/99/etc.
      let taxaCanalEfetiva = 0;
      const canaisDoProdutoIds = Object.keys(precosCanaisProduto);
      if (canaisDoProdutoIds.length > 0 && canaisInfo) {
        let somaPesos = 0;
        let somaTaxaPonderada = 0;
        canaisDoProdutoIds.forEach(canalId => {
          const info = canaisInfo[canalId];
          const preco = precosCanaisProduto[canalId];
          if (info && preco > 0) {
            somaPesos += preco;
            somaTaxaPonderada += info.taxa * preco;
          }
        });
        taxaCanalEfetiva = somaPesos > 0 ? somaTaxaPonderada / somaPesos : 0;
      } else if (canaisInfo) {
        // Sem preços por canal → fallback para o canal balcão (presencial)
        const balcao = Object.values(canaisInfo).find(c => c.isBalcao);
        taxaCanalEfetiva = balcao?.taxa || 0;
      }

      // Margem de contribuição AGORA inclui a taxa do canal
      const impostoValor = precoEfetivo * (config.imposto_medio_sobre_vendas / 100);
      const taxaValor = precoEfetivo * (taxaCanalEfetiva / 100);
      const lucroUnitario = precoEfetivo - custoInsumos - impostoValor - taxaValor;
      const margemContribuicao = precoEfetivo > 0 ? (lucroUnitario / precoEfetivo) * 100 : 0;

      // Preço sugerido também considera taxa do canal efetiva
      const margem = config.margem_desejada_padrao / 100;
      const imposto = config.imposto_medio_sobre_vendas / 100;
      const taxa = taxaCanalEfetiva / 100;
      const divisor = 1 - margem - imposto - taxa;
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

    // Calcular medianas — usar apenas produtos COM vendas para não distorcer
    const produtosComVendas = produtosComMetricas.filter(p => p.quantidadeVendida > 0);
    const margensComVendas = produtosComVendas.map(p => p.margemContribuicao).sort((a, b) => a - b);
    const qtdsComVendas = produtosComVendas.map(p => p.quantidadeVendida).sort((a, b) => a - b);
    
    const sortedMargens = [...todasMargens].sort((a, b) => a - b);
    // Mediana de margem usa todos (para classificar margem alta/baixa)
    const medianaMargens = sortedMargens[Math.floor(sortedMargens.length / 2)] || config.margem_desejada_padrao;
    // Mediana de quantidade usa apenas quem vendeu (produtos sem venda ficam automaticamente como baixa popularidade)
    const medianaQtds = qtdsComVendas.length > 0
      ? qtdsComVendas[Math.floor(qtdsComVendas.length / 2)]
      : 1; // Se ninguém vendeu, qualquer valor > 0 seria alta popularidade

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
  }, [produtos, config, vendasAgregadas, precosCanaisTodos, canaisInfo]);

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

    // Média PONDERADA pelo preço de venda (financeiramente correta — produtos mais caros pesam mais)
    // IMPORTANTE: usar a MESMA base do cálculo por produto (margemContribuicao = preço − custo − imposto − taxa do canal).
    // Antes a métrica agregada ignorava imposto e taxa, inflando a margem exibida no card vs. realidade.
    const validos = produtosAnalisados.filter(p => p.preco_venda > 0 && p.custoInsumos > 0);
    const somaPreco = validos.reduce((acc, p) => acc + p.preco_venda, 0);
    const somaCusto = validos.reduce((acc, p) => acc + p.custoInsumos, 0);
    // Lucro unitário já inclui imposto + taxa do canal (calculado na linha 224)
    const somaLucro = validos.reduce((acc, p) => acc + p.lucroUnitario, 0);
    const margemMedia = somaPreco > 0 ? (somaLucro / somaPreco) * 100 : 0;
    const cmvMedio = somaPreco > 0 ? (somaCusto / somaPreco) * 100 : 0;
    const produtosCriticos = produtosAnalisados.filter(p => p.saudeMargem === 'critico').length;
    
    // Receita potencial: diferença se todos estivessem no preço sugerido
    // Só considerar produtos que realmente vendem
    const receitaPotencial = produtosAnalisados.reduce((acc, p) => {
      if (p.quantidadeVendida === 0) return acc; // Sem vendas = sem receita potencial real
      const diferencaPreco = p.precoSugerido - p.preco_venda;
      const ganhoMensal = diferencaPreco * p.quantidadeVendida;
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
