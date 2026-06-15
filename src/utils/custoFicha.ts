/**
 * Fonte ÚNICA da verdade para cálculo de custo de ficha técnica no frontend.
 * Mantém paridade com a função SQL `calcular_custo_ficha(produto_id)`.
 *
 * Regras:
 *  - Considera `fichas_tecnicas.unidade` (converte para a unidade do insumo).
 *  - Considera `insumos.fator_perda` (0-99, divide o custo).
 *  - Considera `produtos.rendimento_padrao` (divide o custo total no fim).
 *  - Sub-receitas (insumos.is_intermediario): o `custo_unitario` já vem
 *    pré-calculado e atualizado pelos triggers do banco — usar direto.
 *
 * Se precisar do valor "oficial" do servidor, chame a RPC:
 *   supabase.rpc('calcular_custo_ficha', { p_produto_id: produtoId })
 */

export type UnidadeBase = 'g' | 'kg' | 'mg' | 'ml' | 'l' | 'un';

export interface FichaItem {
  quantidade: number | string | null | undefined;
  /** Unidade lançada na ficha (opcional, se null usa a do insumo) */
  unidade?: string | null;
  insumos?: {
    custo_unitario?: number | string | null;
    unidade_medida?: string | null;
    fator_perda?: number | string | null;
  } | null;
}

/** Converte quantidade entre unidades compatíveis. Lança erro se incompatível. */
export function converterUnidade(qtd: number, de?: string | null, para?: string | null): number {
  if (!Number.isFinite(qtd)) return 0;
  const a = norm(de);
  const b = norm(para);
  if (!a || !b || a === b) return qtd;

  // massa
  if (a === 'g' && b === 'kg') return qtd / 1000;
  if (a === 'kg' && b === 'g') return qtd * 1000;
  if (a === 'mg' && b === 'g') return qtd / 1000;
  if (a === 'g' && b === 'mg') return qtd * 1000;
  if (a === 'mg' && b === 'kg') return qtd / 1_000_000;
  if (a === 'kg' && b === 'mg') return qtd * 1_000_000;

  // volume
  if (a === 'ml' && b === 'l') return qtd / 1000;
  if (a === 'l' && b === 'ml') return qtd * 1000;

  throw new Error(`Conversão de unidade incompatível: ${de} → ${para}`);
}

function norm(u?: string | null): string {
  const v = (u ?? '').trim().toLowerCase();
  if (['l', 'lt', 'litro', 'litros'].includes(v)) return 'l';
  if (['un', 'unid', 'unidade', 'und', 'pç', 'pc'].includes(v)) return 'un';
  return v;
}

/** Verifica se duas unidades são conversíveis sem lançar erro */
export function unidadesCompativeis(a?: string | null, b?: string | null): boolean {
  try {
    converterUnidade(1, a, b);
    return true;
  } catch {
    return false;
  }
}

/** Custo de UMA linha da ficha (com conversão + perda). Retorna 0 se inválido. */
export function calcularCustoItem(item: FichaItem): number {
  if (!item?.insumos) return 0;
  const qtd = Number(item.quantidade) || 0;
  const custo = Number(item.insumos.custo_unitario) || 0;
  const unidInsumo = item.insumos.unidade_medida ?? null;
  const unidFicha = item.unidade ?? unidInsumo;
  const perda = Math.max(0, Math.min(99, Number(item.insumos.fator_perda) || 0));

  let qtdConv: number;
  try {
    qtdConv = converterUnidade(qtd, unidFicha, unidInsumo);
  } catch {
    // unidade incompatível: usa quantidade bruta como fallback seguro
    qtdConv = qtd;
  }
  const perdaDiv = perda >= 100 ? 1 : 1 - perda / 100;
  return (qtdConv * custo) / (perdaDiv || 1);
}

/**
 * Custo total da ficha (somatório dos itens) já dividido pelo rendimento.
 * Use `rendimento` para dividir custo total por unidade produzida.
 */
export function calcularCustoFicha(
  fichas: FichaItem[] | null | undefined,
  rendimento: number | null | undefined = 1,
): number {
  if (!Array.isArray(fichas) || fichas.length === 0) return 0;
  const total = fichas.reduce((sum, ft) => sum + calcularCustoItem(ft), 0);
  const r = Number(rendimento) || 1;
  return total / (r > 0 ? r : 1);
}
