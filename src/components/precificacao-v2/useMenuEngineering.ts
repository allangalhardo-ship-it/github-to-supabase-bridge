import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { subDays } from 'date-fns';
import { calcularCustoFicha } from '@/utils/custoFicha';
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

export type PeriodoBCG = 7 | 30 | 90;

export function useMenuEngineering(periodo: PeriodoBCG = 30) {
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
            unidade,
            insumos (
              id,
              nome,
              custo_unitario,
              unidade_medida,
              fator_perda
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
  // Agora também agregamos receita POR CANAL (texto) para calcular
  // a margem média ponderada pelas vendas reais, não pelo cadastro de preços.
  const { data: vendasData } = useQuery({
    queryKey: ['vendas-popularidade-canal', usuario?.empresa_id, periodo],
    queryFn: async () => {
      const dataInicio = subDays(new Date(), periodo).toISOString().split('T')[0];
      const dataFim = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('vendas')
        .select('produto_id, quantidade, valor_total, canal')
        .eq('empresa_id', usuario?.empresa_id)
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim)
        .not('produto_id', 'is', null);

      if (error) throw error;

      // Agregar por produto (total)
      const agregado: Record<string, VendaProduto> = {};
      // Agregar por produto + canal (texto): { produtoId: { canalTexto: receita } }
      const porCanal: Record<string, Record<string, number>> = {};

      data?.forEach(v => {
        if (!v.produto_id) return;
        if (!agregado[v.produto_id]) {
          agregado[v.produto_id] = { produto_id: v.produto_id, quantidade: 0, receita: 0 };
        }
        agregado[v.produto_id].quantidade += v.quantidade || 1;
        agregado[v.produto_id].receita += v.valor_total || 0;

        const canalKey = (v.canal || '').toString().trim().toLowerCase() || 'sem-canal';
        if (!porCanal[v.produto_id]) porCanal[v.produto_id] = {};
        porCanal[v.produto_id][canalKey] =
          (porCanal[v.produto_id][canalKey] || 0) + (v.valor_total || 0);
      });

      return { agregado, porCanal };
    },
    enabled: !!usuario?.empresa_id,
  });

  const vendasAgregadas = vendasData?.agregado;
  const vendasPorCanal = vendasData?.porCanal;

  // Helper: encontrar canal_id a partir do texto livre salvo em vendas.canal
  // Estratégia: lowercase + match exato no nome OU contains; "balcao" → tipo presencial
  const matchCanalIdPorTexto = useMemo(() => {
    return (canalTexto: string): string | null => {
      if (!canaisInfo) return null;
      const key = (canalTexto || '').trim().toLowerCase();
      if (!key || key === 'sem-canal') return null;

      // 1) Match exato por nome (case-insensitive)
      for (const [id, info] of Object.entries(canaisInfo)) {
        if (info.nome.trim().toLowerCase() === key) return id;
      }
      // 2) "balcao" / "balcão" / "presencial" → canal presencial
      if (['balcao', 'balcão', 'presencial', 'loja'].includes(key)) {
        const balcao = Object.entries(canaisInfo).find(([, c]) => c.isBalcao);
        if (balcao) return balcao[0];
      }
      // 3) Contains (Ex.: "99Food" → canal "99")
      for (const [id, info] of Object.entries(canaisInfo)) {
        const nomeLow = info.nome.trim().toLowerCase();
        if (nomeLow && (key.includes(nomeLow) || nomeLow.includes(key))) return id;
      }
      return null;
    };
  }, [canaisInfo]);

  // Processar produtos e classificar
  const produtosAnalisados: ProdutoAnalise[] = useMemo(() => {
    if (!produtos || !config) return [];

    const produtosComFicha = produtos.filter(p => p.fichas_tecnicas && p.fichas_tecnicas.length > 0);

    // Calcular medianas para classificação
    const todasMargens: number[] = [];
    const todasQuantidades: number[] = [];



    // Primeiro passo: calcular métricas brutas
    const produtosComMetricas = produtosComFicha.map(produto => {
      const custoInsumos = calcularCustoFicha(produto.fichas_tecnicas);

      const vendas = vendasAgregadas?.[produto.id];
      const quantidadeVendida = vendas?.quantidade || 0;
      const receitaTotal = vendas?.receita || 0;

      // Buscar preços por canal deste produto
      const precosCanaisProduto = precosCanaisTodos?.[produto.id] || {};

      // Fonte de verdade da precificação: preços por canal.
      // produto.preco_venda fica apenas como fallback legado quando um canal ainda não tem preço próprio.
      let precoEfetivo = produto.preco_venda || 0;
      let cmv = precoEfetivo > 0 ? (custoInsumos / precoEfetivo) * 100 : 100;

      // === Taxa do canal ponderada por VENDAS REAIS (últimos 30 dias) ===
      // Prioridade:
      //  1) Se o produto teve vendas nos últimos 30d → ponderar a taxa pela receita
      //     real por canal (mapeando vendas.canal texto → canal_id).
      //  2) Sem vendas: cair para ponderação pelos preços por canal cadastrados.
      //  3) Nada cadastrado: usar a taxa do canal "balcão" (presencial).
      let taxaCanalEfetiva = 0;
      const vendasCanaisProduto = vendasPorCanal?.[produto.id];
      const temVendasComCanal = vendasCanaisProduto && Object.keys(vendasCanaisProduto).length > 0;

      if (temVendasComCanal && canaisInfo) {
        let somaPesos = 0;
        let somaTaxaPonderada = 0;
        Object.entries(vendasCanaisProduto).forEach(([canalTexto, receita]) => {
          const canalId = matchCanalIdPorTexto(canalTexto);
          const info = canalId ? canaisInfo[canalId] : null;
          if (info && receita > 0) {
            somaPesos += receita;
            somaTaxaPonderada += info.taxa * receita;
          }
        });
        if (somaPesos > 0) {
          taxaCanalEfetiva = somaTaxaPonderada / somaPesos;
        }
      }

      // Fallback 1: preços por canal cadastrados
      if (taxaCanalEfetiva === 0 && !temVendasComCanal) {
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
          // Fallback 2: balcão
          const balcao = Object.values(canaisInfo).find(c => c.isBalcao);
          taxaCanalEfetiva = balcao?.taxa || 0;
        }
      }

      // Margem de contribuição inclui imposto + taxa do canal.
      let impostoValor = precoEfetivo * (config.imposto_medio_sobre_vendas / 100);
      let taxaValor = precoEfetivo * (taxaCanalEfetiva / 100);
      let lucroUnitario = precoEfetivo - custoInsumos - impostoValor - taxaValor;
      let margemContribuicao = precoEfetivo > 0 ? (lucroUnitario / precoEfetivo) * 100 : 0;

      // Se existem canais ativos, recalcula as métricas usando os preços reais por canal.
      // Isso elimina falsos alertas causados pelo preço legado do produto ou por taxa média de vendas.
      if (canaisInfo && Object.keys(canaisInfo).length > 0) {
        const metricasPorCanal = Object.entries(canaisInfo)
          .map(([canalId, info]) => {
            const precoCanal = precosCanaisProduto[canalId] ?? produto.preco_venda ?? 0;
            const taxaCanal = info.taxa / 100;
            const receitaLiquida = precoCanal * (1 - taxaCanal);
            const lucroCanal = precoCanal - custoInsumos - (precoCanal * (config.imposto_medio_sobre_vendas / 100)) - (precoCanal * taxaCanal);
            return {
              canalId,
              preco: precoCanal,
              taxa: info.taxa,
              lucro: lucroCanal,
              margem: precoCanal > 0 ? (lucroCanal / precoCanal) * 100 : 0,
              cmv: receitaLiquida > 0 ? (custoInsumos / receitaLiquida) * 100 : 100,
            };
          })
          .filter(m => m.preco > 0);

        if (metricasPorCanal.length > 0) {
          const pesosPorCanal: Record<string, number> = {};
          if (temVendasComCanal && canaisInfo) {
            Object.entries(vendasCanaisProduto).forEach(([canalTexto, receita]) => {
              const canalId = matchCanalIdPorTexto(canalTexto);
              if (canalId && receita > 0) {
                pesosPorCanal[canalId] = (pesosPorCanal[canalId] || 0) + receita;
              }
            });
          }

          const somaPesos = metricasPorCanal.reduce((sum, m) => sum + (pesosPorCanal[m.canalId] || 0), 0);
          const media = (selector: (m: typeof metricasPorCanal[number]) => number) => {
            if (somaPesos > 0) {
              return metricasPorCanal.reduce((sum, m) => sum + selector(m) * (pesosPorCanal[m.canalId] || 0), 0) / somaPesos;
            }
            return metricasPorCanal.reduce((sum, m) => sum + selector(m), 0) / metricasPorCanal.length;
          };

          precoEfetivo = media(m => m.preco);
          taxaCanalEfetiva = media(m => m.taxa);
          lucroUnitario = media(m => m.lucro);
          margemContribuicao = media(m => m.margem);
          cmv = media(m => m.cmv);
          impostoValor = precoEfetivo * (config.imposto_medio_sobre_vendas / 100);
          taxaValor = precoEfetivo * (taxaCanalEfetiva / 100);
        }
      }

      // Preço sugerido do produto = canal âncora (Balcão), não média de vendas.
      // Preços de apps/WhatsApp são calculados individualmente nos componentes por canal.
      // Usar taxa ponderada por vendas aqui gerava falso reajuste: Balcão já estava em 50% CMV,
      // mas uma venda em canal com taxa alta empurrava a sugestão global para ~R$35,90.
      const cmvAlvoFrac = (config.cmv_alvo || 35) / 100;
      const canalReferenciaPreco = canaisInfo
        ? Object.entries(canaisInfo).find(([, c]) => c.isBalcao)
        : null;
      const taxaReferenciaPreco = canalReferenciaPreco
        ? canalReferenciaPreco[1].taxa
        : taxaCanalEfetiva;
      const precoReferenciaAtual = canalReferenciaPreco
        ? (precosCanaisProduto[canalReferenciaPreco[0]] ?? produto.preco_venda ?? 0)
        : (produto.preco_venda ?? 0);
      const taxa = taxaReferenciaPreco / 100;
      const fatorReceita = 1 - taxa;
      const precoSugeridoViavel = cmvAlvoFrac > 0 && cmvAlvoFrac < 1 && fatorReceita > 0 && custoInsumos > 0;
      const precoSugerido = precoSugeridoViavel ? custoInsumos / (cmvAlvoFrac * fatorReceita) : 0;


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
        precoReferenciaAtual,
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
      let quadrante: QuadranteMenu;
      // Produto sem vendas no período → não classificar como Cão; é "sem dados"
      if (produto.quantidadeVendida <= 0) {
        quadrante = 'sem-dados';
      } else {
        const altaMargem = produto.margemContribuicao >= medianaMargens;
        const altaPopularidade = produto.quantidadeVendida >= medianaQtds;
        if (altaMargem && altaPopularidade) quadrante = 'estrela';
        else if (!altaMargem && altaPopularidade) quadrante = 'burro-de-carga';
        else if (altaMargem && !altaPopularidade) quadrante = 'desafio';
        else quadrante = 'cao';
      }
      return { ...produto, quadrante };
    });
  }, [produtos, config, vendasAgregadas, vendasPorCanal, precosCanaisTodos, canaisInfo, matchCanalIdPorTexto]);

  // Resumo por quadrante
  const resumoQuadrantes: ResumoQuadrante[] = useMemo(() => {
    const contagem: Record<QuadranteMenu, number> = {
      'estrela': 0,
      'burro-de-carga': 0,
      'desafio': 0,
      'cao': 0,
      'sem-dados': 0,
    };

    produtosAnalisados.forEach(p => {
      contagem[p.quadrante]++;
    });

    return (['estrela', 'burro-de-carga', 'desafio', 'cao', 'sem-dados'] as QuadranteMenu[]).map(q => ({
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
