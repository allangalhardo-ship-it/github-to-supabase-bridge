/** Entrada de venda no Caixa: valor líquido (já sem a taxa do app) quando existir e for > 0; senão, o valor total. */
export const valorCaixaVenda = (v: { valor_total: number | null; valor_liquido?: number | null }) =>
  v.valor_liquido != null && Number(v.valor_liquido) > 0 ? Number(v.valor_liquido) : Number(v.valor_total || 0);
