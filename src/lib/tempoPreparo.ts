/**
 * Tempo de preparo e lucro por hora.
 * O tempo informado vale para o lote inteiro (receita base ou produto);
 * divide-se pelo rendimento para chegar ao tempo por unidade.
 * Sem tempo informado, as funções retornam null e nada novo é exibido.
 */
export interface InsumoTempo {
  id: string;
  is_intermediario: boolean;
  rendimento_receita: number | null;
  tempo_preparo_min: number | null;
  unidade_medida: string;
}
export interface FichaLinha { produto_id: string; insumo_id: string; quantidade: number; unidade: string | null }
export interface ComposicaoLinha { insumo_id: string; insumo_ingrediente_id: string; quantidade: number }

const norm = (u?: string | null) => {
  const v = (u || '').trim().toLowerCase();
  if (['l', 'lt', 'litro', 'litros'].includes(v)) return 'l';
  if (['un', 'unid', 'unidade', 'und', 'pç', 'pc'].includes(v)) return 'un';
  return v;
};
/** Mesma conversão do banco (converter_unidade); unidades incompatíveis mantêm a quantidade. */
export function converterUnidade(qtd: number, de?: string | null, para?: string | null): number {
  const a = norm(de), b = norm(para);
  if (!a || !b || a === b) return qtd;
  const f: Record<string, number> = { 'g>kg': 1e-3, 'kg>g': 1e3, 'mg>g': 1e-3, 'g>mg': 1e3, 'mg>kg': 1e-6, 'kg>mg': 1e6, 'ml>l': 1e-3, 'l>ml': 1e3 };
  return f[`${a}>${b}`] !== undefined ? qtd * f[`${a}>${b}`] : qtd;
}

/** Minutos para produzir 1 unidade do insumo (receita base), incluindo sub-receitas. */
export function minutosPorUnidadeInsumo(
  insumoId: string, insumos: Map<string, InsumoTempo>, composicao: ComposicaoLinha[], depth = 0,
): number {
  const ins = insumos.get(insumoId);
  if (!ins || !ins.is_intermediario || depth > 10) return 0;
  const rend = Number(ins.rendimento_receita) > 0 ? Number(ins.rendimento_receita) : 1;
  let lote = Number(ins.tempo_preparo_min) || 0;
  for (const c of composicao.filter(c => c.insumo_id === insumoId)) {
    lote += Number(c.quantidade) * minutosPorUnidadeInsumo(c.insumo_ingrediente_id, insumos, composicao, depth + 1);
  }
  return lote / rend;
}

/** Minutos por unidade do produto, ou null quando nenhum tempo foi informado. */
export function minutosPorUnidadeProduto(
  produto: { id: string; tempo_preparo_min?: number | null; rendimento_padrao?: number | null },
  fichas: FichaLinha[], insumos: Map<string, InsumoTempo>, composicao: ComposicaoLinha[],
): number | null {
  const rend = Number(produto.rendimento_padrao) > 0 ? Number(produto.rendimento_padrao) : 1;
  let lote = Number(produto.tempo_preparo_min) || 0;
  for (const f of fichas.filter(f => f.produto_id === produto.id)) {
    const ins = insumos.get(f.insumo_id);
    if (!ins?.is_intermediario) continue;
    const qtd = converterUnidade(Number(f.quantidade), f.unidade || ins.unidade_medida, ins.unidade_medida);
    lote += qtd * minutosPorUnidadeInsumo(f.insumo_id, insumos, composicao);
  }
  return lote > 0 ? lote / rend : null;
}

/** Lucro por hora = lucro por unidade ÷ tempo por unidade (em horas). */
export function lucroPorHora(lucroUnitario: number, minutosPorUnidade: number | null): number | null {
  if (!minutosPorUnidade || minutosPorUnidade <= 0) return null;
  return lucroUnitario / (minutosPorUnidade / 60);
}

/** Produtos abaixo da metade da média de lucro/hora dos produtos com tempo informado. */
export function rendePoucoPorHora(valores: Record<string, number | null>): Set<string> {
  const comTempo = Object.entries(valores).filter(([, v]) => v !== null) as [string, number][];
  if (comTempo.length < 2) return new Set();
  const media = comTempo.reduce((a, [, v]) => a + v, 0) / comTempo.length;
  return new Set(comTempo.filter(([, v]) => v < media / 2).map(([k]) => k));
}
