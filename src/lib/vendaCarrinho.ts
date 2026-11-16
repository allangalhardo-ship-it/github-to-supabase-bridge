/** Regras do carrinho da venda rápida (espelham a função salvar_venda_pedido do banco). */
export interface ItemCarrinho {
  id?: string;
  produto_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  custo_unitario: number;
}

export interface ResumoCarrinho {
  subtotal: number;
  desconto: number;
  taxaEntrega: number;
  total: number;
  taxaCanal: number;
  liquido: number;
  custo: number;
  imposto: number;
  lucro: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Divide o desconto entre os itens na proporção do valor de cada um. */
export function ratearDesconto(itens: Pick<ItemCarrinho, 'quantidade' | 'preco_unitario'>[], desconto: number): number[] {
  const brutos = itens.map(i => r2(i.quantidade * i.preco_unitario));
  const soma = brutos.reduce((a, b) => a + b, 0);
  const d = Math.min(Math.max(desconto, 0), soma);
  return brutos.map(b => (soma > 0 ? r2(b - (d * b) / soma) : b));
}

export function calcularCarrinho(
  itens: ItemCarrinho[],
  opts: { desconto?: number; taxaEntrega?: number; taxaCanalPct?: number; impostoPct?: number }
): ResumoCarrinho {
  const subtotal = r2(itens.reduce((a, i) => a + i.quantidade * i.preco_unitario, 0));
  const desconto = Math.min(Math.max(opts.desconto || 0, 0), subtotal);
  const taxaEntrega = Math.max(opts.taxaEntrega || 0, 0);
  const valores = ratearDesconto(itens, desconto);
  const pct = opts.taxaCanalPct || 0;
  const taxaCanal = r2(valores.reduce((a, v) => a + r2((v * pct) / 100), 0));
  const itensLiq = r2(valores.reduce((a, v) => a + v, 0));
  const total = r2(itensLiq + taxaEntrega);
  const liquido = r2(total - taxaCanal);
  const custo = r2(itens.reduce((a, i) => a + i.quantidade * (i.custo_unitario || 0), 0));
  const imposto = r2((itensLiq * (opts.impostoPct || 0)) / 100);
  const lucro = r2(liquido - taxaEntrega - custo - imposto);
  return { subtotal, desconto, taxaEntrega, total, taxaCanal, liquido, custo, imposto, lucro };
}

/** Adiciona um produto; se já estiver no carrinho, soma +1. */
export function adicionarAoCarrinho(itens: ItemCarrinho[], novo: Omit<ItemCarrinho, 'quantidade'>): ItemCarrinho[] {
  const idx = itens.findIndex(i => i.produto_id && i.produto_id === novo.produto_id);
  if (idx >= 0) return itens.map((i, k) => (k === idx ? { ...i, quantidade: i.quantidade + 1 } : i));
  return [...itens, { ...novo, quantidade: 1 }];
}

/** Diferença de estoque ao editar: positivo = baixa a mais, negativo = devolve. */
export function diferencaEstoque(antes: { produto_id: string | null; quantidade: number }[], depois: { produto_id: string | null; quantidade: number }[]) {
  const m = new Map<string, number>();
  antes.forEach(i => i.produto_id && m.set(i.produto_id, (m.get(i.produto_id) || 0) - i.quantidade));
  depois.forEach(i => i.produto_id && m.set(i.produto_id, (m.get(i.produto_id) || 0) + i.quantidade));
  return Object.fromEntries([...m.entries()].filter(([, v]) => v !== 0));
}

/** Conta pedidos (não itens): itens do mesmo pedido contam uma vez só. */
export function contarPedidos(vendas: { id: string; pedido_id?: string | null }[] | null | undefined): number {
  if (!vendas) return 0;
  return new Set(vendas.map(v => v.pedido_id || v.id)).size;
}
