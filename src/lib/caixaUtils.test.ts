import { describe, it, expect } from 'vitest';
import { valorCaixaVenda } from './caixaUtils';

describe('valorCaixaVenda', () => {
  it('usa o líquido quando existe (iFood: bruto 61,90, taxa 16,71)', () => {
    expect(valorCaixaVenda({ valor_total: 61.9, valor_liquido: 45.19 })).toBe(45.19);
  });
  it('usa o total quando o líquido é zero ou vazio', () => {
    expect(valorCaixaVenda({ valor_total: 22.09, valor_liquido: 0 })).toBe(22.09);
    expect(valorCaixaVenda({ valor_total: 22.09, valor_liquido: null })).toBe(22.09);
  });
});
