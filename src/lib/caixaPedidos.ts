import { supabase } from '@/integrations/supabase/client';
import type { LinhaCaixaPedido } from './repasseUtils';

interface PedidoMensalidade {
  id: string; canal_id: string | null; data_venda: string; data_repasse_prevista: string | null;
  pagamento_recebido_por: string | null; valor_liquido: number; taxa_canal: number;
}
interface CanalMensalidade { id: string; nome: string; tipo: string; mensalidade: number }

/** Older deployed cash RPCs may omit monthly fee lines even when the balance RPC includes them. */
export function completarMensalidades(linhas: LinhaCaixaPedido[], canais: CanalMensalidade[], pedidos: PedidoMensalidade[]) {
  const resultado = [...linhas];
  for (const canal of canais) {
    if (canal.mensalidade <= 0) continue;
    // Never duplicate fees already supplied by the authoritative RPC.
    if (linhas.some(l => l.canal_id === canal.id && (l.tipo === 'mensalidade' || l.tipo === 'mensalidade_saida'))) continue;
    const meses = new Map<string, PedidoMensalidade[]>();
    for (const p of pedidos.filter(p => p.canal_id === canal.id)) {
      const mes = p.data_venda.slice(0, 7);
      meses.set(mes, [...(meses.get(mes) || []), p]);
    }
    for (const vendas of meses.values()) {
      const repasses = vendas.filter(p => p.pagamento_recebido_por === 'plataforma');
      const descontos = canal.tipo === 'app_delivery' ? vendas.filter(p => p.pagamento_recebido_por === 'loja').reduce((s, p) => s + Number(p.taxa_canal), 0) : 0;
      const disponivel = repasses.reduce((s, p) => s + Number(p.valor_liquido), 0) - descontos;
      const abatimento = repasses.length ? Math.min(Number(canal.mensalidade), Math.max(0, disponivel)) : 0;
      const base = { pedido_id: null, canal_id: canal.id, canal_nome: canal.nome };
      if (abatimento > 0) resultado.push({ ...base, tipo: 'mensalidade', data_caixa: repasses.map(p => p.data_repasse_prevista || p.data_venda).sort().at(-1) || '', valor: -Math.round(abatimento * 100) / 100 });
      const restante = Math.round((Number(canal.mensalidade) - abatimento) * 100) / 100;
      if (restante > 0) resultado.push({ ...base, tipo: 'mensalidade_saida', data_caixa: vendas.map(p => p.data_venda).sort().at(-1) || '', valor: -restante });
    }
  }
  return resultado;
}

export async function carregarLinhasCaixaPedidos(empresaId: string) {
  const [{ data: linhas, error }, { data: canais, error: erroCanais }] = await Promise.all([
    supabase.rpc('get_caixa_pedidos', { p_empresa_id: empresaId }),
    supabase.from('canais_venda').select('id, nome, tipo, mensalidade').eq('empresa_id', empresaId).gt('mensalidade', 0),
  ]);
  if (error) throw error;
  if (erroCanais) throw erroCanais;
  const faltantes = (canais || []).filter(c => !(linhas || []).some(l => l.canal_id === c.id && (l.tipo === 'mensalidade' || l.tipo === 'mensalidade_saida')));
  if (!faltantes.length) return (linhas || []) as LinhaCaixaPedido[];
  const pedidos: PedidoMensalidade[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error: erroPedidos } = await supabase.from('vendas_pedidos')
      .select('id, canal_id, data_venda, data_repasse_prevista, pagamento_recebido_por, valor_liquido, taxa_canal')
      .eq('empresa_id', empresaId).in('canal_id', faltantes.map(c => c.id)).order('id').range(offset, offset + 999);
    if (erroPedidos) throw erroPedidos;
    pedidos.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return completarMensalidades((linhas || []) as LinhaCaixaPedido[], faltantes, pedidos);
}