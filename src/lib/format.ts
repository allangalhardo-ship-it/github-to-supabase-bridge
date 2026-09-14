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
