import { supabase } from '@/integrations/supabase/client';

export interface MovimentoEstoqueInput {
  empresa_id: string;
  insumo_id: string;
  tipo: 'entrada' | 'saida';
  quantidade: number;
  origem?: string;
  observacao?: string | null;
  referencia?: string | null;
  quantidade_original?: number | null;
  unidade_compra?: string | null;
  fator_conversao?: number | null;
  custo_total?: number | null;
}

/**
 * Insere um movimento de estoque com validação.
 * Garante que a quantidade seja sempre positiva (abs).
 * O tipo ('entrada' ou 'saida') define a direção do movimento.
 */
export async function inserirMovimentoEstoque(movimento: MovimentoEstoqueInput) {
  // VALIDAÇÃO: quantidade deve ser sempre positiva
  const quantidadeNormalizada = Math.abs(movimento.quantidade);
  
  if (quantidadeNormalizada <= 0) {
    throw new Error('Quantidade do movimento deve ser maior que zero');
  }

  const { error } = await supabase.from('estoque_movimentos').insert({
    empresa_id: movimento.empresa_id,
    insumo_id: movimento.insumo_id,
    tipo: movimento.tipo,
    quantidade: quantidadeNormalizada,
    origem: movimento.origem || 'manual',
    observacao: movimento.observacao || null,
    referencia: movimento.referencia || null,
    quantidade_original: movimento.quantidade_original != null 
      ? Math.abs(movimento.quantidade_original) 
      : null,
    unidade_compra: movimento.unidade_compra || null,
    fator_conversao: movimento.fator_conversao != null 
      ? Math.abs(movimento.fator_conversao) 
      : null,
    custo_total: movimento.custo_total != null 
      ? Math.abs(movimento.custo_total) 
      : null,
  });

  if (error) throw error;
  
  return { success: true };
}

/**
 * Calcula o estoque atual baseado em todos os movimentos.
 * entrada = soma, saida = subtrai
 */
export function calcularEstoqueDeMovimentos(
  movimentos: Array<{ tipo: string; quantidade: number }>
): number {
  return movimentos.reduce((acc, mov) => {
    const qty = Math.abs(Number(mov.quantidade) || 0);
    return mov.tipo === 'entrada' ? acc + qty : acc - qty;
  }, 0);
}
