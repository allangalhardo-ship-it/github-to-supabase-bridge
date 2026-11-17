import { describe, it, expect } from 'vitest';
import { taxaPrevista, liquidoPedido, separarTaxasCanal, taxaEfetivaAcimaDaPrevista } from './taxaCanalUtils';

describe('taxas do canal', () => {
  it('venda online de R$ 100 com 23% + 3,2% dá líquido R$ 73,80', () => {
    const t = taxaPrevista(100, 23, 3.2, true);
    expect(t).toBe(26.2);
    expect(liquidoPedido(100, t)).toBe(73.8);
  });
  it('recebido pela loja não paga taxa online: taxa R$ 23,00', () => {
    expect(taxaPrevista(100, 23, 3.2, false)).toBe(23);
  });
  it('taxa real substitui a prevista no líquido', () => {
    expect(liquidoPedido(100, 26.2, 30)).toBe(70);
  });
  it('taxas antigas viram comissão, só "Pagamento online" é separada', () => {
    expect(separarTaxasCanal([{ nome: 'Padrão', percentual: 27 }, { nome: 'ifood', percentual: 15.5 }, { nome: 'Pagamento online', percentual: 3.2 }]))
      .toEqual({ comissao: 42.5, online: 3.2 });
  });
  it('avisa quando a taxa efetiva passa a prevista em mais de 2 p.p.', () => {
    const r = taxaEfetivaAcimaDaPrevista([{ valor_bruto: 100, taxa_entrega: 0, taxa_prevista: 23, taxa_real: 26 }], 0);
    expect(r.alerta).toBe(true);
    const ok = taxaEfetivaAcimaDaPrevista([{ valor_bruto: 100, taxa_entrega: 0, taxa_prevista: 23, taxa_real: 24.5 }], 0);
    expect(ok.alerta).toBe(false);
  });
});
