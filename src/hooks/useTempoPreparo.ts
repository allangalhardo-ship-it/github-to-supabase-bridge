import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { minutosPorUnidadeProduto, type InsumoTempo, type FichaLinha, type ComposicaoLinha } from '@/lib/tempoPreparo';

/** Minutos por unidade de cada produto que tem tempo informado (direto ou pelas receitas base). */
export function useTempoPreparoProdutos() {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresa_id;
  return useQuery({
    queryKey: ['tempo-preparo-produtos', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const [prod, ins] = await Promise.all([
        supabase.from('produtos').select('id, rendimento_padrao, tempo_preparo_min').eq('empresa_id', empresaId!),
        supabase.from('insumos').select('id, is_intermediario, rendimento_receita, tempo_preparo_min, unidade_medida').eq('empresa_id', empresaId!),
      ]);
      const produtos = (prod.data || []) as any[];
      const insumos = (ins.data || []) as InsumoTempo[];
      const algumTempo = produtos.some(p => Number(p.tempo_preparo_min) > 0) || insumos.some(i => Number(i.tempo_preparo_min) > 0);
      const resultado: Record<string, number> = {};
      if (!algumTempo) return resultado;
      const interIds = insumos.filter(i => i.is_intermediario).map(i => i.id);
      const [fichas, comp] = await Promise.all([
        supabase.from('fichas_tecnicas').select('produto_id, insumo_id, quantidade, unidade').in('produto_id', produtos.map(p => p.id)),
        interIds.length ? supabase.from('receitas_intermediarias').select('insumo_id, insumo_ingrediente_id, quantidade').in('insumo_id', interIds) : Promise.resolve({ data: [] }),
      ]);
      const mapa = new Map(insumos.map(i => [i.id, i]));
      for (const p of produtos) {
        const m = minutosPorUnidadeProduto(p, (fichas.data || []) as FichaLinha[], mapa, (comp.data || []) as ComposicaoLinha[]);
        if (m) resultado[p.id] = m;
      }
      return resultado;
    },
  });
}
