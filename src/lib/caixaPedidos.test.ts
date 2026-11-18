import { describe, expect, it } from 'vitest';
import { completarMensalidades } from './caixaPedidos';
const canal = { id: 'c', nome: 'Teste', tipo: 'app_delivery', mensalidade: 50 };
const pedido = { id: 'p', canal_id: 'c', data_venda: '2026-11-18', data_repasse_prevista: '2026-12-18', pagamento_recebido_por: 'plataforma', valor_liquido: 73.8, taxa_canal: 26.2 };
describe('mensalidade nas linhas do Caixa', () => {
  it('R$ 50 desconta do repasse de R$ 73,80 em 30 dias', () => {
    expect(completarMensalidades([], [canal], [pedido])).toEqual([{ pedido_id: null, canal_id: 'c', canal_nome: 'Teste', data_caixa: '2026-12-18', tipo: 'mensalidade', valor: -50 }]);
  });
  it('dinheiro recebido pela loja: R$ 50 de saída hoje, comissão não é duplicada', () => {
    expect(completarMensalidades([], [canal], [{ ...pedido, pagamento_recebido_por: 'loja', valor_liquido: 77, taxa_canal: 23 }])).toEqual([{ pedido_id: null, canal_id: 'c', canal_nome: 'Teste', data_caixa: '2026-11-18', tipo: 'mensalidade_saida', valor: -50 }]);
  });
  it('não repete mensalidade já fornecida pelo servidor', () => {
    const linhas = [{ pedido_id: null, canal_id: 'c', canal_nome: 'Teste', data_caixa: '2026-12-18', tipo: 'mensalidade' as const, valor: -50 }];
    expect(completarMensalidades(linhas, [canal], [pedido])).toEqual(linhas);
  });
  it('repasse insuficiente de R$ 6,44: saldo da mensalidade vira saída de R$ 43,56', () => {
    const r = completarMensalidades([], [canal], [{ ...pedido, valor_liquido: 6.44 }]);
    expect(r.map(l => [l.tipo, l.valor])).toEqual([['mensalidade', -6.44], ['mensalidade_saida', -43.56]]);
  });
});