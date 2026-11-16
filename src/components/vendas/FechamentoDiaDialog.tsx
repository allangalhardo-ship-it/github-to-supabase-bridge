import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invalidateEmpresaCachesAndRefetch } from '@/lib/queryConfig';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePrecosCanais } from '@/hooks/usePrecosCanais';
import { usePrecoUnico } from '@/hooks/usePrecoUnico';
import { calcularCustoFicha } from '@/utils/custoFicha';
import { formatCurrencyBRL } from '@/lib/format';
import { GradeFechamento, canalVisivelPorPadrao, montarPedidosFechamento, resumoFechamento } from '@/lib/fechamentoDia';
import { format, subDays } from 'date-fns';
import { Minus, Plus, Search } from 'lucide-react';

interface Props { open: boolean; onOpenChange: (o: boolean) => void }

export default function FechamentoDiaDialog({ open, onOpenChange }: Props) {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const empresaId = usuario?.empresa_id;
  const { canaisConfigurados } = usePrecosCanais();
  const { precoDe } = usePrecoUnico();

  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [grade, setGrade] = useState<GradeFechamento>({});
  const [busca, setBusca] = useState('');
  const [mostrarApps, setMostrarApps] = useState(false);
  const [canalMobile, setCanalMobile] = useState('');
  const [existentes, setExistentes] = useState<string[] | null>(null);
  const [idemBase, setIdemBase] = useState('');

  useEffect(() => {
    if (!open) return;
    setData(format(new Date(), 'yyyy-MM-dd')); setGrade({}); setBusca(''); setMostrarApps(false); setExistentes(null);
    setIdemBase(crypto.randomUUID());
  }, [open]);

  const { data: produtos } = useQuery({
    queryKey: ['produtos-select', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, preco_venda, rendimento_padrao, fichas_tecnicas (quantidade, unidade, insumos (custo_unitario, unidade_medida, fator_perda))')
        .eq('ativo', true).eq('empresa_id', empresaId!).order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: maisVendidos } = useQuery({
    queryKey: ['mais-vendidos-90d', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendas').select('produto_id, quantidade')
        .eq('empresa_id', empresaId!).gte('data_venda', format(subDays(new Date(), 90), 'yyyy-MM-dd'))
        .not('produto_id', 'is', null).limit(5000);
      if (error) throw error;
      const m: Record<string, number> = {};
      (data || []).forEach(v => { m[v.produto_id!] = (m[v.produto_id!] || 0) + Number(v.quantidade || 0); });
      return m;
    },
    enabled: !!empresaId && open,
  });

  const { data: imposto } = useQuery({
    queryKey: ['config-imposto', empresaId],
    queryFn: async () => {
      const { data } = await supabase.from('configuracoes').select('imposto_medio_sobre_vendas').eq('empresa_id', empresaId!).maybeSingle();
      return Number(data?.imposto_medio_sobre_vendas || 0);
    },
    enabled: !!empresaId && open,
  });

  const todosCanais = canaisConfigurados || [];
  const canais = todosCanais.filter(c => mostrarApps || canalVisivelPorPadrao(c));
  const temApps = todosCanais.some(c => !canalVisivelPorPadrao(c));

  useEffect(() => {
    if (canais.length && !canais.some(c => c.id === canalMobile)) setCanalMobile(canais[0].id);
  }, [canais, canalMobile]);

  const produtosFech = useMemo(() => (produtos || []).map(p => ({
    id: p.id, nome: p.nome,
    preco: (canalId: string) => precoDe(p, canalId),
    custo: calcularCustoFicha((p.fichas_tecnicas || []) as any, (p as any).rendimento_padrao || 1),
  })), [produtos, precoDe]);

  const ordenados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return produtosFech.filter(p => !t || p.nome.toLowerCase().includes(t))
      .sort((a, b) => (maisVendidos?.[b.id] || 0) - (maisVendidos?.[a.id] || 0) || a.nome.localeCompare(b.nome));
  }, [produtosFech, busca, maisVendidos]);

  // Canais ocultos com quantidade continuam contando
  const pedidos = montarPedidosFechamento(grade, produtosFech, todosCanais);
  const resumo = resumoFechamento(pedidos, imposto || 0);
  const qtdDe = (c: string, p: string) => grade[c]?.[p] || 0;
  const setQtd = (c: string, p: string, q: number) =>
    setGrade(g => ({ ...g, [c]: { ...(g[c] || {}), [p]: Math.max(0, Math.floor(q || 0)) } }));

  const salvar = useMutation({
    mutationFn: async (modo: 'somar' | 'substituir' | 'novo') => {
      if (modo === 'substituir') {
        for (const id of existentes || []) {
          const { error } = await supabase.rpc('cancelar_venda_pedido' as any, { p_pedido_id: id } as any);
          if (error) throw error;
        }
      }
      for (const p of pedidos) {
        const { error } = await supabase.rpc('salvar_venda_pedido' as any, {
          p_pedido: { canal_id: p.canal.id, data_venda: data, desconto: 0, taxa_entrega: 0, origem: 'fechamento' },
          p_itens: p.itens.map(i => ({ produto_id: i.produto_id, descricao: i.descricao, quantidade: i.quantidade, preco_unitario: i.preco_unitario })),
          p_pedido_id: null,
          p_idempotency_key: idemKeyFor(idemBase, p.canal.id),
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(empresaId);
      toast({ title: 'Fechamento salvo!', description: `${pedidos.length} pedido(s) registrado(s).` });
      setExistentes(null);
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  const iniciarSalvar = async () => {
    if (!pedidos.length) { toast({ title: 'Informe ao menos uma quantidade', variant: 'destructive' }); return; }
    const { data: ex, error } = await supabase.from('vendas_pedidos').select('id')
      .eq('empresa_id', empresaId!).eq('origem', 'fechamento').eq('data_venda', data).neq('status', 'cancelado');
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    if (ex && ex.length) setExistentes(ex.map(e => e.id));
    else salvar.mutate('novo');
  };

  const fmt = formatCurrencyBRL;
  const Stepper = ({ c, p }: { c: string; p: string }) => (
    <div className="flex items-center gap-1 justify-end">
      <Button type="button" size="icon" variant="outline" className="h-9 w-9" onClick={() => setQtd(c, p, qtdDe(c, p) - 1)}><Minus className="h-4 w-4" /></Button>
      <Input type="number" inputMode="numeric" min={0} className="h-9 w-14 text-center" value={qtdDe(c, p) || ''} placeholder="0"
        onChange={e => setQtd(c, p, parseInt(e.target.value))} />
      <Button type="button" size="icon" variant="outline" className="h-9 w-9" onClick={() => setQtd(c, p, qtdDe(c, p) + 1)}><Plus className="h-4 w-4" /></Button>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0 flex flex-col max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none">
          <DialogHeader className="p-4 pb-2"><DialogTitle>Fechamento do dia</DialogTitle></DialogHeader>
          <div className="px-4 space-y-3 flex-1">
            <div className="flex flex-wrap items-end gap-3">
              <div><Label>Data</Label><Input type="date" value={data} onChange={e => setData(e.target.value)} className="w-44" /></div>
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Buscar produto" value={busca} onChange={e => setBusca(e.target.value)} />
              </div>
              {temApps && (
                <label className="flex items-center gap-2 text-sm"><Switch checked={mostrarApps} onCheckedChange={setMostrarApps} />Mostrar canais de aplicativo</label>
              )}
            </div>

            {isMobile ? (
              <>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {canais.map(c => (
                    <Button key={c.id} size="sm" variant={c.id === canalMobile ? 'default' : 'outline'} onClick={() => setCanalMobile(c.id)} className="shrink-0">{c.nome}</Button>
                  ))}
                </div>
                <div className="divide-y rounded-md border">
                  {ordenados.map(p => (
                    <div key={p.id} className="flex items-center gap-2 p-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.nome}</p>
                        <p className="text-xs text-muted-foreground">{fmt(p.preco(canalMobile))}</p>
                      </div>
                      <Stepper c={canalMobile} p={p.id} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50"><tr>
                    <th className="text-left p-2 font-medium">Produto</th>
                    {canais.map(c => <th key={c.id} className="p-2 font-medium text-right whitespace-nowrap">{c.nome}</th>)}
                  </tr></thead>
                  <tbody>
                    {ordenados.map(p => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2 max-w-[220px]"><span className="block truncate">{p.nome}</span></td>
                        {canais.map(c => (
                          <td key={c.id} className="p-1 text-right">
                            <Input type="number" inputMode="numeric" min={0} placeholder="0" className="h-8 w-16 ml-auto text-center"
                              value={qtdDe(c.id, p.id) || ''} onChange={e => setQtd(c.id, p.id, parseInt(e.target.value))}
                              title={fmt(p.preco(c.id))} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!ordenados.length && <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto encontrado.</p>}
          </div>

          <div className="sticky bottom-0 border-t bg-background p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div><p className="text-muted-foreground text-xs">Total do dia</p><p className="font-bold">{fmt(resumo.total)}</p></div>
              <div><p className="text-muted-foreground text-xs">Taxa dos canais</p><p className="font-medium">{fmt(resumo.taxaCanal)}</p></div>
              <div><p className="text-muted-foreground text-xs">Líquido</p><p className="font-medium">{fmt(resumo.liquido)}</p></div>
              <div><p className="text-muted-foreground text-xs">Lucro previsto</p><p className={`font-medium ${resumo.lucro < 0 ? 'text-destructive' : 'text-primary'}`}>{fmt(resumo.lucro)}</p></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={iniciarSalvar} disabled={salvar.isPending || !pedidos.length}>
                {salvar.isPending ? 'Salvando...' : `Salvar fechamento${pedidos.length ? ` (${pedidos.length} pedido${pedidos.length > 1 ? 's' : ''})` : ''}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!existentes} onOpenChange={o => !o && setExistentes(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Já existe fechamento neste dia</AlertDialogTitle>
            <AlertDialogDescription>
              Há {existentes?.length} pedido(s) de fechamento salvos para esta data. Somar mantém os antigos e adiciona os novos.
              Substituir cancela os antigos (o estoque volta) e grava só estes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button variant="outline" disabled={salvar.isPending} onClick={() => salvar.mutate('somar')}>Somar ao existente</Button>
            <Button variant="destructive" disabled={salvar.isPending} onClick={() => salvar.mutate('substituir')}>Substituir</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Chave estável por canal dentro da mesma abertura da janela (evita duplicar em clique duplo). */
function idemKeyFor(base: string, canalId: string): string {
  const hex = (base + canalId).replace(/-/g, '');
  let h = '';
  for (let i = 0; i < 32; i++) h += ((parseInt(hex[i] || '0', 16) ^ parseInt(hex[(i + 32) % hex.length] || '0', 16)) & 15).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
