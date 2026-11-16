import { describe, it, expect } from 'vitest';
import { montarPedidosFechamento, resumoFechamento, canalVisivelPorPadrao } from './fechamentoDia';

const produtos = [
  { id: 'brig', nome: 'Brigadeiro', preco: (c: string) => (c === 'feira' ? 6 : 5), custo: 2 },
  { id: 'bolo', nome: 'Bolo', preco: () => 50, custo: 20 },
];
const canais = [
  { id: 'balcao', taxa: 0, tipo: 'presencial' },
  { id: 'feira', taxa: 0, tipo: 'proprio' },
  { id: 'ifood', taxa: 27, tipo: 'app_delivery' },
];

describe('fechamento do dia', () => {
  it('12 no Balcão e 8 na Feira geram dois pedidos e 20 unidades', () => {
    const peds = montarPedidosFechamento({ balcao: { brig: 12 }, feira: { brig: 8 } }, produtos, canais);
    expect(peds.map(p => p.canal.id)).toEqual(['balcao', 'feira']);
    expect(peds.flatMap(p => p.itens).reduce((a, i) => a + i.quantidade, 0)).toBe(20);
    expect(peds[1].itens[0].preco_unitario).toBe(6);
  });
  it('células vazias e zero não geram pedido', () => {
    expect(montarPedidosFechamento({ balcao: { brig: 0 }, ifood: {} }, produtos, canais)).toHaveLength(0);
  });
  it('rodapé soma total, taxa e líquido de todos os canais', () => {
    const r = resumoFechamento(montarPedidosFechamento({ balcao: { brig: 12 }, ifood: { bolo: 1 } }, produtos, canais), 0);
    expect(r.total).toBe(110);
    expect(r.taxaCanal).toBe(13.5);
    expect(r.liquido).toBe(96.5);
  });
  it('aplicativos ficam ocultos por padrão', () => {
    expect(canais.filter(canalVisivelPorPadrao).map(c => c.id)).toEqual(['balcao', 'feira']);
  });
});
