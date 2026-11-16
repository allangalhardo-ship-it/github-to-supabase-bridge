/** Regras do Fechamento do dia: grade produto x canal vira um pedido por canal. */
import { calcularCarrinho, ItemCarrinho, ResumoCarrinho } from './vendaCarrinho';

export type GradeFechamento = Record<string, Record<string, number>>; // canalId -> produtoId -> qtd

export interface ProdutoFechamento { id: string; nome: string; preco: (canalId: string) => number; custo: number }
export interface CanalFechamento { id: string; taxa: number; tipo: string }

export const canalVisivelPorPadrao = (c: { tipo: string }) => c.tipo !== 'app_delivery';

export function montarPedidosFechamento(grade: GradeFechamento, produtos: ProdutoFechamento[], canais: CanalFechamento[]) {
  return canais.flatMap(c => {
    const itens: ItemCarrinho[] = produtos
      .map(p => ({ p, q: Number(grade[c.id]?.[p.id] || 0) }))
      .filter(x => x.q > 0)
      .map(({ p, q }) => ({ produto_id: p.id, descricao: p.nome, quantidade: q, preco_unitario: p.preco(c.id), custo_unitario: p.custo }));
    return itens.length ? [{ canal: c, itens }] : [];
  });
}

export function resumoFechamento(pedidos: ReturnType<typeof montarPedidosFechamento>, impostoPct: number): ResumoCarrinho {
  const z: ResumoCarrinho = { subtotal: 0, desconto: 0, taxaEntrega: 0, total: 0, taxaCanal: 0, liquido: 0, custo: 0, imposto: 0, lucro: 0 };
  return pedidos.reduce((acc, p) => {
    const r = calcularCarrinho(p.itens, { taxaCanalPct: p.canal.taxa, impostoPct });
    (Object.keys(acc) as (keyof ResumoCarrinho)[]).forEach(k => { acc[k] = Math.round((acc[k] + r[k]) * 100) / 100; });
    return acc;
  }, z);
}
