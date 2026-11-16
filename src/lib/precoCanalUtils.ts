/**
 * Regra do preço único do produto: o preço do canal presencial principal
 * (Balcão) vale sempre que existir; o preco_venda (base) é o último recurso.
 */
export interface CanalBasico {
  id: string;
  nome: string;
  tipo: string;
  ativo?: boolean;
  created_at?: string;
}
export interface PrecoCanalBasico {
  produto_id: string;
  canal: string;
  preco: number;
}

export function canalPrincipal<T extends CanalBasico>(canais: T[] | undefined | null): T | undefined {
  const ativos = (canais || []).filter(c => c.ativo !== false && c.tipo === 'presencial');
  const balcao = ativos.filter(c => /^balc/i.test((c.nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
  const ordenar = (a: T, b: T) => (a.created_at || '').localeCompare(b.created_at || '');
  return [...balcao].sort(ordenar)[0] ?? [...ativos].sort(ordenar)[0];
}

/** Preço do produto num canal; sem canal informado (ou sem preço nele), usa o Balcão e por fim o preço base. */
export function precoEfetivo(
  produto: { id: string; preco_venda?: number | null },
  precos: PrecoCanalBasico[] | undefined | null,
  canais: CanalBasico[] | undefined | null,
  canalId?: string | null,
): number {
  const lista = precos || [];
  const achar = (cid?: string) => {
    if (!cid) return undefined;
    const p = lista.find(x => x.produto_id === produto.id && x.canal === cid);
    const v = Number(p?.preco);
    return p && v > 0 ? v : undefined;
  };
  return achar(canalId ?? undefined)
    ?? achar(canalPrincipal(canais)?.id)
    ?? (Number(produto.preco_venda) || 0);
}
