/**
 * Utilitários centralizados para cálculo de precificação
 * Fórmula completa: Preço = Custo / (1 - Margem% - Impostos% - CustoFixo% - TaxaApp%)
 */

export interface ConfiguracaoPrecificacao {
  faturamento_mensal: number;
  margem_desejada_padrao: number;
  imposto_medio_sobre_vendas: number;
  total_custos_fixos: number;
}

export interface ResultadoPrecoSugerido {
  preco: number;
  viavel: boolean; // false se o divisor ficar <= 0 (inviável)
}

/**
 * Calcula os percentuais de custos fixos sobre o faturamento
 */
export function calcularPercentuaisConfig(config: ConfiguracaoPrecificacao) {
  const { faturamento_mensal, total_custos_fixos, imposto_medio_sobre_vendas, margem_desejada_padrao } = config;
  
  const percCustoFixo = faturamento_mensal > 0 
    ? (total_custos_fixos / faturamento_mensal) * 100 
    : 0;
  
  return {
    percCustoFixo,
    percImposto: imposto_medio_sobre_vendas,
    margemDesejada: margem_desejada_padrao,
  };
}

/**
 * Calcula o preço sugerido baseado na fórmula completa de precificação
 * 
 * @param custoInsumos - Custo total dos ingredientes/insumos
 * @param config - Configurações do sistema (margem, impostos, custos fixos, faturamento)
 * @param taxaApp - Taxa percentual do app de delivery (opcional, padrão 0)
 * @returns Objeto com preço sugerido e indicador de viabilidade
 */
export function calcularPrecoSugerido(
  custoInsumos: number,
  config: ConfiguracaoPrecificacao,
  taxaApp: number = 0
): ResultadoPrecoSugerido {
  if (custoInsumos <= 0) {
    return { preco: 0, viavel: false };
  }

  const { percCustoFixo, percImposto, margemDesejada } = calcularPercentuaisConfig(config);
  
  const margem = margemDesejada / 100;
  const imposto = percImposto / 100;
  const custoFixo = percCustoFixo / 100;
  const taxa = taxaApp / 100;
  
  const divisor = 1 - margem - imposto - custoFixo - taxa;
  
  // Se o divisor for <= 0, a precificação é inviável (custos + margens >= 100%)
  if (divisor <= 0) {
    return { preco: custoInsumos * 3, viavel: false };
  }
  
  return { preco: custoInsumos / divisor, viavel: true };
}

/**
 * Calcula métricas de rentabilidade de um produto
 */
export function calcularMetricasProduto(
  precoVenda: number,
  custoInsumos: number,
  config: ConfiguracaoPrecificacao,
  taxaApp: number = 0
) {
  const { percCustoFixo, percImposto } = calcularPercentuaisConfig(config);
  
  const custoFixoValor = precoVenda * (percCustoFixo / 100);
  const impostoValor = precoVenda * (percImposto / 100);
  const taxaValor = precoVenda * (taxaApp / 100);
  
  const custoTotal = custoInsumos + custoFixoValor + impostoValor + taxaValor;
  const lucroLiquido = precoVenda - custoTotal;
  const margemLiquida = precoVenda > 0 ? (lucroLiquido / precoVenda) * 100 : 0;
  const margemBruta = precoVenda > 0 ? ((precoVenda - custoInsumos) / precoVenda) * 100 : 0;
  const cmv = precoVenda > 0 ? (custoInsumos / precoVenda) * 100 : 0;
  
  return {
    custoInsumos,
    custoFixoValor,
    impostoValor,
    taxaValor,
    custoTotal,
    lucroLiquido,
    margemLiquida,
    margemBruta,
    cmv,
  };
}
