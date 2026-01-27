/**
 * Utilitários centralizados para cálculo de precificação
 * 
 * FÓRMULA CORRETA (custos variáveis apenas):
 * Preço = Custo / (1 - Margem% - Impostos% - TaxaCanal%)
 * 
 * IMPORTANTE: Custos fixos NÃO entram no cálculo do preço unitário.
 * Eles são cobertos pela SOMA das margens de todos os produtos vendidos.
 * A verificação de cobertura dos custos fixos é feita no Dashboard (Lucro Estimado).
 */

export interface ConfiguracaoPrecificacao {
  margem_desejada_padrao: number;
  imposto_medio_sobre_vendas: number;
  // Campos mantidos para compatibilidade, mas não usados no cálculo unitário
  faturamento_mensal?: number;
  total_custos_fixos?: number;
}

export interface ResultadoPrecoSugerido {
  preco: number;
  viavel: boolean; // false se o divisor ficar <= 0 (inviável)
}

/**
 * Calcula o preço sugerido baseado na fórmula de precificação
 * 
 * IMPORTANTE: Custos fixos NÃO entram neste cálculo.
 * O preço unitário cobre: Custo dos insumos + Margem + Impostos + Taxa do Canal
 * Os custos fixos são cobertos pelo volume de vendas (verificado no Dashboard).
 * 
 * @param custoInsumos - Custo total dos ingredientes/insumos
 * @param config - Configurações do sistema (margem, impostos)
 * @param taxaCanal - Taxa percentual do canal de venda (opcional, padrão 0)
 * @returns Objeto com preço sugerido e indicador de viabilidade
 */
export function calcularPrecoSugerido(
  custoInsumos: number,
  config: ConfiguracaoPrecificacao,
  taxaCanal: number = 0
): ResultadoPrecoSugerido {
  if (custoInsumos <= 0) {
    return { preco: 0, viavel: false };
  }

  const margem = config.margem_desejada_padrao / 100;
  const imposto = config.imposto_medio_sobre_vendas / 100;
  const taxa = taxaCanal / 100;
  
  // Fórmula: Preço = Custo / (1 - Margem - Imposto - TaxaCanal)
  // NÃO inclui custo fixo - ele é coberto pelo volume de vendas
  const divisor = 1 - margem - imposto - taxa;
  
  // Se o divisor for <= 0, a precificação é inviável
  if (divisor <= 0) {
    return { preco: custoInsumos * 3, viavel: false };
  }
  
  return { preco: custoInsumos / divisor, viavel: true };
}

/**
 * Calcula métricas de rentabilidade de um produto
 * 
 * NOTA: O lucro líquido aqui é por UNIDADE vendida.
 * Os custos fixos são deduzidos no nível do negócio (Dashboard),
 * não por produto individual.
 */
export function calcularMetricasProduto(
  precoVenda: number,
  custoInsumos: number,
  config: ConfiguracaoPrecificacao,
  taxaCanal: number = 0
) {
  const percImposto = config.imposto_medio_sobre_vendas;
  
  const impostoValor = precoVenda * (percImposto / 100);
  const taxaValor = precoVenda * (taxaCanal / 100);
  
  // Custo total por unidade (sem custo fixo - ele é coberto pelo volume)
  const custoTotalVariavel = custoInsumos + impostoValor + taxaValor;
  
  // Lucro por unidade (contribuição para cobrir custos fixos + lucro)
  const lucroContribuicao = precoVenda - custoTotalVariavel;
  
  // Margem de contribuição (% do preço que sobra após custos variáveis)
  const margemContribuicao = precoVenda > 0 ? (lucroContribuicao / precoVenda) * 100 : 0;
  
  // Margem bruta (tradicional: preço - custo insumos)
  const margemBruta = precoVenda > 0 ? ((precoVenda - custoInsumos) / precoVenda) * 100 : 0;
  
  // CMV (Custo da Mercadoria Vendida)
  const cmv = precoVenda > 0 ? (custoInsumos / precoVenda) * 100 : 0;
  
  return {
    custoInsumos,
    impostoValor,
    taxaValor,
    custoTotalVariavel,
    lucroContribuicao,      // Lucro por unidade (contribuição)
    margemContribuicao,     // Margem de contribuição %
    margemBruta,
    cmv,
    // Aliases para compatibilidade
    lucroLiquido: lucroContribuicao,
    margemLiquida: margemContribuicao,
    custoTotal: custoTotalVariavel,
    custoFixoValor: 0,      // Não calculamos mais por unidade
  };
}
