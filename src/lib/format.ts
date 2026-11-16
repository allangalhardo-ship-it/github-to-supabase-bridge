/**
 * Converte uma data no formato 'YYYY-MM-DD' para Date no fuso local.
 * `new Date('2026-09-14')` é interpretado como UTC e "volta um dia" no Brasil.
 */
export function parseDataLocal(value: string | Date | null | undefined): Date {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  const somenteData = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(somenteData ? `${value}T12:00:00` : value);
}

export function formatCurrencyBRL(value: number, options?: Intl.NumberFormatOptions) {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    ...options,
  }).format(safe);
}

// For unit costs like R$/g or R$/ml where values can be < 0.01
export function formatCurrencySmartBRL(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);

  let maximumFractionDigits = 2;
  if (abs > 0 && abs < 0.0001) maximumFractionDigits = 8;
  else if (abs > 0 && abs < 0.001) maximumFractionDigits = 6;
  else if (abs > 0 && abs < 0.01) maximumFractionDigits = 4;
  else if (abs > 0 && abs < 0.1) maximumFractionDigits = 3;

  return formatCurrencyBRL(safe, {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
}

/** Percentual pt-BR: 23,7% */
export function formatPercentBR(value: number, casas = 1) {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** Quantidade pt-BR sem zeros sobrando: 230, 1,5, 0,125 */
export function formatQuantidadeBR(value: number, maxCasas = 3) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: maxCasas });
}

/** Custo unitário (R$/g, R$/ml): 2 a 4 casas com vírgula. */
export function formatCustoUnitarioBRL(value: number) {
  return formatCurrencyBRL(value, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

const CANAL_LABELS: Record<string, string> = {
  balcao: 'Balcão', 'balcão': 'Balcão', ifood: 'iFood', '99food': '99Food', '99': '99Food',
  whatsapp: 'WhatsApp', instagram: 'Instagram', rappi: 'Rappi', delivery: 'Delivery',
};

export function formatCanalLabel(canal: string | null | undefined) {
  if (!canal) return '-';
  return CANAL_LABELS[canal.trim().toLowerCase()] ?? canal;
}

const CATEGORIA_CAIXA_LABELS: Record<string, string> = {
  venda: 'Venda', taxa_plataforma: 'Taxa de plataforma', custo_fixo: 'Custo fixo', compra: 'Compra',
  compra_insumo: 'Compra de insumo', encomenda: 'Encomenda', pedido: 'Pedido', sinal: 'Sinal',
  estorno: 'Estorno', outros: 'Outros', taxa_entrega: 'Taxa de entrega', retirada: 'Retirada',
  aporte: 'Aporte', salario: 'Salário', imposto: 'Imposto',
};

export function formatCategoriaCaixa(cat: string | null | undefined) {
  if (!cat) return '-';
  if (CATEGORIA_CAIXA_LABELS[cat]) return CATEGORIA_CAIXA_LABELS[cat];
  if (!cat.includes('_')) return cat;
  const t = cat.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Número pt-BR com casas fixas (ou faixa min..max): 23,7 / 10,83 */
export function fmtNum(value: number | null | undefined, casas = 2, maxCasas?: number) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: maxCasas ?? casas });
}
