import { describe, it, expect } from 'vitest';
import { calcularProduzir, calcularComprar } from './encomendaProducao';
import { lucroPorHora, minutosPorUnidadeProduto, rendePoucoPorHora } from './tempoPreparo';

describe('O que produzir', () => {
  it('soma 30 + 20 e desconta 10 em estoque: produzir 40', () => {
    const r = calcularProduzir([
      { data_entrega: '2026-11-20', status: 'pendente', encomenda_itens: [{ produto_id: 'p', produto_nome: 'Bolo', quantidade: 30 }] },
      { data_entrega: '2026-11-22', status: 'em_producao', encomenda_itens: [{ produto_id: 'p', produto_nome: 'Bolo', quantidade: 20 }] },
    ], { p: 10 });
    expect(r[0].produzir).toBe(40);
    expect(r[0].porDia).toEqual({ '2026-11-20': 30, '2026-11-22': 20 });
  });
  it('orçamento não entra na lista', () => {
    const r = calcularProduzir([{ data_entrega: '2026-11-20', status: 'orcamento', encomenda_itens: [{ produto_id: 'p', produto_nome: 'B', quantidade: 5 }] }], {});
    expect(r).toHaveLength(0);
  });
  it('comprar mostra só o que falta', () => {
    const ins = new Map([['farinha', { id: 'farinha', nome: 'Farinha', is_intermediario: false, rendimento_receita: null, tempo_preparo_min: null, unidade_medida: 'kg', estoque_atual: 1, fator_perda: 0, custo_unitario: 5 }]]);
    const r = calcularComprar([{ produto_id: 'p', produzir: 10, rendimento_padrao: 1 }], [{ produto_id: 'p', insumo_id: 'farinha', quantidade: 200, unidade: 'g' }], [], ins);
    expect(r[0].falta).toBeCloseTo(1);
    expect(r[0].custo).toBeCloseTo(5);
  });
});

describe('Lucro por hora', () => {
  it('receita de 60 min rendendo 20 unidades com lucro de R$ 4,00: R$ 80,00/h', () => {
    const min = minutosPorUnidadeProduto({ id: 'p', tempo_preparo_min: 60, rendimento_padrao: 20 }, [], new Map(), []);
    expect(lucroPorHora(4, min)).toBeCloseTo(80);
  });
  it('sem tempo informado não calcula nada', () => {
    expect(minutosPorUnidadeProduto({ id: 'p', tempo_preparo_min: null, rendimento_padrao: 1 }, [], new Map(), [])).toBeNull();
    expect(lucroPorHora(4, null)).toBeNull();
  });
  it('marca produto abaixo da metade da média', () => {
    expect([...rendePoucoPorHora({ a: 100, b: 100, c: 20, d: null })]).toEqual(['c']);
  });
});
