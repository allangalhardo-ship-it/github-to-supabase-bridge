import { useState, useMemo } from 'react';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePrecosCanais } from '@/hooks/usePrecosCanais';
import { format, subDays, startOfMonth, startOfWeek, differenceInDays, getDaysInMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type PeriodoType = 'hoje' | 'semana' | 'mes' | 'ultimos30' | 'personalizado';

export function useDashboardData() {
  const { usuario } = useAuth();
  const [periodo, setPeriodo] = useState<PeriodoType>('mes');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);

  const getDateRange = () => {
    const hoje = new Date();
    switch (periodo) {
      case 'hoje':
        return { inicio: format(hoje, 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') };
      case 'semana':
        return { inicio: format(startOfWeek(hoje, { locale: ptBR }), 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') };
      case 'mes':
        return { inicio: format(startOfMonth(hoje), 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') };
      case 'ultimos30':
        return { inicio: format(subDays(hoje, 30), 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') };
      case 'personalizado':
        return {
          inicio: customDateFrom ? format(customDateFrom, 'yyyy-MM-dd') : format(startOfMonth(hoje), 'yyyy-MM-dd'),
          fim: customDateTo ? format(customDateTo, 'yyyy-MM-dd') : format(hoje, 'yyyy-MM-dd'),
        };
      default:
        return { inicio: format(startOfMonth(hoje), 'yyyy-MM-dd'), fim: format(hoje, 'yyyy-MM-dd') };
    }
  };

  const { inicio, fim } = getDateRange();

  const getPreviousDateRange = () => {
    const hoje = new Date();
    switch (periodo) {
      case 'hoje':
        return { inicio: format(subDays(hoje, 1), 'yyyy-MM-dd'), fim: format(subDays(hoje, 1), 'yyyy-MM-dd') };
      case 'semana': {
        const inicioSemanaPassada = subDays(startOfWeek(hoje, { locale: ptBR }), 7);
        return { inicio: format(inicioSemanaPassada, 'yyyy-MM-dd'), fim: format(subDays(startOfWeek(hoje, { locale: ptBR }), 1), 'yyyy-MM-dd') };
      }
      case 'mes':
        return { inicio: format(startOfMonth(subMonths(hoje, 1)), 'yyyy-MM-dd'), fim: format(endOfMonth(subMonths(hoje, 1)), 'yyyy-MM-dd') };
      case 'ultimos30':
        return { inicio: format(subDays(hoje, 60), 'yyyy-MM-dd'), fim: format(subDays(hoje, 31), 'yyyy-MM-dd') };
      case 'personalizado':
        if (customDateFrom && customDateTo) {
          const duracao = differenceInDays(customDateTo, customDateFrom);
          return { inicio: format(subDays(customDateFrom, duracao + 1), 'yyyy-MM-dd'), fim: format(subDays(customDateFrom, 1), 'yyyy-MM-dd') };
        }
        return { inicio: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'), fim: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd') };
      default:
        return { inicio: format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'), fim: format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd') };
    }
  };
  const { inicio: inicioAnterior, fim: fimAnterior } = getPreviousDateRange();

  // Queries
  const { data: empresa } = useQuery({
    queryKey: ['empresa-nome', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('empresas').select('nome').eq('id', usuario?.empresa_id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 30 * 60 * 1000,
  });

  const { data: vendas, isLoading: loadingVendas } = useQuery({
    queryKey: ['vendas-dashboard', usuario?.empresa_id, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_vendas', {
        p_empresa_id: usuario?.empresa_id,
        p_data_inicio: inicio,
        p_data_fim: fim,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: vendasFinanceiro } = useQuery({
    queryKey: ['vendas-financeiro-dashboard', usuario?.empresa_id, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select('taxa_servico, incentivo_loja, incentivo_plataforma, comissao_plataforma, valor_liquido, plataforma, subtotal, valor_total, canal')
        .gte('data_venda', inicio)
        .lte('data_venda', fim);
      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 2 * 60 * 1000,
  });

  const { data: vendasAnterior } = useQuery({
    queryKey: ['vendas-anterior', usuario?.empresa_id, inicioAnterior, fimAnterior],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_vendas', {
        p_empresa_id: usuario?.empresa_id,
        p_data_inicio: inicioAnterior,
        p_data_fim: fimAnterior,
      });
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: custosFixos, isLoading: loadingCustos } = useQuery({
    queryKey: ['custos-fixos-dashboard', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('custos_fixos').select('*');
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  const { data: config } = useQuery({
    queryKey: ['config-dashboard', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracoes').select('*').maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  const { data: insumosAlerta } = useQuery({
    queryKey: ['insumos-alerta', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_insumos_estoque_baixo', { p_empresa_id: usuario?.empresa_id });
      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const { data: topProdutos, isLoading: loadingTop } = useQuery({
    queryKey: ['top-produtos', usuario?.empresa_id, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_top_produtos', {
        p_empresa_id: usuario?.empresa_id,
        p_data_inicio: inicio,
        p_data_fim: fim,
        p_limit: 5,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: produtosAnalise } = useQuery({
    queryKey: ['produtos-analise', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select(`id, nome, preco_venda, categoria, fichas_tecnicas (quantidade, insumo_id, insumos (id, nome, custo_unitario))`)
        .eq('ativo', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: historicoPrecos } = useQuery({
    queryKey: ['historico-precos-dashboard', usuario?.empresa_id],
    queryFn: async () => {
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
      const { data, error } = await supabase
        .from('historico_precos')
        .select(`insumo_id, preco_anterior, preco_novo, variacao_percentual, created_at, insumos (nome)`)
        .gte('created_at', trintaDiasAtras.toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id,
    staleTime: 5 * 60 * 1000,
  });

  // Calculations
  const receitaBruta = vendas?.reduce((sum, v) => sum + Number(v.valor_total), 0) || 0;
  const totalVendas = vendas?.length || 0;
  const ticketMedio = totalVendas > 0 ? receitaBruta / totalVendas : 0;

  const ticketPorCanal = React.useMemo(() => {
    if (!vendas || vendas.length === 0) return [];
    const porCanal: Record<string, { total: number; quantidade: number }> = {};
    vendas.forEach((venda) => {
      const canal = venda.canal || 'Direto';
      if (!porCanal[canal]) porCanal[canal] = { total: 0, quantidade: 0 };
      porCanal[canal].total += Number(venda.valor_total);
      porCanal[canal].quantidade += 1;
    });
    return Object.entries(porCanal)
      .map(([canal, dados]) => ({ canal: canal.charAt(0).toUpperCase() + canal.slice(1), ticketMedio: dados.quantidade > 0 ? dados.total / dados.quantidade : 0, quantidade: dados.quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [vendas]);

  const cmvTotal = vendas?.reduce((sum, venda) => {
    if (!venda.custo_insumos) return sum;
    const custoUnitarioProduto = Number(venda.custo_insumos) || 0;
    const precoVendaProduto = Number(venda.produto_preco_venda) || 0;
    const valorTotal = Number(venda.valor_total) || 0;
    const unidadesReais = precoVendaProduto > 0 ? valorTotal / precoVendaProduto : Number(venda.quantidade);
    return sum + (custoUnitarioProduto * unidadesReais);
  }, 0) || 0;

  const cmvPercent = receitaBruta > 0 ? (cmvTotal / receitaBruta) * 100 : 0;
  const margemContribuicao = receitaBruta - cmvTotal;

  const receitaBrutaAnterior = vendasAnterior?.reduce((sum, v) => sum + Number(v.valor_total), 0) || 0;
  const cmvTotalAnterior = vendasAnterior?.reduce((sum, venda) => {
    if (!venda.custo_insumos) return sum;
    const custoUnit = Number(venda.custo_insumos) || 0;
    const precoVenda = Number(venda.produto_preco_venda) || 0;
    const valorTotal = Number(venda.valor_total) || 0;
    const unidades = precoVenda > 0 ? valorTotal / precoVenda : Number(venda.quantidade);
    return sum + (custoUnit * unidades);
  }, 0) || 0;
  const margemAnterior = receitaBrutaAnterior - cmvTotalAnterior;
  const deltaReceita = receitaBrutaAnterior > 0 ? ((receitaBruta - receitaBrutaAnterior) / receitaBrutaAnterior) * 100 : null;
  const deltaLucroBruto = margemAnterior > 0 ? ((margemContribuicao - margemAnterior) / margemAnterior) * 100 : null;

  const produtosDefasados = useMemo(() => {
    if (!produtosAnalise) return 0;
    return produtosAnalise.filter(p => {
      const custoInsumos = p.fichas_tecnicas?.reduce((sum: number, ft: any) => sum + (Number(ft.quantidade) * Number(ft.insumos?.custo_unitario || 0)), 0) || 0;
      if (custoInsumos <= 0 || p.preco_venda <= 0) return false;
      const margem = ((p.preco_venda - custoInsumos) / p.preco_venda) * 100;
      return margem < (config?.margem_desejada_padrao || 30) * 0.7;
    }).length;
  }, [produtosAnalise, config]);

  const qtdProdutosMargemNegativa = useMemo(() => {
    if (!produtosAnalise) return 0;
    return produtosAnalise.filter(p => {
      const custoInsumos = p.fichas_tecnicas?.reduce((sum: number, ft: any) => sum + (Number(ft.quantidade) * Number(ft.insumos?.custo_unitario || 0)), 0) || 0;
      if (custoInsumos <= 0 || p.preco_venda <= 0) return false;
      const impostoVal = p.preco_venda * ((config?.imposto_medio_sobre_vendas || 0) / 100);
      const lucro = p.preco_venda - custoInsumos - impostoVal;
      return lucro < 0;
    }).length;
  }, [produtosAnalise, config]);

  const margemContribuicaoEstimada = useMemo(() => {
    if (receitaBruta > 0 || !produtosAnalise || produtosAnalise.length === 0) return null;
    let totalPreco = 0;
    let totalCusto = 0;
    let produtosComFicha = 0;

    produtosAnalise.forEach((produto) => {
      if (!produto.preco_venda || produto.preco_venda <= 0) return;
      const custoInsumos = produto.fichas_tecnicas?.reduce((sum: number, ft: any) => sum + (Number(ft.quantidade) * Number(ft.insumos?.custo_unitario || 0)), 0) || 0;
      if (custoInsumos > 0) {
        totalPreco += produto.preco_venda;
        totalCusto += custoInsumos;
        produtosComFicha++;
      }
    });

    if (produtosComFicha === 0 || totalPreco === 0) return null;
    const margemPercent = ((totalPreco - totalCusto) / totalPreco) * 100;
    return { receitaSimulada: totalPreco, margemSimulada: totalPreco - totalCusto, margemPercent };
  }, [receitaBruta, produtosAnalise]);

  const custoFixoMensal = custosFixos?.reduce((sum, c) => sum + Number(c.valor_mensal), 0) || 0;
  const faturamentoMensal = config?.faturamento_mensal || 0;

  const calcularCustoFixoPeriodo = () => {
    if (custoFixoMensal <= 0) return 0;
    const hoje = new Date();
    const diasNoMes = getDaysInMonth(hoje);
    const custoDiario = custoFixoMensal / diasNoMes;
    switch (periodo) {
      case 'hoje': return custoDiario;
      case 'semana': {
        const inicioSemana = startOfWeek(hoje, { locale: ptBR });
        return custoDiario * (differenceInDays(hoje, inicioSemana) + 1);
      }
      case 'mes':
      case 'ultimos30': return custoFixoMensal;
      default: return custoFixoMensal;
    }
  };

  const custoFixoTotal = calcularCustoFixoPeriodo();
  const impostoPercent = config?.imposto_medio_sobre_vendas ?? 10;
  const impostos = receitaBruta * (impostoPercent / 100);

  const { canaisConfigurados } = usePrecosCanais();

  const { taxaAppTotal, taxasReaisTotal } = useMemo(() => {
    let reaisTotal = 0;
    let estimadaTotal = 0;

    if (vendasFinanceiro) {
      vendasFinanceiro.forEach((vf) => {
        const totalDeducoes = Number(vf.comissao_plataforma || 0) + Number(vf.taxa_servico || 0) + Number(vf.incentivo_loja || 0);
        if (totalDeducoes > 0) reaisTotal += totalDeducoes;
      });
    }

    if (reaisTotal > 0) return { taxaAppTotal: reaisTotal, taxasReaisTotal: reaisTotal };

    vendas?.forEach((venda) => {
      if (!venda.canal) return;
      const canalVenda = venda.canal.toLowerCase();
      const canalConfig = canaisConfigurados?.find(c => c.nome.toLowerCase() === canalVenda || c.id === venda.canal);
      if (canalConfig && canalConfig.taxa > 0) {
        estimadaTotal += (Number(venda.valor_total) * canalConfig.taxa / 100);
      }
    });

    return { taxaAppTotal: estimadaTotal, taxasReaisTotal: 0 };
  }, [vendas, vendasFinanceiro, canaisConfigurados]);

  const lucroEstimado = margemContribuicao - custoFixoTotal - impostos - taxaAppTotal;

  const produtosMargemNegativa = useMemo(() => {
    if (!produtosAnalise) return [];
    return produtosAnalise
      .map((produto) => {
        const custoInsumos = produto.fichas_tecnicas?.reduce((sum: number, ft: any) => sum + (Number(ft.quantidade) * Number(ft.insumos?.custo_unitario || 0)), 0) || 0;
        const lucro = produto.preco_venda - custoInsumos;
        const margem = produto.preco_venda > 0 ? (lucro / produto.preco_venda) * 100 : 0;
        return { id: produto.id, nome: produto.nome, preco_venda: produto.preco_venda, custo_insumos: custoInsumos, margem, lucro };
      })
      .filter((p) => p.lucro < 0 && p.custo_insumos > 0);
  }, [produtosAnalise]);

  const impactoApps = useMemo(() => {
    if (!vendas || !canaisConfigurados) return [];
    const porCanal: Record<string, { taxaTotal: number; vendas: number }> = {};
    vendas.forEach((venda) => {
      if (!venda.canal) return;
      const canalConfig = canaisConfigurados.find(c => c.nome.toLowerCase() === venda.canal!.toLowerCase() || c.id === venda.canal);
      if (canalConfig && canalConfig.taxa > 0) {
        const nomeCanal = canalConfig.nome;
        if (!porCanal[nomeCanal]) porCanal[nomeCanal] = { taxaTotal: 0, vendas: 0 };
        porCanal[nomeCanal].taxaTotal += (Number(venda.valor_total) * canalConfig.taxa / 100);
        porCanal[nomeCanal].vendas += 1;
      }
    });
    return Object.entries(porCanal).map(([nome, dados]) => ({
      nome, taxaTotal: dados.taxaTotal,
      percentualLucro: lucroEstimado > 0 ? (dados.taxaTotal / lucroEstimado) * 100 : 0,
      vendas: dados.vendas,
    }));
  }, [vendas, canaisConfigurados, lucroEstimado]);

  const melhorProduto = useMemo(() => {
    if (!topProdutos || topProdutos.length === 0) return null;
    const melhor = topProdutos[0];
    const lucro = Number(melhor.lucro || 0);
    const receita = Number(melhor.receita || 0);
    return { nome: melhor.nome, lucroTotal: lucro, quantidade: Number(melhor.quantidade || 0), margem: receita > 0 ? (lucro / receita) * 100 : 0 };
  }, [topProdutos]);

  const isLoading = loadingVendas || loadingCustos;

  return {
    // Period controls
    periodo, setPeriodo,
    customDateFrom, setCustomDateFrom,
    customDateTo, setCustomDateTo,
    inicio, fim,

    // Data
    empresa, vendas, vendasFinanceiro, vendasAnterior,
    custosFixos, config, insumosAlerta,
    topProdutos, loadingTop,
    produtosAnalise, historicoPrecos,
    canaisConfigurados,

    // Calculations
    receitaBruta, totalVendas, ticketMedio, ticketPorCanal,
    cmvTotal, cmvPercent, margemContribuicao,
    deltaReceita, deltaLucroBruto,
    produtosDefasados, qtdProdutosMargemNegativa,
    margemContribuicaoEstimada,
    custoFixoMensal, custoFixoTotal,
    impostoPercent, impostos,
    taxaAppTotal, taxasReaisTotal,
    lucroEstimado,
    produtosMargemNegativa, impactoApps, melhorProduto,

    isLoading,
  };
}
