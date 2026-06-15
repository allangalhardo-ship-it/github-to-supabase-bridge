/**
 * Pricing Score 0-100 — nota composta da saúde de precificação de um produto.
 *
 * Combina 3 dimensões (pesos calibrados):
 *  - Margem de contribuição vs meta (50%)
 *  - CMV vs meta (30%)
 *  - Popularidade (20%) — relativa à mediana de vendas
 *
 * Faixas:
 *  - 80-100 → Ótimo (verde)
 *  - 60-79  → Bom (amarelo)
 *  - 40-59  → Atenção (laranja)
 *  - 0-39   → Crítico (vermelho)
 */

export type ScoreFaixa = 'otimo' | 'bom' | 'atencao' | 'critico';

export interface ScoreInput {
  margemContribuicao: number;   // %
  margemAlvo: number;            // %
  cmv: number;                   // %
  cmvAlvo: number;               // %
  quantidadeVendida: number;
  medianaQuantidades: number;
}

export interface PricingScoreResult {
  score: number;            // 0-100
  faixa: ScoreFaixa;
  label: string;
  cor: string;              // classe text-*
  bgCor: string;            // classe bg-*
  detalhes: {
    margem: number;         // 0-50
    cmv: number;            // 0-30
    popularidade: number;   // 0-20
  };
}

export function calcularPricingScore(input: ScoreInput): PricingScoreResult {
  // === Margem (0-50) ===
  // Se atingiu meta: 50. Se metade da meta: 25. Negativa: 0.
  let scoreMargem = 0;
  if (input.margemAlvo > 0) {
    const ratio = input.margemContribuicao / input.margemAlvo;
    scoreMargem = Math.max(0, Math.min(1, ratio)) * 50;
  } else if (input.margemContribuicao > 0) {
    scoreMargem = 50;
  }

  // === CMV (0-30) — inverso: quanto MENOR melhor ===
  // CMV = alvo → 30. CMV = 2×alvo → 0.
  let scoreCmv = 0;
  if (input.cmvAlvo > 0 && input.cmv > 0) {
    const ratio = input.cmv / input.cmvAlvo;
    if (ratio <= 1) scoreCmv = 30;
    else if (ratio >= 2) scoreCmv = 0;
    else scoreCmv = 30 * (2 - ratio);
  } else if (input.cmv === 0) {
    scoreCmv = 30;
  }

  // === Popularidade (0-20) ===
  // Vende >= mediana → 20. Vende metade → 10. Zero → 0.
  let scorePop = 0;
  if (input.medianaQuantidades > 0) {
    const ratio = input.quantidadeVendida / input.medianaQuantidades;
    scorePop = Math.max(0, Math.min(1, ratio)) * 20;
  } else if (input.quantidadeVendida > 0) {
    scorePop = 20;
  }

  const score = Math.round(scoreMargem + scoreCmv + scorePop);
  const faixa: ScoreFaixa =
    score >= 80 ? 'otimo' :
    score >= 60 ? 'bom' :
    score >= 40 ? 'atencao' : 'critico';

  const labels: Record<ScoreFaixa, string> = {
    otimo: 'Ótimo',
    bom: 'Bom',
    atencao: 'Atenção',
    critico: 'Crítico',
  };
  const cores: Record<ScoreFaixa, string> = {
    otimo: 'text-emerald-600',
    bom: 'text-amber-600',
    atencao: 'text-orange-600',
    critico: 'text-destructive',
  };
  const bgCores: Record<ScoreFaixa, string> = {
    otimo: 'bg-emerald-500/10',
    bom: 'bg-amber-500/10',
    atencao: 'bg-orange-500/10',
    critico: 'bg-destructive/10',
  };

  return {
    score,
    faixa,
    label: labels[faixa],
    cor: cores[faixa],
    bgCor: bgCores[faixa],
    detalhes: {
      margem: Math.round(scoreMargem),
      cmv: Math.round(scoreCmv),
      popularidade: Math.round(scorePop),
    },
  };
}

/**
 * Charm pricing — arredonda valor para o próximo R$ X,90 (psicológico).
 * Ex.: 12,34 → 12,90 | 18,75 → 18,90 | 19,95 → 19,90 (mantém se já está perto)
 * | 50,10 → 50,90 (sempre arredonda pra .90 do mesmo R$ inteiro ou próximo).
 */
export function arredondarCharm(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return valor;
  const inteiro = Math.floor(valor);
  const decimal = valor - inteiro;
  // Se já está entre .85 e .95 → mantém .90 do mesmo inteiro
  if (decimal >= 0.85 && decimal <= 0.95) return inteiro + 0.9;
  // Se acima de .95 → próximo inteiro .90
  if (decimal > 0.95) return inteiro + 1 + 0.9;
  // Caso geral: sobe pro .90 do mesmo inteiro
  return inteiro + 0.9;
}
