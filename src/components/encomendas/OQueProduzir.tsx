import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEncomendasPeriodo } from '@/hooks/useEncomendas';
import { calcularProduzir, calcularComprar, horasNecessarias, textoListaCompras, type InsumoCompra } from '@/lib/encomendaProducao';
import type { FichaLinha, ComposicaoLinha } from '@/lib/tempoPreparo';
import { formatCurrencyBRL, formatQuantidadeBR, fmtNum } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, MessageCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const dataBR = (d: string) => d.split('-').reverse().slice(0, 2).join('/');

export default function OQueProduzir() {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresa_id;
  const [inicio, setInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [fim, setFim] = useState(format(addDays(new Date(), 6), 'yyyy-MM-dd'));
  const { data: encomendas = [], isLoading } = useEncomendasPeriodo(inicio, fim);

  const { data: base, isLoading: carregandoBase } = useQuery({
    queryKey: ['producao-base', empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const [prod, ins, cfg, mov] = await Promise.all([
        supabase.from('produtos').select('id, nome, estoque_acabado, rendimento_padrao, tempo_preparo_min').eq('empresa_id', empresaId!),
        supabase.from('insumos').select('id, nome, unidade_medida, estoque_atual, fator_perda, custo_unitario, is_intermediario, rendimento_receita, tempo_preparo_min').eq('empresa_id', empresaId!),
        supabase.from('configuracoes').select('horas_producao_semana').eq('empresa_id', empresaId!).maybeSingle(),
        supabase.from('estoque_movimentos').select('insumo_id, quantidade, custo_total, created_at').eq('empresa_id', empresaId!)
          .eq('tipo', 'entrada').gt('custo_total', 0).order('created_at', { ascending: false }).limit(1000),
      ]);
      const produtos = (prod.data || []) as any[];
      const insumos = (ins.data || []) as any[];
      const prodIds = produtos.map(p => p.id);
      const insIds = insumos.map(i => i.id);
      const [fichas, comp] = await Promise.all([
        prodIds.length ? supabase.from('fichas_tecnicas').select('produto_id, insumo_id, quantidade, unidade').in('produto_id', prodIds) : Promise.resolve({ data: [] }),
        insIds.length ? supabase.from('receitas_intermediarias').select('insumo_id, insumo_ingrediente_id, quantidade').in('insumo_id', insIds) : Promise.resolve({ data: [] }),
      ]);
      const ultimoPreco: Record<string, number> = {};
      for (const m of (mov.data || []) as any[]) {
        if (ultimoPreco[m.insumo_id] === undefined && Number(m.quantidade) > 0) ultimoPreco[m.insumo_id] = Number(m.custo_total) / Number(m.quantidade);
      }
      return {
        produtos, insumos, ultimoPreco,
        fichas: (fichas.data || []) as FichaLinha[], comp: (comp.data || []) as ComposicaoLinha[],
        horasSemana: Number((cfg.data as any)?.horas_producao_semana) || 0,
      };
    },
  });

  const calc = useMemo(() => {
    if (!base) return null;
    const estoque = Object.fromEntries(base.produtos.map(p => [p.id, Number(p.estoque_acabado) || 0]));
    const produzir = calcularProduzir(encomendas, estoque);
    const prodMap = new Map(base.produtos.map(p => [p.id, p]));
    const insMap = new Map<string, InsumoCompra>(base.insumos.map(i => [i.id, i]));
    const comprar = calcularComprar(
      produzir.map(p => ({ ...p, rendimento_padrao: prodMap.get(p.produto_id)?.rendimento_padrao })),
      base.fichas, base.comp, insMap, base.ultimoPreco);
    const horas = horasNecessarias(produzir, prodMap, base.fichas, insMap, base.comp);
    const dias = Math.max(1, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 86400000) + 1);
    const horasDisponiveis = base.horasSemana > 0 ? base.horasSemana * dias / 7 : 0;
    const datas = [...new Set(produzir.flatMap(p => Object.keys(p.porDia)))].sort();
    return { produzir, comprar, horas, horasDisponiveis, datas };
  }, [base, encomendas, inicio, fim]);

  const periodoTxt = `${dataBR(inicio)} a ${dataBR(fim)}`;
  const texto = calc ? textoListaCompras(calc.comprar, n => formatQuantidadeBR(n), formatCurrencyBRL, periodoTxt) : '';

  if (isLoading || carregandoBase || !calc) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  const totalCompra = calc.comprar.reduce((a, l) => a + l.custo, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="h-9 w-40" /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={fim} onChange={e => setFim(e.target.value)} className="h-9 w-40" /></div>
        {calc.horas > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground pb-2">
            <Clock className="h-4 w-4" /> {fmtNum(calc.horas, 1)} h de produção
            {calc.horasDisponiveis > 0 && <> · {fmtNum(calc.horasDisponiveis, 1)} h disponíveis</>}
          </div>
        )}
      </div>

      {calc.horasDisponiveis > 0 && calc.horas > calc.horasDisponiveis && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            As encomendas do período pedem {fmtNum(calc.horas, 1)} h, mas você tem {fmtNum(calc.horasDisponiveis, 1)} h disponíveis.
            Vale rever prazos ou recusar novos pedidos.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Produzir</CardTitle></CardHeader>
        <CardContent>
          {calc.produzir.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma encomenda confirmada no período.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-1.5">Produto</th>
                  {calc.datas.map(d => <th key={d} className="text-right px-2">{dataBR(d)}</th>)}
                  <th className="text-right px-2">Pedido</th><th className="text-right px-2">Em estoque</th><th className="text-right">Produzir</th>
                </tr></thead>
                <tbody>
                  {calc.produzir.map(l => (
                    <tr key={l.produto_id} className="border-b border-border/50">
                      <td className="py-1.5">{l.nome}</td>
                      {calc.datas.map(d => <td key={d} className="text-right px-2 text-muted-foreground">{l.porDia[d] ? formatQuantidadeBR(l.porDia[d]) : '—'}</td>)}
                      <td className="text-right px-2">{formatQuantidadeBR(l.total)}</td>
                      <td className="text-right px-2 text-muted-foreground">{formatQuantidadeBR(l.estoque)}</td>
                      <td className="text-right font-semibold">{formatQuantidadeBR(l.produzir)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-base">Comprar</CardTitle>
          {calc.comprar.length > 0 && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(texto); toast.success('Lista copiada!'); }}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
              </Button>
              <Button size="sm" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')}>
                <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {calc.comprar.length === 0 ? <p className="text-sm text-muted-foreground">Seu estoque cobre tudo o que precisa ser produzido. 🎉</p> : (
            <div className="space-y-1.5">
              {calc.comprar.map(l => (
                <div key={l.insumo_id} className="flex justify-between text-sm border-b border-border/50 pb-1.5">
                  <div><p>{l.nome}</p><p className="text-xs text-muted-foreground">Precisa {formatQuantidadeBR(l.necessario)} {l.unidade} · tem {formatQuantidadeBR(l.estoque)}</p></div>
                  <div className="text-right"><p className="font-semibold">{formatQuantidadeBR(l.falta)} {l.unidade}</p><p className="text-xs text-muted-foreground">~{formatCurrencyBRL(l.custo)}</p></div>
                </div>
              ))}
              <p className="text-sm font-semibold text-right pt-1">Total estimado: {formatCurrencyBRL(totalCompra)}</p>
              <p className="text-[11px] text-muted-foreground">Custo estimado pelo último preço de compra de cada insumo.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
