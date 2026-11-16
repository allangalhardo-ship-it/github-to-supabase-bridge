// Regras aplicadas depois da leitura da foto (importação de vendas por foto).

export const normalizarNome = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .trim();

const normPalavras = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const RE_TAMANHO = /(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg)\b/gi;

export const extrairTamanhos = (s: string): string[] => {
  const out: string[] = [];
  const t = normPalavras((s || '').replace(/(\d),(\d)/g, '$1.$2').replace(/(\d)\.(\d)/g, '$1_$2'));
  const txt = t.replace(/_/g, '.');
  for (const m of txt.matchAll(RE_TAMANHO)) out.push(`${m[1]}${m[2].toLowerCase()}`);
  return out;
};

const palavras = (s: string) => {
  const t = normPalavras(s).replace(/\d+(?:\.\d+)?\s*(ml|l|g|kg)\b/g, ' ');
  return t.split(' ').filter(w => w.length >= 3 && !['com', 'para', 'sem', 'dos', 'das'].includes(w));
};

/** Nota de 0 a 1: palavras em comum + mesmo tamanho. */
export const pontuarSemelhanca = (nomeItem: string, nomeProduto: string): number => {
  const a = palavras(nomeItem);
  const b = palavras(nomeProduto);
  if (a.length === 0 || b.length === 0) return 0;
  let comuns = 0;
  for (const w of a) if (b.some(x => x === w || (w.length >= 4 && x.length >= 4 && (x.startsWith(w) || w.startsWith(x))))) comuns++;
  let nota = comuns / Math.max(a.length, b.length);
  const ta = extrairTamanhos(nomeItem);
  const tb = extrairTamanhos(nomeProduto);
  if (ta.length && tb.length) nota *= ta.some(t => tb.includes(t)) ? 1.5 : 0.2;
  else if (ta.length !== tb.length) nota *= 0.7;
  return Math.min(1, nota);
};

export interface ProdutoRef { id: string; nome: string }
export interface Sugestao { id: string; nome: string; nota: number }

export const sugerirProdutos = (nome: string, produtos: ProdutoRef[], limite = 3): Sugestao[] =>
  produtos
    .map(p => ({ id: p.id, nome: p.nome, nota: pontuarSemelhanca(nome, p.nome) }))
    .filter(s => s.nota > 0)
    .sort((x, y) => y.nota - x.nota)
    .slice(0, limite);

export type TipoVinculo = 'saved' | 'exact' | 'manual' | 'pendente' | 'sem_produto';

export interface MapeamentoSalvo { nome_externo: string; produto_id: string; plataforma?: string | null }

export const resolverVinculo = (
  nome: string,
  plataforma: string,
  mapeamentos: MapeamentoSalvo[],
  produtos: ProdutoRef[],
): { produto_id?: string; tipo: TipoVinculo; sugestoes: Sugestao[] } => {
  const n = normalizarNome(nome);
  const plat = (plataforma || '').toLowerCase();
  const salvos = mapeamentos.filter(m => normalizarNome(m.nome_externo) === n && produtos.some(p => p.id === m.produto_id));
  const salvo = salvos.find(m => (m.plataforma || '').toLowerCase() === plat) || salvos.find(m => !m.plataforma) || salvos[0];
  if (salvo) return { produto_id: salvo.produto_id, tipo: 'saved', sugestoes: [] };
  const igual = produtos.find(p => normalizarNome(p.nome) === n);
  if (igual) return { produto_id: igual.id, tipo: 'exact', sugestoes: [] };
  return { tipo: 'pendente', sugestoes: sugerirProdutos(nome, produtos) };
};

// ---------------- Descontos ----------------
export type QuemPaga = 'loja' | 'plataforma';

const DESCONTOS_PLATAFORMA = [
  'entrega promocional',
  'incentivos ifood', 'incentivo ifood', 'cupom ifood', 'desconto ifood',
  'desconto da plataforma', 'incentivo da plataforma', 'incentivos da plataforma',
  'cupom 99', 'desconto 99', 'incentivo 99', 'subsidio', 'rappi', 'keeta',
];
const DESCONTOS_LOJA = [
  'cobranca da loja', 'desconto da loja', 'incentivo da loja', 'incentivos da loja',
  'cupom da loja', 'desconto do restaurante', 'desconto do estabelecimento', 'desconto loja',
];

export const classificarDesconto = (texto: string): QuemPaga | null => {
  const t = normPalavras(texto);
  if (!t) return null;
  if (DESCONTOS_LOJA.some(k => t.includes(k))) return 'loja';
  if (DESCONTOS_PLATAFORMA.some(k => t.includes(k))) return 'plataforma';
  return null;
};

// ---------------- Data ----------------
const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const valida = (y: number, m: number, d: number) => {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

/** Lê "06 de jul 22:19", "28 de fev", "06/07", "06/07/2026", "2026-07-06". Sem ano: ocorrência mais recente que não está no futuro. */
export const interpretarData = (texto: string | null | undefined, hoje: Date = new Date()): string | null => {
  if (!texto) return null;
  const t = normPalavras(texto.replace(/[\/\-]/g, ' / '));
  const raw = texto.trim();
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return valida(+m[1], +m[2], +m[3]) ? iso(+m[1], +m[2], +m[3]) : null;
  let d: number | null = null, mes: number | null = null, ano: number | null = null;
  m = raw.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/);
  if (m) { d = +m[1]; mes = +m[2]; if (m[3]) ano = m[3].length === 2 ? 2000 + +m[3] : +m[3]; }
  else {
    const mm = t.match(/(\d{1,2})\s*(?:de\s*)?([a-z]{3})[a-z]*(?:\s*(?:de\s*)?(\d{4}))?/);
    if (mm && MESES[mm[2]]) { d = +mm[1]; mes = MESES[mm[2]]; if (mm[3]) ano = +mm[3]; }
  }
  if (!d || !mes) return null;
  const hojeIso = iso(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate());
  if (ano) return valida(ano, mes, d) ? iso(ano, mes, d) : null;
  for (let y = hoje.getFullYear(); y >= hoje.getFullYear() - 4; y--) {
    if (valida(y, mes, d) && iso(y, mes, d) <= hojeIso) return iso(y, mes, d);
  }
  return null;
};

// ---------------- Valores ----------------
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const calcularLiquido = (p: { subtotal: number; descontoLoja: number; taxaPct: number }) => {
  const base = Math.max(0, r2((p.subtotal || 0) - (p.descontoLoja || 0)));
  const comissao = p.taxaPct > 0 ? r2(base * p.taxaPct / 100) : 0;
  return { base, comissao, liquido: r2(base - comissao) };
};

export interface ComponenteImport { nome: string; quantidade: number; produto_id?: string; tipo: TipoVinculo }
export interface ItemImport {
  nome: string; quantidade: number; valor_total: number; selected: boolean;
  produto_id?: string; tipo: TipoVinculo; componentes?: ComponenteImport[];
}

/** Itens para o pedido: combo = linha com valor cheio; componentes = valor zero (só estoque). */
export const montarItensPedido = (itens: ItemImport[]) => {
  const out: { produto_id: string | null; quantidade: number; preco_unitario: number; descricao: string }[] = [];
  for (const it of itens) {
    if (!it.selected) continue;
    const q = it.quantidade > 0 ? it.quantidade : 1;
    out.push({ produto_id: it.produto_id || null, quantidade: q, preco_unitario: (it.valor_total || 0) / q, descricao: it.nome });
    for (const c of it.componentes || []) {
      if (!c.produto_id) continue;
      out.push({ produto_id: c.produto_id, quantidade: c.quantidade > 0 ? c.quantidade : 1, preco_unitario: 0, descricao: `${c.nome} (componente de ${it.nome})` });
    }
  }
  return out;
};

export const somarPedido = (linhas: { quantidade: number; preco_unitario: number }[]) =>
  r2(linhas.reduce((s, l) => s + r2(l.quantidade * l.preco_unitario), 0));
