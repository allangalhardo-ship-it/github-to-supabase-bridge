import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invalidateEmpresaCachesAndRefetch } from '@/lib/queryConfig';
import { storePendingAction } from '@/lib/offlineStorage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { usePrecosCanais } from '@/hooks/usePrecosCanais';
import { usePrecoUnico } from '@/hooks/usePrecoUnico';
import { calcularCustoFicha } from '@/utils/custoFicha';
import { formatCurrencyBRL, fmtNum } from '@/lib/format';
import { adicionarAoCarrinho, calcularCarrinho, ItemCarrinho } from '@/lib/vendaCarrinho';
import { cobraTaxaPagamento, pagamentoVendaManual } from '@/lib/taxaCanalUtils';
import { format, subDays } from 'date-fns';
import { Minus, Plus, Search, Trash2, ChevronDown, User } from 'lucide-react';

export interface PedidoParaEditar {
  id: string;
  canal_id: string | null;
  cliente_id: string | null;
  forma_pagamento: string | null;
  pagamento_recebido_por?: string | null;
  data_venda: string;
  desconto: number;
  taxa_entrega: number;
  itens: { id: string; produto_id: string | null; descricao: string; quantidade: number; preco_unitario: number }[];
}

export const FORMAS_PAGAMENTO = [
  { value: 'pago_app', label: 'Pago pelo app' },
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'outro', label: 'Outro' },
];

const ULTIMO_CANAL_KEY = 'gg-ultimo-canal-venda';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pedido?: PedidoParaEditar | null;
}

export default function VendaRapidaDialog({ open, onOpenChange, pedido }: Props) {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const empresaId = usuario?.empresa_id;
  const { canaisConfigurados } = usePrecosCanais();
  const { precoDe } = usePrecoUnico();

  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [canalId, setCanalId] = useState<string>('');
  const [clienteId, setClienteId] = useState('');
  const [forma, setForma] = useState('');
  const [desconto, setDesconto] = useState('');
  const [taxaEntrega, setTaxaEntrega] = useState('');
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [busca, setBusca] = useState('');
  const [extrasAbertos, setExtrasAbertos] = useState(false);
  const [idemKey, setIdemKey] = useState<string>(() => crypto.randomUUID());

  const { data: produtos } = useQuery({
    queryKey: ['produtos-select', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, preco_venda, rendimento_padrao, fichas_tecnicas (quantidade, unidade, insumos (custo_unitario, unidade_medida, fator_perda))')
        .eq('ativo', true)
        .eq('empresa_id', empresaId!)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: maisVendidos } = useQuery({
    queryKey: ['mais-vendidos-90d', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select('produto_id, quantidade')
        .eq('empresa_id', empresaId!)
        .gte('data_venda', format(subDays(new Date(), 90), 'yyyy-MM-dd'))
        .not('produto_id', 'is', null)
        .limit(5000);
      if (error) throw error;
      const m: Record<string, number> = {};
      (data || []).forEach(v => { m[v.produto_id!] = (m[v.produto_id!] || 0) + Number(v.quantidade || 0); });
      return m;
    },
    enabled: !!empresaId && open,
  });

  const { data: clientes } = useQuery({
    queryKey: ['clientes', empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('id, nome, whatsapp').order('nome');
      if (error) throw error;
      return data;
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

  const canais = canaisConfigurados || [];
  const canal = canais.find(c => c.id === canalId);

  const custoDe = (produtoId: string | null) => {
    const p = produtos?.find(x => x.id === produtoId);
    return p ? calcularCustoFicha((p.fichas_tecnicas || []) as any, (p as any).rendimento_padrao || 1) : 0;
  };

  // Abrir: carregar pedido em edição ou começar vazio com o último canal
  useEffect(() => {
    if (!open) return;
    if (pedido) {
      setCanalId(pedido.canal_id || '');
      setClienteId(pedido.cliente_id || '');
      setForma(pedido.pagamento_recebido_por === 'plataforma' ? 'pago_app' : pedido.forma_pagamento || '');
      setDesconto(pedido.desconto ? String(pedido.desconto) : '');
      setTaxaEntrega(pedido.taxa_entrega ? String(pedido.taxa_entrega) : '');
      setData(pedido.data_venda);
      setExtrasAbertos(!!(pedido.cliente_id || pedido.forma_pagamento || pedido.desconto || pedido.taxa_entrega));
      setItens(pedido.itens.map(i => ({ ...i, custo_unitario: 0 })));
    } else {
      setItens([]); setClienteId(''); setForma(''); setDesconto(''); setTaxaEntrega('');
      setData(format(new Date(), 'yyyy-MM-dd')); setBusca(''); setExtrasAbertos(false);
      setIdemKey(crypto.randomUUID());
      setCanalId(localStorage.getItem(ULTIMO_CANAL_KEY) || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pedido?.id]);

  // Canal padrão quando não há último usado válido
  useEffect(() => {
    if (!open || !canais.length) return;
    if (!canalId || !canais.some(c => c.id === canalId)) {
      const principal = canais.find(c => c.tipo === 'presencial') || canais[0];
      setCanalId(principal.id);
    }
  }, [open, canais, canalId]);

  // Custos dos itens carregados para edição
  useEffect(() => {
    if (!produtos) return;
    setItens(prev => prev.map(i => (i.custo_unitario ? i : { ...i, custo_unitario: custoDe(i.produto_id) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos, pedido?.id]);

  const produtosOrdenados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = (produtos || []).filter(p => !termo || p.nome.toLowerCase().includes(termo));
    return [...lista].sort((a, b) => (maisVendidos?.[b.id] || 0) - (maisVendidos?.[a.id] || 0) || a.nome.localeCompare(b.nome));
  }, [produtos, busca, maisVendidos]);

  const trocarCanal = (id: string) => {
    setCanalId(id);
    setForma(canais.find(c => c.id === id)?.tipo === 'app_delivery' ? 'pago_app' : '');
    setItens(prev => prev.map(i => {
      const p = produtos?.find(x => x.id === i.produto_id);
      return p ? { ...i, preco_unitario: precoDe(p, id) } : i;
    }));
  };

  const adicionar = (p: NonNullable<typeof produtos>[number]) => {
    setItens(prev => adicionarAoCarrinho(prev, {
      produto_id: p.id, descricao: p.nome, preco_unitario: precoDe(p, canalId), custo_unitario: custoDe(p.id),
    }));
  };

  const mudarQtd = (idx: number, delta: number) =>
    setItens(prev => prev.flatMap((i, k) => (k !== idx ? [i] : i.quantidade + delta <= 0 ? [] : [{ ...i, quantidade: i.quantidade + delta }])));

  const pagamento = pagamentoVendaManual(canal?.tipo, forma, pedido?.pagamento_recebido_por);
  const taxaAplicada = (canal?.comissao || 0) + (cobraTaxaPagamento(canal?.tipo, pagamento.recebidoPor, pagamento.forma) ? canal?.online || 0 : 0);
  const resumo = calcularCarrinho(itens, {
    desconto: parseFloat(desconto) || 0,
    taxaEntrega: parseFloat(taxaEntrega) || 0,
    taxaCanalPct: taxaAplicada,
    impostoPct: imposto || 0,
  });

  const salvar = useMutation({
    mutationFn: async (): Promise<{ queued: boolean }> => {
      const args = {
        p_pedido: {
          canal_id: canalId || null,
          cliente_id: clienteId || null,
          forma_pagamento: pagamento.forma || null,
          pagamento_recebido_por: pagamento.recebidoPor,
          data_venda: data,
          desconto: parseFloat(desconto) || 0,
          taxa_entrega: parseFloat(taxaEntrega) || 0,
          origem: 'manual',
        },
        p_itens: itens.map(i => ({ id: i.id, produto_id: i.produto_id, descricao: i.descricao, quantidade: i.quantidade, preco_unitario: i.preco_unitario })),
        p_pedido_id: pedido?.id || null,
        p_idempotency_key: pedido ? null : idemKey,
      };
      const label = `Venda ${itens.map(i => i.descricao).join(', ')}`.slice(0, 80);
      if (!pedido && !navigator.onLine) {
        await storePendingAction({ type: 'rpc', table: 'salvar_venda_pedido', data: args, label });
        return { queued: true };
      }
      const { error } = await supabase.rpc('salvar_venda_pedido' as any, args as any);
      if (error) {
        if (!pedido && /fetch|network|failed to fetch|timeout/i.test(error.message || '')) {
          await storePendingAction({ type: 'rpc', table: 'salvar_venda_pedido', data: args, label });
          return { queued: true };
        }
        throw error;
      }
      return { queued: false };
    },
    onSuccess: (r) => {
      if (canalId) localStorage.setItem(ULTIMO_CANAL_KEY, canalId);
      invalidateEmpresaCachesAndRefetch(empresaId);
      toast(r.queued
        ? { title: 'Venda guardada no aparelho', description: 'Ela entra no sistema assim que a internet voltar.' }
        : { title: pedido ? 'Venda atualizada!' : 'Venda registrada!' });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  const fmt = formatCurrencyBRL;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>{pedido ? 'Editar venda' : 'Nova venda'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {/* Canal */}
          <div className="space-y-1.5">
            <Label className="text-xs">Canal</Label>
            <div className="flex flex-wrap gap-1.5">
              {canais.map(c => (
                <Button key={c.id} type="button" size="sm" variant={c.id === canalId ? 'default' : 'outline'} className="h-8" onClick={() => trocarCanal(c.id)}>
                  {c.nome}{c.taxa > 0 && <span className="ml-1 opacity-70 text-[10px]">{fmtNum(c.taxa, 1)}%</span>}
                </Button>
              ))}
              {canais.length === 0 && <p className="text-xs text-muted-foreground">Cadastre um canal em Configurações → Canais de Venda.</p>}
            </div>
            {itens.length > 0 && <p className="text-[10px] text-muted-foreground">Ao trocar o canal, os preços dos itens voltam para o preço daquele canal.</p>}
          </div>

          {/* Produtos */}
          <div className="space-y-1.5">
            <Label className="text-xs">Forma de pagamento</Label>
            <div className="flex flex-wrap gap-1.5">
              {FORMAS_PAGAMENTO.filter(f => canal?.tipo === 'app_delivery' || f.value !== 'pago_app').map(f => (
                <Button key={f.value} type="button" size="sm" variant={pagamento.forma === f.value ? 'default' : 'outline'} className="h-8" onClick={() => setForma(f.value)}>{f.label}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto" className="pl-8 h-9" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto">
              {produtosOrdenados.map(p => {
                const noCarrinho = itens.find(i => i.produto_id === p.id);
                return (
                  <button key={p.id} type="button" onClick={() => adicionar(p)}
                    className={`text-left rounded-md border p-2 text-xs transition-colors hover:bg-muted ${noCarrinho ? 'border-primary bg-primary/5' : ''}`}>
                    <span className="block font-medium line-clamp-2">{p.nome}</span>
                    <span className="flex justify-between text-muted-foreground mt-0.5">
                      {fmt(precoDe(p, canalId))}
                      {noCarrinho && <span className="font-bold text-primary">×{noCarrinho.quantidade}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Carrinho */}
          {itens.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Itens</Label>
              {itens.map((i, idx) => (
                <div key={(i.id || '') + (i.produto_id || idx)} className="flex items-center gap-2 rounded-md border p-2">
                  <span className="flex-1 min-w-0 text-sm truncate">{i.descricao}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" size="icon" variant="outline" className="h-7 w-7" aria-label="Diminuir" onClick={() => mudarQtd(idx, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center text-sm font-medium">{i.quantidade}</span>
                    <Button type="button" size="icon" variant="outline" className="h-7 w-7" aria-label="Aumentar" onClick={() => mudarQtd(idx, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <div className="w-24 shrink-0">
                    <CurrencyInput value={String(i.preco_unitario)} onChange={(v) => setItens(prev => prev.map((x, k) => (k === idx ? { ...x, preco_unitario: parseFloat(v) || 0 } : x)))} className="h-8 text-xs" />
                  </div>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" aria-label="Remover item" onClick={() => setItens(prev => prev.filter((_, k) => k !== idx))}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          )}

          {/* Opcionais */}
          <Collapsible open={extrasAbertos} onOpenChange={setExtrasAbertos}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="px-0 text-xs">
                <ChevronDown className={`h-3.5 w-3.5 mr-1 transition-transform ${extrasAbertos ? 'rotate-180' : ''}`} />
                Cliente, desconto e entrega
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Cliente</Label>
                <SearchableSelect
                  options={[{ value: '', label: 'Sem cliente', searchTerms: 'sem cliente' },
                    ...(clientes || []).map(c => ({ value: c.id, label: c.nome, searchTerms: `${c.nome} ${c.whatsapp || ''}`, icon: <User className="h-3 w-3 text-muted-foreground" /> }))]}
                  value={clienteId} onValueChange={setClienteId}
                  placeholder="Buscar cliente..." searchPlaceholder="Digite para buscar..." emptyMessage="Nenhum cliente encontrado."
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label className="text-xs">Desconto</Label><CurrencyInput value={desconto} onChange={setDesconto} placeholder="0,00" /></div>
                <div className="space-y-1"><Label className="text-xs">Taxa de entrega</Label><CurrencyInput value={taxaEntrega} onChange={setTaxaEntrega} placeholder="0,00" /></div>
                <div className="space-y-1"><Label className="text-xs">Data</Label><Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-10" /></div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Rodapé fixo */}
        <div className="border-t bg-card px-4 py-3 space-y-2">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div><p className="text-[10px] text-muted-foreground">Total</p><p className="text-sm font-bold">{fmt(resumo.total)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Taxa canal</p><p className="text-sm text-destructive">{fmt(resumo.taxaCanal)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Líquido</p><p className="text-sm font-semibold">{fmt(resumo.liquido)}</p></div>
            <div><p className="text-[10px] text-muted-foreground">Lucro previsto</p><p className={`text-sm font-bold ${resumo.lucro >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(resumo.lucro)}</p></div>
          </div>
          <Button className="w-full" disabled={!itens.length || !canalId || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? 'Salvando...' : pedido ? 'Salvar alterações' : `Registrar venda${itens.length ? ` (${itens.reduce((a, i) => a + i.quantidade, 0)} itens)` : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
