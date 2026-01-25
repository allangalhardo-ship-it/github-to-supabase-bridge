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
  if (abs > 0 && abs < 0.001) maximumFractionDigits = 6;
  else if (abs > 0 && abs < 0.01) maximumFractionDigits = 4;

  return formatCurrencyBRL(safe, {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
}
