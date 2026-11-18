export const NOME_TAXA_ONLINE = 'Pagamento online';

/** Separa as taxas cadastradas: tudo que não é "Pagamento online" conta como comissão. */
export function separarTaxasCanal(taxas: { nome: string; percentual: number | string }[]) {
  let comissao = 0, online = 0;
  for (const t of taxas) {
    if (t.nome === NOME_TAXA_ONLINE) online += Number(t.percentual) || 0;
    else comissao += Number(t.percentual) || 0;
  }
  return { comissao: round(comissao, 4), online: round(online, 4) };
}

/** Taxa prevista em R$: comissão sempre; taxa online só se pago pela plataforma. */
export function taxaPrevista(valorItens: number, comissaoPct: number, onlinePct: number, pagoOnline: boolean) {
  return round(valorItens * (comissaoPct + (pagoOnline ? onlinePct : 0)) / 100, 2);
}

export function liquidoPedido(valorItens: number, taxaPrev: number, taxaReal?: number | null) {
  return round(valorItens - (taxaReal ?? taxaPrev), 2);
}

/** Taxa efetiva % = (taxas reais + mensalidades) ÷ vendas brutas. */
export function taxaEfetiva(bruto: number, taxasReais: number, mensalidades: number) {
  return bruto > 0 ? ((taxasReais + mensalidades) / bruto) * 100 : 0;
}

export function taxaEfetivaAcimaDaPrevista(
  pedidos: { valor_bruto: number; taxa_entrega: number; taxa_prevista: number; taxa_real: number | null }[],
  mensalidade: number,
) {
  const bruto = pedidos.reduce((s, p) => s + Number(p.valor_bruto || 0) - Number(p.taxa_entrega || 0), 0);
  const real = pedidos.reduce((s, p) => s + Number(p.taxa_real || 0), 0);
  const prev = pedidos.reduce((s, p) => s + Number(p.taxa_prevista || 0), 0);
  if (bruto <= 0) return { alerta: false, real: 0, prevista: 0 };
  const r = taxaEfetiva(bruto, real, pedidos.length ? mensalidade : 0);
  const pv = (prev / bruto) * 100;
  return { alerta: r - pv > 2, real: r, prevista: pv };
}

function round(n: number, d: number) { const f = 10 ** d; return Math.round(n * f) / f; }

/** Regra da taxa de pagamento: app delivery só quando a plataforma recebe; canal próprio só quando pago em cartão. */
export function cobraTaxaPagamento(tipoCanal: string | null | undefined, recebidoPor: string | null | undefined, formaPagamento: string | null | undefined) {
  if (tipoCanal === 'app_delivery') return recebidoPor === 'plataforma';
  return /cart|cr[eé]dito|d[eé]bito|maquin/i.test(formaPagamento || '');
}

/** Na venda manual de app, a forma explícita identifica quem recebe. */
export function pagamentoVendaManual(tipo: string | undefined, forma: string, recebidoAnterior?: string | null) {
  if (tipo !== 'app_delivery') return { recebidoPor: 'loja', forma };
  if (!forma && recebidoAnterior !== undefined) return { recebidoPor: recebidoAnterior, forma };
  return { recebidoPor: forma === 'pago_app' || !forma ? 'plataforma' : 'loja', forma: forma || 'pago_app' };
}
