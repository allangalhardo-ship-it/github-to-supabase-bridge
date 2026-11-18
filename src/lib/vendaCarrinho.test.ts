import { describe, it, expect } from 'vitest';
import { calcularCarrinho, ratearDesconto, adicionarAoCarrinho, diferencaEstoque } from './vendaCarrinho';
import { normalizarCanal } from './canalUtils';
import { cobraTaxaPagamento, pagamentoVendaManual } from './taxaCanalUtils';

const item = (produto_id: string, quantidade: number, preco_unitario: number, custo_unitario = 0) =>
  ({ produto_id, descricao: produto_id, quantidade, preco_unitario, custo_unitario });

describe('carrinho da venda rápida', () => {
  it('Pago pelo app: R$ 100 resulta em R$ 26,20 de taxa e R$ 73,80 líquido', () => {
    const p = pagamentoVendaManual('app_delivery', 'pago_app');
    const r = calcularCarrinho([item('a', 1, 100)], { taxaCanalPct: 23 + (cobraTaxaPagamento('app_delivery', p.recebidoPor, p.forma) ? 3.2 : 0) });
    expect(r.taxaCanal).toBe(26.2);
    expect(r.liquido).toBe(73.8);
  });
  it('R$ 8,72: rodapé cobra R$ 2,28 pelo app ou R$ 2,01 na entrega', () => {
    expect(calcularCarrinho([item('a', 1, 8.72)], { taxaCanalPct: 26.2 }).taxaCanal).toBe(2.28);
    expect(calcularCarrinho([item('a', 1, 8.72)], { taxaCanalPct: 23 }).taxaCanal).toBe(2.01);
  });
  it('desconto de R$ 10 em itens de R$ 30 e R$ 70 fica 3 e 7', () => {
    expect(ratearDesconto([item('a', 1, 30), item('b', 1, 70)], 10)).toEqual([27, 63]);
  });
  it('rodapé: iFood 26,99% sobre R$ 61,90 dá taxa 16,71 e líquido 45,19', () => {
    const r = calcularCarrinho([item('a', 1, 61.9, 20)], { taxaCanalPct: 26.99 });
    expect(r.total).toBe(61.9);
    expect(r.taxaCanal).toBe(16.71);
    expect(r.liquido).toBe(45.19);
    expect(r.lucro).toBe(25.19);
  });
  it('taxa de entrega soma no total, mas não no lucro', () => {
    const r = calcularCarrinho([item('a', 2, 10, 4)], { taxaEntrega: 5 });
    expect(r.total).toBe(25);
    expect(r.lucro).toBe(12);
  });
  it('tocar duas vezes no mesmo produto soma a quantidade', () => {
    const base = { produto_id: 'a', descricao: 'A', preco_unitario: 5, custo_unitario: 1 };
    expect(adicionarAoCarrinho(adicionarAoCarrinho([], base), base)[0].quantidade).toBe(2);
  });
  it('editar 2 para 5 unidades baixa só 3; remover devolve tudo', () => {
    expect(diferencaEstoque([{ produto_id: 'a', quantidade: 2 }, { produto_id: 'b', quantidade: 1 }], [{ produto_id: 'a', quantidade: 5 }]))
      .toEqual({ a: 3, b: -1 });
  });
  it('nomes de canal equivalentes ficam iguais', () => {
    expect(normalizarCanal('Balcão')).toBe(normalizarCanal('balcao'));
    expect(normalizarCanal('Ifood')).toBe(normalizarCanal('iFood'));
  });
});
