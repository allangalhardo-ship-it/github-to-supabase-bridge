import { describe, it, expect } from 'vitest';
import { montarAReceber, dataRepasse } from './repasseUtils';

describe('a receber das plataformas', () => {
  it('venda online com prazo de 30 dias fica a receber para daqui a 30 dias', () => {
    const data = dataRepasse('2026-11-16', 30);
    expect(data).toBe('2026-12-16');
    const r = montarAReceber([{ pedido_id: 'p', canal_id: 'c', canal_nome: 'iFood', data_caixa: data, tipo: 'repasse', valor: 73.8 }], '2026-11-16');
    expect(r.total).toBe(73.8);
    expect(r.grupos[0].data).toBe('2026-12-16');
  });
  it('comissão de pedido recebido pela loja desconta R$ 23,00 do próximo repasse', () => {
    const r = montarAReceber([
      { pedido_id: 'a', canal_id: 'c', canal_nome: 'iFood', data_caixa: '2026-12-16', tipo: 'repasse', valor: 73.8 },
      { pedido_id: 'b', canal_id: 'c', canal_nome: 'iFood', data_caixa: '2026-12-16', tipo: 'desconto_repasse', valor: -23 },
    ], '2026-11-16');
    expect(r.total).toBe(50.8);
    expect(r.grupos[0].descontos).toBe(23);
  });
  it('o que já venceu e a venda em si não entram no a receber', () => {
    const r = montarAReceber([
      { pedido_id: 'a', canal_id: 'c', canal_nome: 'iFood', data_caixa: '2026-11-16', tipo: 'repasse', valor: 50 },
      { pedido_id: 'b', canal_id: 'c', canal_nome: 'iFood', data_caixa: '2026-12-01', tipo: 'venda', valor: 100 },
    ], '2026-11-16');
    expect(r.total).toBe(0);
  });
});
