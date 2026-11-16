import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { precoEfetivo, type CanalBasico, type PrecoCanalBasico } from '@/lib/precoCanalUtils';

/** Fornece precoDe(produto, canalId?) seguindo a regra: canal escolhido > Balcão > preço base. */
export function usePrecoUnico() {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresa_id;

  const { data: canais = [] } = useQuery({
    queryKey: ['canais-preco-unico', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('canais_venda')
        .select('id, nome, tipo, ativo, created_at')
        .eq('empresa_id', empresaId!)
        .eq('ativo', true);
      if (error) throw error;
      return (data || []) as CanalBasico[];
    },
    enabled: !!empresaId,
  });

  const { data: precos = [] } = useQuery({
    queryKey: ['todos-precos-canais', empresaId, 'preco-unico'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('precos_canais')
        .select('produto_id, canal, preco')
        .eq('empresa_id', empresaId!);
      if (error) throw error;
      return (data || []) as PrecoCanalBasico[];
    },
    enabled: !!empresaId,
  });

  const precoDe = useCallback(
    (produto: { id: string; preco_venda?: number | null }, canalId?: string | null) =>
      precoEfetivo(produto, precos, canais, canalId),
    [precos, canais],
  );

  return { precoDe, canais, precos };
}
