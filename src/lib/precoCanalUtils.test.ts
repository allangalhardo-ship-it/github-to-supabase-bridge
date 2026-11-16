import { describe, it, expect } from 'vitest';
import { canalPrincipal, precoEfetivo } from './precoCanalUtils';

const canais = [
  { id: 'ifood', nome: 'iFood', tipo: 'app_delivery' },
  { id: 'feira', nome: 'Feira de Sábado', tipo: 'presencial', created_at: '2026-01-01' },
  { id: 'balcao', nome: 'Balcão', tipo: 'presencial', created_at: '2026-02-01' },
];

describe('preço único do produto', () => {
  it('canal principal é o Balcão mesmo havendo outro presencial mais antigo', () => {
    expect(canalPrincipal(canais)?.id).toBe('balcao');
  });
  it('Copinho com base zerada usa o Balcão (10,64) e 20 unidades somam 212,80', () => {
    const p = { id: 'copinho', preco_venda: 0 };
    const preco = precoEfetivo(p, [{ produto_id: 'copinho', canal: 'balcao', preco: 10.64 }], canais);
    expect(preco).toBe(10.64);
    expect(Math.round(preco * 20 * 100) / 100).toBe(212.8);
  });
  it('Brownie com base 10,83 mostra o Balcão 22,09', () => {
    const p = { id: 'brownie', preco_venda: 10.83 };
    expect(precoEfetivo(p, [{ produto_id: 'brownie', canal: 'balcao', preco: 22.09 }], canais)).toBe(22.09);
  });
  it('canal escolhido tem prioridade; sem preço nele cai no Balcão', () => {
    const precos = [
      { produto_id: 'x', canal: 'balcao', preco: 20 },
      { produto_id: 'x', canal: 'ifood', preco: 28 },
    ];
    expect(precoEfetivo({ id: 'x', preco_venda: 5 }, precos, canais, 'ifood')).toBe(28);
    expect(precoEfetivo({ id: 'x', preco_venda: 5 }, precos, canais, 'feira')).toBe(20);
  });
  it('sem preço no Balcão usa o preço base', () => {
    expect(precoEfetivo({ id: 'y', preco_venda: 15 }, [], canais)).toBe(15);
  });
});
