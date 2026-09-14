/**
 * Fonte única de verdade para custo e unidades de uma venda.
 *
 * Regras:
 * - Unidades vendidas = `vendas.quantidade` (nunca inferir dividindo faturamento pelo preço atual,
 *   porque desconto, promoção ou reajuste de preço distorcem a conta).
 * - Custo da venda = `vendas.custo_snapshot` (custo travado no momento da venda) quando existir;
 *   caso contrário, custo por unidade da ficha técnica atual × quantidade.
 */

export interface VendaComCusto {
  quantidade?: number | string | null;
  valor_total?: number | string | null;
  /** custo total da venda travado no momento em que ela foi registrada */
  custo_snapshot?: number | string | null;
  /** custo por unidade da ficha técnica atual (já dividido pelo rendimento) */
  custo_insumos?: number | string | null;
}

export function unidadesVenda(venda: VendaComCusto): number {
  const qtd = Number(venda.quantidade);
  return Number.isFinite(qtd) && qtd > 0 ? qtd : 0;
}

export function custoVenda(venda: VendaComCusto): number {
  const snapshot = Number(venda.custo_snapshot);
  if (Number.isFinite(snapshot) && snapshot > 0) return snapshot;

  const custoUnitario = Number(venda.custo_insumos);
  if (!Number.isFinite(custoUnitario) || custoUnitario <= 0) return 0;

  return custoUnitario * unidadesVenda(venda);
}

export function somarCustoVendas(vendas?: VendaComCusto[] | null): number {
  return (vendas || []).reduce((sum, venda) => sum + custoVenda(venda), 0);
}
