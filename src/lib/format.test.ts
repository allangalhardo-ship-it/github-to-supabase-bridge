import { describe, it, expect } from 'vitest';
import { fmtNum, formatQuantidadeBR, formatCategoriaCaixa, formatCanalLabel, parseDataLocal } from './format';

describe('formatos pt-BR', () => {
  it('percentual com vírgula', () => expect(fmtNum(23.7, 1)).toBe('23,7'));
  it('quantidade sem zeros sobrando', () => expect(formatQuantidadeBR(230)).toBe('230'));
  it('custo unitário mantém até 4 casas', () => expect(fmtNum(0.0033, 2, 4)).toBe('0,0033'));
  it('categoria do caixa legível', () => expect(formatCategoriaCaixa('taxa_plataforma')).toBe('Taxa de plataforma'));
  it('canal balcão com acento', () => expect(formatCanalLabel('balcao')).toBe('Balcão'));
  it('data da venda não volta um dia', () => expect(parseDataLocal('2026-11-12').getDate()).toBe(12));
});
