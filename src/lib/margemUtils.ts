/**
 * FONTE ÚNICA de cálculo da Margem de Contribuição.
 *
 * Definição adotada no Gastro Gestor:
 *   Margem de Contribuição = Receita Bruta − CMV − Taxas de canal/app − Impostos sobre vendas
 *
 * Ou seja: TODOS os custos variáveis (inclusive imposto, que varia com a receita)
 * são deduzidos antes da margem. Somente os custos fixos ficam de fora — eles são
 * cobertos pela margem de contribuição (base do Ponto de Equilíbrio).
 *
 * Usada por: Painel (useDashboardData) e DRE Gerencial, para os dois mostrarem
 * exatamente o mesmo número no mesmo período.
 */

export interface MargemContribuicaoInput {
  receitaBruta: number;
  cmv: number;
  taxasCanais: number;
  impostos: number;
}

export interface MargemContribuicaoResultado {
  /** Receita bruta considerada */
  receitaBruta: number;
  /** Soma dos custos variáveis: CMV + taxas + impostos */
  custosVariaveis: number;
  /** Valor em R$ da margem de contribuição */
  valor: number;
  /** Margem de contribuição em % da receita bruta */
  percentual: number;
}

export function calcularMargemContribuicao({
  receitaBruta,
  cmv,
  taxasCanais,
  impostos,
}: MargemContribuicaoInput): MargemContribuicaoResultado {
  const receita = Number(receitaBruta) || 0;
  const custosVariaveis =
    (Number(cmv) || 0) + (Number(taxasCanais) || 0) + (Number(impostos) || 0);
  const valor = receita - custosVariaveis;
  const percentual = receita > 0 ? (valor / receita) * 100 : 0;

  return { receitaBruta: receita, custosVariaveis, valor, percentual };
}
