import { describe, it, expect } from 'vitest';
import { resolverVinculo, classificarDesconto, interpretarData, calcularLiquido, montarItensPedido, somarPedido } from './importacaoFotoRegras';

const produtos = [
  { id: 'jas', nome: 'Copo da Felicidade - Jasmine 200ml' },
  { id: 'mer300', nome: 'Copo da Felicidade Mérida (300ml)' },
  { id: 'mini', nome: 'Mini Merida' },
  { id: 'mor200', nome: 'Surpresa no Copo Morango 200ml' },
];

describe('importação por foto', () => {
  it('líquido iFood: 45,89 - 8,00 da loja, comissão 27% = 27,66 (taxa de serviço não desconta)', () => {
    expect(calcularLiquido({ subtotal: 45.89, descontoLoja: 8, taxaPct: 27 }).liquido).toBe(27.66);
  });
  it('item sem nome igual e sem ligação salva nunca liga sozinho', () => {
    const r = resolverVinculo('Surpresa no copo Morango 300ml', 'iFood', [], produtos);
    expect(r.produto_id).toBeUndefined();
    expect(r.tipo).toBe('pendente');
  });
  it('nome igual ignorando acento, maiúscula e espaço liga sozinho', () => {
    expect(resolverVinculo('Mini Mérida', 'iFood', [], produtos).produto_id).toBe('mini');
  });
  it('ligação salva tem prioridade', () => {
    const r = resolverVinculo('Copo X', 'iFood', [{ nome_externo: 'copo x', produto_id: 'jas', plataforma: 'iFood' }], produtos);
    expect(r).toMatchObject({ produto_id: 'jas', tipo: 'saved' });
  });
  it('sugestão prefere o mesmo tamanho', () => {
    const r = resolverVinculo('Copo Felicidade Merida 300ml', 'iFood', [], produtos);
    expect(r.sugestoes[0].id).toBe('mer300');
  });
  it('descontos classificados sempre igual', () => {
    expect(classificarDesconto('Entrega promocional para cliente')).toBe('plataforma');
    expect(classificarDesconto('Incentivos iFood')).toBe('plataforma');
    expect(classificarDesconto('Incentivos e cobrança da loja')).toBe('loja');
    expect(classificarDesconto('Desconto da loja')).toBe('loja');
    expect(classificarDesconto('Cashback especial')).toBeNull();
  });
  it('data sem ano usa a ocorrência mais recente que não está no futuro', () => {
    const hoje = new Date(2026, 10, 16);
    expect(interpretarData('06 de jul 22:19', hoje)).toBe('2026-07-06');
    expect(interpretarData('28 de dez', hoje)).toBe('2025-12-28');
    expect(interpretarData('', hoje)).toBeNull();
  });
  it('combo soma exatamente o valor do combo (componentes valem zero)', () => {
    const linhas = montarItensPedido([{
      nome: 'Compre 2 Leve 4', quantidade: 1, valor_total: 79.79, selected: true, tipo: 'sem_produto',
      componentes: [
        { nome: 'Copo A 200ml', quantidade: 1, produto_id: 'jas', tipo: 'manual' },
        { nome: 'Copo B 300ml', quantidade: 1, produto_id: 'mer300', tipo: 'manual' },
      ],
    }]);
    expect(linhas).toHaveLength(3);
    expect(somarPedido(linhas)).toBe(79.79);
  });
});
