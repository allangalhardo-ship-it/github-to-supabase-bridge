import { converterUnidade, minutosPorUnidadeProduto, type InsumoTempo, type FichaLinha, type ComposicaoLinha } from './tempoPreparo';

export interface EncItem { produto_id: string | null; produto_nome: string; quantidade: number }
export interface EncLista { data_entrega: string; status: string; encomenda_itens?: EncItem[] }

export interface LinhaProduzir {
  produto_id: string; nome: string; porDia: Record<string, number>;
  total: number; estoque: number; produzir: number;
}

/** Status que reservam produção (orçamento, entregue e cancelada ficam fora). */
export const STATUS_PRODUCAO = ['pendente', 'em_producao', 'pronta'];

export function calcularProduzir(encomendas: EncLista[], estoqueAcabado: Record<string, number>): LinhaProduzir[] {
  const mapa = new Map<string, LinhaProduzir>();
  for (const e of encomendas) {
    if (!STATUS_PRODUCAO.includes(e.status)) continue;
    for (const i of e.encomenda_itens || []) {
      if (!i.produto_id || !(Number(i.quantidade) > 0)) continue;
      const l = mapa.get(i.produto_id) || { produto_id: i.produto_id, nome: i.produto_nome, porDia: {}, total: 0, estoque: 0, produzir: 0 };
      l.porDia[e.data_entrega] = (l.porDia[e.data_entrega] || 0) + Number(i.quantidade);
      l.total += Number(i.quantidade);
      mapa.set(i.produto_id, l);
    }
  }
  return [...mapa.values()].map(l => {
    const estoque = Math.max(0, Number(estoqueAcabado[l.produto_id]) || 0);
    return { ...l, estoque, produzir: Math.max(0, l.total - estoque) };
  }).sort((a, b) => b.produzir - a.produzir || a.nome.localeCompare(b.nome));
}

export interface InsumoCompra extends InsumoTempo {
  nome: string; estoque_atual: number; fator_perda: number; custo_unitario: number;
}
export interface LinhaComprar { insumo_id: string; nome: string; unidade: string; necessario: number; estoque: number; falta: number; custo: number }

/** Explode as quantidades a produzir em insumos (com sub-receitas, perdas e estoque das receitas base). */
export function calcularComprar(
  produzir: { produto_id: string; produzir: number; rendimento_padrao?: number | null }[],
  fichas: FichaLinha[], composicao: ComposicaoLinha[], insumos: Map<string, InsumoCompra>,
  ultimoPreco: Record<string, number> = {},
): LinhaComprar[] {
  const necessario = new Map<string, number>();
  const estoqueInter = new Map<string, number>();
  const perdaDiv = (p: number) => (p >= 100 ? 1 : 1 - (p || 0) / 100);

  const explodir = (insumoId: string, qtd: number, depth: number) => {
    const ins = insumos.get(insumoId);
    if (!ins || qtd <= 0 || depth > 10) return;
    if (!ins.is_intermediario) { necessario.set(insumoId, (necessario.get(insumoId) || 0) + qtd); return; }
    const disp = estoqueInter.has(insumoId) ? estoqueInter.get(insumoId)! : Math.max(0, Number(ins.estoque_atual) || 0);
    const usado = Math.min(disp, qtd);
    estoqueInter.set(insumoId, disp - usado);
    const resto = qtd - usado;
    if (resto <= 0) return;
    const rend = Number(ins.rendimento_receita) > 0 ? Number(ins.rendimento_receita) : 1;
    for (const c of composicao.filter(c => c.insumo_id === insumoId)) {
      const ing = insumos.get(c.insumo_ingrediente_id);
      explodir(c.insumo_ingrediente_id, (Number(c.quantidade) * resto / rend) / perdaDiv(Number(ing?.fator_perda) || 0), depth + 1);
    }
  };

  for (const p of produzir) {
    if (p.produzir <= 0) continue;
    const rend = Number(p.rendimento_padrao) > 0 ? Number(p.rendimento_padrao) : 1;
    for (const f of fichas.filter(f => f.produto_id === p.produto_id)) {
      const ins = insumos.get(f.insumo_id);
      if (!ins) continue;
      const q = converterUnidade(Number(f.quantidade), f.unidade || ins.unidade_medida, ins.unidade_medida);
      explodir(f.insumo_id, (q * p.produzir / rend) / perdaDiv(Number(ins.fator_perda) || 0), 0);
    }
  }

  const linhas: LinhaComprar[] = [];
  for (const [id, nec] of necessario) {
    const ins = insumos.get(id)!;
    const estoque = Math.max(0, Number(ins.estoque_atual) || 0);
    const falta = nec - estoque;
    if (falta <= 1e-9) continue;
    const preco = ultimoPreco[id] ?? Number(ins.custo_unitario) ?? 0;
    linhas.push({ insumo_id: id, nome: ins.nome, unidade: ins.unidade_medida, necessario: nec, estoque, falta, custo: falta * preco });
  }
  return linhas.sort((a, b) => b.custo - a.custo);
}

/** Total de horas para produzir as quantidades (apenas produtos com tempo informado). */
export function horasNecessarias(
  produzir: { produto_id: string; produzir: number }[],
  produtos: Map<string, { id: string; tempo_preparo_min?: number | null; rendimento_padrao?: number | null }>,
  fichas: FichaLinha[], insumos: Map<string, InsumoTempo>, composicao: ComposicaoLinha[],
): number {
  let min = 0;
  for (const p of produzir) {
    const prod = produtos.get(p.produto_id);
    if (!prod) continue;
    const m = minutosPorUnidadeProduto(prod, fichas, insumos, composicao);
    if (m) min += m * p.produzir;
  }
  return min / 60;
}

export function textoListaCompras(linhas: LinhaComprar[], fmtQtd: (n: number) => string, fmtR: (n: number) => string, periodo: string): string {
  const total = linhas.reduce((a, l) => a + l.custo, 0);
  return [`🛒 Lista de compras — ${periodo}`, '',
    ...linhas.map(l => `• ${l.nome}: ${fmtQtd(l.falta)} ${l.unidade} (~${fmtR(l.custo)})`),
    '', `Total estimado: ${fmtR(total)}`].join('\n');
}
