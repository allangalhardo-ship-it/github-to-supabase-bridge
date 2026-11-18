export interface LinhaCaixaPedido {
  pedido_id: string | null;
  canal_id: string | null;
  canal_nome: string | null;
  data_caixa: string; // yyyy-MM-dd
  tipo: 'venda' | 'repasse' | 'desconto_repasse' | 'mensalidade' | 'mensalidade_saida';
  valor: number;
}

export interface GrupoAReceber { canalId: string | null; canal: string; data: string; repasses: number; descontos: number; total: number }

/** "A receber": repasses, descontos e mensalidades com data prevista depois de hoje. */
export function montarAReceber(linhas: LinhaCaixaPedido[], hoje: string) {
  const map = new Map<string, GrupoAReceber>();
  for (const l of linhas) {
    if (l.tipo === 'venda' || l.tipo === 'mensalidade_saida' || l.data_caixa <= hoje) continue;
    const canal = l.canal_nome || 'Sem canal';
    const k = `${l.canal_id || canal}|${l.data_caixa}`;
    const g = map.get(k) || { canalId: l.canal_id, canal, data: l.data_caixa, repasses: 0, descontos: 0, total: 0 };
    const v = Number(l.valor) || 0;
    if (v >= 0) g.repasses += v; else g.descontos += -v;
    g.total = round2(g.repasses - g.descontos);
    map.set(k, g);
  }
  const grupos = [...map.values()].sort((a, b) => a.data.localeCompare(b.data) || a.canal.localeCompare(b.canal));
  return { grupos, total: round2(grupos.reduce((s, g) => s + g.total, 0)) };
}

/** Data prevista do repasse: data da venda + prazo do canal (gravada no pedido na hora da venda). */
export function dataRepasse(dataVenda: string, prazoDias: number) {
  const [y, m, d] = dataVenda.split('-').map(Number);
  const dt = new Date(y, m - 1, d + Math.max(0, prazoDias || 0));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function round2(n: number) { return Math.round(n * 100) / 100; }
