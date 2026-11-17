/**
 * Importação por planilha: identifica o formato pelo cabeçalho e transforma as linhas
 * em pedidos no mesmo formato da conferência da foto.
 */
export type FormatoPlanilha = 'ifood_pedidos' | 'ifood_financeiro' | '99food' | '99food_itens' | 'generica';

export const NOMES_FORMATO: Record<FormatoPlanilha, string> = {
  ifood_pedidos: 'iFood — relatório de pedidos',
  ifood_financeiro: 'iFood — relatório financeiro',
  '99food': '99Food — extrato de pedidos',
  '99food_itens': '99Food — itens vendidos (só resumo, não cria pedidos)',
  generica: 'Planilha genérica',
};

export interface ItemPlanilha { produto: string; quantidade: number; valor_total: number }

export interface PedidoPlanilha {
  plataforma: string;
  numero: string | null;
  data: string; // yyyy-MM-dd ou ''
  subtotal: number;
  itens: ItemPlanilha[];
  taxa_entrega: number;
  taxa_servico: number;
  desconto_loja: number;
  incentivo_plataforma: number;
  forma_pagamento: string | null;
  recebido_por: 'loja' | 'plataforma' | null;
  entrega_por: 'loja' | 'plataforma' | null;
  taxa_real: number | null;
  cancelado: boolean;
}

export type Linha = Record<string, unknown>;

export const norm = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Primeira coluna cujo nome contém todas as palavras. */
export function acharColuna(headers: string[], ...grupos: string[][]): string | null {
  const hs = headers.map(h => ({ h, n: norm(h) }));
  for (const palavras of grupos) {
    const f = hs.find(x => palavras.every(p => x.n.includes(p)));
    if (f) return f.h;
  }
  return null;
}

export function numeroBR(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function dataBR(v: unknown): string {
  if (!v) return '';
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

export function identificarFormato(headers: string[]): FormatoPlanilha {
  const n = headers.map(norm).join(' | ');
  if (n.includes('nome do item') && n.includes('volume de vendas')) return '99food_itens';
  if (n.includes('ganhos do pedido') || n.includes('n° de retirada') || n.includes('nº de retirada') || n.includes('base da comissao')) return '99food';
  const temPedido = /pedido/.test(n);
  const temFinanceiro = /comiss|repasse|transac|tarifa/.test(n);
  const temItens = /valor dos itens|itens do pedido|status final|data e hora do pedido|id curto/.test(n);
  if (temPedido && temFinanceiro && !/id curto|status final/.test(n)) return 'ifood_financeiro';
  if (temItens) return 'ifood_pedidos';
  return 'generica';
}

/** "2x Brigadeiro (R$ 10,00), 1 x Brownie" → itens. */
export function lerTextoItens(texto: string): { produto: string; quantidade: number; valor: number }[] {
  return String(texto || '').split(/[;\n]|,(?![^(]*\))/).map(p => p.trim()).filter(Boolean).map(p => {
    const q = p.match(/^(\d+(?:[.,]\d+)?)\s*x\s*/i);
    const quantidade = q ? numeroBR(q[1]) : 1;
    let resto = q ? p.slice(q[0].length) : p;
    const val = resto.match(/\(?\s*R\$\s*([\d.,]+)\s*\)?\s*$/);
    const valor = val ? numeroBR(val[1]) : 0;
    if (val) resto = resto.slice(0, val.index).trim();
    return { produto: resto.trim(), quantidade: quantidade || 1, valor };
  }).filter(i => i.produto);
}

const vazio = (plataforma: string): PedidoPlanilha => ({
  plataforma, numero: null, data: '', subtotal: 0, itens: [], taxa_entrega: 0, taxa_servico: 0,
  desconto_loja: 0, incentivo_plataforma: 0, forma_pagamento: null, recebido_por: null, entrega_por: null,
  taxa_real: null, cancelado: false,
});

const CANCELADO = /cancel|recus|rejeit/;
const PAGO_NA_ENTREGA = /entrega|dinheiro|maquin|offline|na loja/;

function recebidoPorPagamento(texto: string): 'loja' | 'plataforma' | null {
  const t = norm(texto);
  if (!t) return null;
  if (/online|pelo app|pix online|cartao de credito online|carteira/.test(t)) return 'plataforma';
  if (PAGO_NA_ENTREGA.test(t)) return 'loja';
  return 'plataforma';
}

export function lerIfoodPedidos(linhas: Linha[]): PedidoPlanilha[] {
  if (!linhas.length) return [];
  const h = Object.keys(linhas[0]);
  const cNum = acharColuna(h, ['id curto'], ['numero', 'pedido'], ['n', 'pedido'], ['id', 'pedido']);
  const cData = acharColuna(h, ['data e hora'], ['data', 'pedido'], ['data']);
  const cStatus = acharColuna(h, ['status']);
  const cItensValor = acharColuna(h, ['valor dos itens'], ['subtotal'], ['valor', 'itens']);
  const cItens = acharColuna(h, ['itens do pedido'], ['itens'], ['produtos']);
  const cEntrega = acharColuna(h, ['taxa de entrega']);
  const cServico = acharColuna(h, ['taxa de servico']);
  const cIncLoja = acharColuna(h, ['incentivo', 'loja'], ['desconto', 'loja']);
  const cIncPlat = acharColuna(h, ['incentivo', 'ifood'], ['desconto', 'ifood']);
  const cPag = acharColuna(h, ['tipo de pagamento'], ['forma de pagamento'], ['pagamento']);
  const cFormaPag = acharColuna(h, ['forma de pagamento'], ['meio de pagamento']);
  const cTipoEntrega = acharColuna(h, ['tipo de entrega'], ['entrega', 'responsavel'], ['logistica']);
  return linhas.map(l => {
    const p = vazio('iFood');
    p.numero = cNum ? String(l[cNum] ?? '').trim() || null : null;
    p.data = cData ? dataBR(l[cData]) : '';
    p.cancelado = cStatus ? CANCELADO.test(norm(l[cStatus])) : false;
    p.subtotal = cItensValor ? numeroBR(l[cItensValor]) : 0;
    p.taxa_entrega = cEntrega ? Math.abs(numeroBR(l[cEntrega])) : 0;
    p.taxa_servico = cServico ? Math.abs(numeroBR(l[cServico])) : 0;
    p.desconto_loja = cIncLoja ? Math.abs(numeroBR(l[cIncLoja])) : 0;
    p.incentivo_plataforma = cIncPlat ? Math.abs(numeroBR(l[cIncPlat])) : 0;
    p.forma_pagamento = cFormaPag ? String(l[cFormaPag] ?? '') || null : null;
    p.recebido_por = cPag ? recebidoPorPagamento(String(l[cPag] ?? '')) : null;
    if (cTipoEntrega) {
      const t = norm(l[cTipoEntrega]);
      p.entrega_por = /propria|loja|restaurante/.test(t) ? 'loja' : t ? 'plataforma' : null;
    }
    const lidos = cItens ? lerTextoItens(String(l[cItens] ?? '')) : [];
    p.itens = montarItensComSubtotal(lidos, p.subtotal, p.numero);
    return p;
  }).filter(p => !p.cancelado && (p.subtotal > 0 || p.itens.length > 0));
}

/** Distribui o subtotal entre itens sem valor; sem itens, cria uma linha "Pedido #N" sem produto. */
function montarItensComSubtotal(lidos: { produto: string; quantidade: number; valor: number }[], subtotal: number, numero: string | null): ItemPlanilha[] {
  if (!lidos.length) return [{ produto: `Pedido ${numero ? '#' + numero : ''}`.trim(), quantidade: 1, valor_total: round2(subtotal) }];
  const somaLida = lidos.reduce((s, i) => s + i.valor, 0);
  if (somaLida > 0) return lidos.map(i => ({ produto: i.produto, quantidade: i.quantidade, valor_total: round2(i.valor) }));
  const totalQtd = lidos.reduce((s, i) => s + i.quantidade, 0) || 1;
  let resto = round2(subtotal);
  return lidos.map((i, idx) => {
    const v = idx === lidos.length - 1 ? resto : round2(subtotal * i.quantidade / totalQtd);
    resto = round2(resto - v);
    return { produto: i.produto, quantidade: i.quantidade, valor_total: v };
  });
}

/** Relatório financeiro do iFood: soma, por pedido, comissão e taxas cobradas. */
export function lerIfoodFinanceiro(linhas: Linha[]): Map<string, { taxa_real: number; data: string; subtotal: number }> {
  const out = new Map<string, { taxa_real: number; data: string; subtotal: number }>();
  if (!linhas.length) return out;
  const h = Object.keys(linhas[0]);
  const cNum = acharColuna(h, ['id curto'], ['numero', 'pedido'], ['n', 'pedido'], ['pedido']);
  const cData = acharColuna(h, ['data', 'pedido'], ['data']);
  const colsTaxa = h.filter(x => /comiss|transac|taxa de pagamento|tarifa|mensalidade do plano/.test(norm(x)) && !/base|%|percent/.test(norm(x)));
  const cDesc = acharColuna(h, ['descricao'], ['tipo de lancamento'], ['lancamento'], ['tipo']);
  const cValor = acharColuna(h, ['valor']);
  const cBruto = acharColuna(h, ['valor dos itens'], ['valor bruto'], ['total do pedido']);
  for (const l of linhas) {
    const num = cNum ? String(l[cNum] ?? '').trim() : '';
    if (!num) continue;
    const r = out.get(num) || { taxa_real: 0, data: cData ? dataBR(l[cData]) : '', subtotal: 0 };
    if (colsTaxa.length) {
      r.taxa_real += colsTaxa.reduce((s, c) => s + Math.abs(numeroBR(l[c])), 0);
    } else if (cDesc && cValor && /comiss|taxa|tarifa/.test(norm(l[cDesc]))) {
      r.taxa_real += Math.abs(numeroBR(l[cValor]));
    }
    if (cBruto) r.subtotal = Math.max(r.subtotal, numeroBR(l[cBruto]));
    r.taxa_real = round2(r.taxa_real);
    out.set(num, r);
  }
  return out;
}

export function ler99Food(linhas: Linha[]): PedidoPlanilha[] {
  const get = (l: Linha, ...nomes: string[]) => {
    const k = Object.keys(l).find(x => nomes.some(n => norm(x) === norm(n)));
    return k ? l[k] : undefined;
  };
  return linhas.filter(l => {
    const t = String(get(l, 'Tipo de documento') ?? '');
    return t.includes('Ganhos') || t === '';
  }).map(l => {
    const p = vazio('99Food');
    p.numero = String(get(l, 'Nº de retirada', 'N° de retirada') ?? '').trim() || null;
    p.data = dataBR(get(l, 'Data do pedido'));
    p.subtotal = round2(numeroBR(get(l, 'Preço total dos itens sem as ofertas')) + numeroBR(get(l, 'Taxa de pedido mínimo')));
    p.desconto_loja = round2(Math.abs(numeroBR(get(l, 'Investimento da loja em itens em oferta'))) + Math.abs(numeroBR(get(l, 'Investimento da loja em custos logísticos de ofertas'))));
    p.incentivo_plataforma = round2(Math.abs(numeroBR(get(l, 'Contribuição 99 em itens em oferta'))) + Math.abs(numeroBR(get(l, 'Contribuição 99 em custos de entrega'))) + Math.abs(numeroBR(get(l, 'Contribuição 99 em custos logísticos de ofertas'))));
    p.taxa_entrega = Math.abs(numeroBR(get(l, 'Taxa de entrega da loja')));
    p.entrega_por = p.taxa_entrega > 0 ? 'loja' : 'plataforma';
    p.forma_pagamento = String(get(l, 'Forma de pagamento') ?? '') || null;
    p.recebido_por = recebidoPorPagamento(p.forma_pagamento || '');
    p.taxa_real = round2(
      Math.abs(numeroBR(get(l, 'Custos com comissão e distribuição'))) +
      Math.abs(numeroBR(get(l, 'Taxa de processamento de pagamento'))) +
      Math.abs(numeroBR(get(l, 'Custos Logísticos'))) -
      Math.abs(numeroBR(get(l, 'Recompensa de comissão (da 99) para a loja')))
    );
    p.itens = montarItensComSubtotal([], p.subtotal, p.numero);
    return p;
  }).filter(p => p.data && p.subtotal > 0);
}

export function lerGenerica(linhas: Linha[], plataformaPadrao = ''): PedidoPlanilha[] {
  if (!linhas.length) return [];
  const h = Object.keys(linhas[0]);
  const cData = acharColuna(h, ['data'], ['date'], ['fecha']);
  const cValor = acharColuna(h, ['subtotal'], ['valor dos itens'], ['valor'], ['total']);
  const cCanal = acharColuna(h, ['canal'], ['plataforma'], ['channel']);
  const cNum = acharColuna(h, ['pedido'], ['order']);
  const cStatus = acharColuna(h, ['status'], ['estado']);
  const cItens = acharColuna(h, ['itens'], ['produto']);
  if (!cData || !cValor) return [];
  return linhas.map(l => {
    const p = vazio(cCanal ? String(l[cCanal] ?? '').trim() || plataformaPadrao : plataformaPadrao);
    p.data = dataBR(l[cData]);
    p.subtotal = round2(numeroBR(l[cValor]));
    p.numero = cNum ? String(l[cNum] ?? '').trim() || null : null;
    p.cancelado = cStatus ? CANCELADO.test(norm(l[cStatus])) : false;
    p.itens = montarItensComSubtotal(cItens ? lerTextoItens(String(l[cItens] ?? '')) : [], p.subtotal, p.numero);
    return p;
  }).filter(p => !p.cancelado && p.subtotal > 0);
}

/** Cruza pedidos e financeiro do iFood pelo número; financeiro sem pedido vira só atualização de taxa. */
export function cruzarIfood(pedidos: PedidoPlanilha[], financeiro: Map<string, { taxa_real: number; data: string; subtotal: number }>) {
  const usados = new Set<string>();
  const saida = pedidos.map(p => {
    const f = p.numero ? financeiro.get(p.numero) : undefined;
    if (f) { usados.add(p.numero!); return { ...p, taxa_real: f.taxa_real }; }
    return p;
  });
  const soFinanceiro: PedidoPlanilha[] = [];
  financeiro.forEach((f, num) => {
    if (usados.has(num)) return;
    const p = vazio('iFood');
    p.numero = num; p.data = f.data; p.subtotal = f.subtotal; p.taxa_real = f.taxa_real;
    p.itens = montarItensComSubtotal([], f.subtotal, num);
    soFinanceiro.push(p);
  });
  return { pedidos: saida, soFinanceiro };
}

function round2(n: number) { return Math.round(n * 100) / 100; }
