import { describe, it, expect } from 'vitest';
import { identificarFormato, ler99Food, lerIfoodPedidos, lerIfoodFinanceiro, cruzarIfood, lerTextoItens } from './planilhaFormatos';

describe('importação por planilha', () => {
  it('reconhece a planilha da 99Food sem escolher formato', () => {
    expect(identificarFormato(['Tipo de documento', 'Nº de retirada', 'Data do pedido', 'Ganhos do pedido'])).toBe('99food');
  });
  it('reconhece o relatório de pedidos do iFood', () => {
    expect(identificarFormato(['ID CURTO DO PEDIDO', 'DATA E HORA DO PEDIDO', 'STATUS FINAL DO PEDIDO', 'VALOR DOS ITENS (R$)'])).toBe('ifood_pedidos');
  });
  it('reconhece o relatório financeiro do iFood', () => {
    expect(identificarFormato(['Nº DO PEDIDO', 'DATA DO PEDIDO', 'COMISSÃO (R$)', 'TAXA DE TRANSAÇÃO (R$)'])).toBe('ifood_financeiro');
  });
  it('99Food: taxa real = comissão + processamento + logística', () => {
    const [p] = ler99Food([{ 'Tipo de documento': 'Ganhos', 'Nº de retirada': '123', 'Data do pedido': '05/11/2026', 'Preço total dos itens sem as ofertas': '100,00', 'Custos com comissão e distribuição': '-20,00', 'Taxa de processamento de pagamento': '-3,20', 'Forma de pagamento': 'Online' }]);
    expect(p.data).toBe('2026-11-05');
    expect(p.subtotal).toBe(100);
    expect(p.taxa_real).toBe(23.2);
    expect(p.recebido_por).toBe('plataforma');
  });
  it('iFood: cruza pedidos e financeiro pelo número do pedido', () => {
    const ped = lerIfoodPedidos([{ 'ID CURTO DO PEDIDO': 'A1', 'DATA E HORA DO PEDIDO': '05/11/2026 19:00', 'STATUS FINAL DO PEDIDO': 'CONCLUIDO', 'VALOR DOS ITENS (R$)': '50,00', 'ITENS': '2x Brigadeiro, 1x Brownie' }]);
    const fin = lerIfoodFinanceiro([{ 'Nº DO PEDIDO': 'A1', 'COMISSÃO (R$)': '-11,50', 'TAXA DE TRANSAÇÃO (R$)': '-1,60' }]);
    const { pedidos } = cruzarIfood(ped, fin);
    expect(pedidos[0].taxa_real).toBe(13.1);
    expect(pedidos[0].itens.map(i => i.produto)).toEqual(['Brigadeiro', 'Brownie']);
    expect(pedidos[0].itens.reduce((s, i) => s + i.valor_total, 0)).toBe(50);
  });
  it('pedido cancelado não entra', () => {
    expect(lerIfoodPedidos([{ 'ID CURTO DO PEDIDO': 'B', 'DATA E HORA DO PEDIDO': '05/11/2026', 'STATUS FINAL DO PEDIDO': 'CANCELADO', 'VALOR DOS ITENS (R$)': '10' }])).toHaveLength(0);
  });
  it('lê itens com valor', () => {
    expect(lerTextoItens('2x Brigadeiro (R$ 10,00); 1 x Bolo R$ 30,00')).toEqual([
      { produto: 'Brigadeiro', quantidade: 2, valor: 10 }, { produto: 'Bolo', quantidade: 1, valor: 30 },
    ]);
  });
});
