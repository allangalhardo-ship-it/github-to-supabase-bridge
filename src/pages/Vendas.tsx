import React, { useState, useMemo } from 'react';
import { BotChef } from '@/components/brand/BotChef';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MobileDataView } from '@/components/ui/mobile-data-view';
import { Plus, Package, Filter, DollarSign, ShoppingCart, AlertTriangle, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ImportarVendasDialog from '@/components/vendas/ImportarVendasDialog';
import VendaRapidaDialog, { PedidoParaEditar } from '@/components/vendas/VendaRapidaDialog';
import PedidoDetalheDialog, { PedidoLista, ORIGEM_LABEL } from '@/components/vendas/PedidoDetalheDialog';
import { formatCurrencyBRL, parseDataLocal } from '@/lib/format';
import { usePrecosCanais } from '@/hooks/usePrecosCanais';
import ContextualTip from '@/components/onboarding/ContextualTip';

const Vendas = () => {
  const { usuario } = useAuth();
  const [vendaRapidaAberta, setVendaRapidaAberta] = useState(false);
  const [pedidoEditar, setPedidoEditar] = useState<PedidoParaEditar | null>(null);
  const [pedidoAberto, setPedidoAberto] = useState<PedidoLista | null>(null);

  const [filtroDataInicio, setFiltroDataInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filtroDataFim, setFiltroDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [filtroProduto, setFiltroProduto] = useState<string>('todos');
  const [filtroCanal, setFiltroCanal] = useState<string>('todos');
  const [filtroOrigem, setFiltroOrigem] = useState<string>('todos');

  const { canaisConfigurados } = usePrecosCanais();

  const { data: produtos } = useQuery({
    queryKey: ['produtos-filtro-vendas', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('produtos').select('id, nome').eq('empresa_id', usuario!.empresa_id).order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Uma linha por pedido, com seus itens
  const { data: pedidos, isLoading } = useQuery({
    queryKey: ['vendas', 'pedidos', usuario?.empresa_id, filtroDataInicio, filtroDataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas_pedidos' as any)
        .select('*, canais_venda (nome), clientes (nome), vendas (id, produto_id, descricao_produto, quantidade, preco_unitario, valor_total, produtos (nome))')
        .eq('empresa_id', usuario!.empresa_id)
        .gte('data_venda', filtroDataInicio)
        .lte('data_venda', filtroDataFim)
        .order('data_venda', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as unknown as PedidoLista[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Pedidos de qualquer data com canal para revisar
  const { data: qtdRevisar } = useQuery({
    queryKey: ['vendas', 'revisar-canal', usuario?.empresa_id],
    queryFn: async () => {
      const { count } = await supabase.from('vendas_pedidos' as any).select('id', { count: 'exact', head: true })
        .eq('empresa_id', usuario!.empresa_id).is('canal_id', null);
      return count || 0;
    },
    enabled: !!usuario?.empresa_id,
  });

  const filtrados = useMemo(() => (pedidos || []).filter(p => {
    if (filtroProduto !== 'todos' && !p.vendas.some(v => v.produto_id === filtroProduto)) return false;
    if (filtroCanal === 'revisar' && p.canal_id) return false;
    if (filtroCanal !== 'todos' && filtroCanal !== 'revisar' && p.canal_id !== filtroCanal) return false;
    if (filtroOrigem !== 'todos' && p.origem !== filtroOrigem) return false;
    return true;
  }), [pedidos, filtroProduto, filtroCanal, filtroOrigem]);

  const totais = useMemo(() => ({
    totalValor: filtrados.reduce((a, p) => a + Number(p.valor_bruto), 0),
    totalLiquido: filtrados.reduce((a, p) => a + Number(p.valor_liquido), 0),
    totalVendas: filtrados.length,
    totalQuantidade: filtrados.reduce((a, p) => a + p.vendas.reduce((b, v) => b + Number(v.quantidade), 0), 0),
  }), [filtrados]);

  const pagination = usePagination(filtrados, { pageSize: 30 });
  const origens = useMemo(() => Array.from(new Set((pedidos || []).map(p => p.origem))), [pedidos]);
  const fmt = formatCurrencyBRL;
  const nomeItens = (p: PedidoLista) => p.vendas.map(v => `${Number(v.quantidade)}× ${v.produtos?.nome || v.descricao_produto || 'Item'}`).join(', ');
  const canalNome = (p: PedidoLista) => p.canais_venda?.nome || p.canal_texto || 'Sem canal';

  const abrirEdicao = (p: PedidoLista) => {
    setPedidoAberto(null);
    setPedidoEditar({
      id: p.id, canal_id: p.canal_id, cliente_id: p.cliente_id, forma_pagamento: p.forma_pagamento,
      data_venda: p.data_venda, desconto: Number(p.desconto), taxa_entrega: Number(p.taxa_entrega),
      itens: p.vendas.map(v => ({
        id: v.id, produto_id: v.produto_id, descricao: v.produtos?.nome || v.descricao_produto || 'Item',
        quantidade: Number(v.quantidade),
        preco_unitario: Number(v.preco_unitario ?? (Number(v.quantidade) > 0 ? Number(v.valor_total) / Number(v.quantidade) : 0)),
      })),
    });
    setVendaRapidaAberta(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <ContextualTip
        tipKey="vendas-intro"
        title="💰 Registre suas vendas e veja o lucro!"
        description="Cada venda registrada alimenta seus relatórios de faturamento, margem e lucro. Quanto mais dados, mais preciso fica o seu painel!"
      />
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <BotChef mood="celebrando" size="sm" float className="shrink-0 -my-2" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Vendas</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Registre e acompanhe suas vendas</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setPedidoEditar(null); setVendaRapidaAberta(true); }}>
            <Plus className="mr-2 h-4 w-4" />Nova Venda
          </Button>
          <ImportarVendasDialog />
        </div>
      </div>

      {!!qtdRevisar && (
        <button type="button" onClick={() => { setFiltroCanal('revisar'); setFiltroDataInicio('2000-01-01'); }}
          className="w-full text-left rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{qtdRevisar} {qtdRevisar === 1 ? 'venda está' : 'vendas estão'} com canal para revisar. Toque para ver.</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      <div className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-2.5 sm:p-4 flex flex-col items-center text-center gap-1">
              <div className="p-1.5 sm:p-2 rounded-full bg-primary/10"><DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /></div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
              <p className="text-xs sm:text-lg font-bold text-primary truncate max-w-full">{fmt(totais.totalValor)}</p>
              <p className="text-[10px] text-muted-foreground truncate max-w-full">Líq. {fmt(totais.totalLiquido)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 sm:p-4 flex flex-col items-center text-center gap-1">
              <div className="p-1.5 sm:p-2 rounded-full bg-muted"><ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" /></div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Vendas</p>
              <p className="text-sm sm:text-lg font-bold">{totais.totalVendas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2.5 sm:p-4 flex flex-col items-center text-center gap-1">
              <div className="p-1.5 sm:p-2 rounded-full bg-muted"><Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" /></div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Itens</p>
              <p className="text-sm sm:text-lg font-bold">{totais.totalQuantidade}</p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Filtros</span>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} className="h-9 text-sm flex-1" />
            <span className="text-muted-foreground text-xs shrink-0">a</span>
            <Input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} className="h-9 text-sm flex-1" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Select value={filtroProduto} onValueChange={setFiltroProduto}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {produtos?.map(p => <SelectItem key={p.id} value={p.id}><span className="truncate">{p.nome}</span></SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroCanal} onValueChange={setFiltroCanal}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Canal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(canaisConfigurados || []).map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                <SelectItem value="revisar">Sem canal (revisar)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Origem" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {origens.map(o => <SelectItem key={o} value={o}>{ORIGEM_LABEL[o] || o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? <Skeleton className="h-96" /> : (
          <>
            <MobileDataView
              data={pagination.paginatedData}
              keyExtractor={(p) => p.id}
              columns={[
                { key: 'data', header: 'Data', mobilePriority: 2, render: (p) => (
                  <span className="text-muted-foreground whitespace-nowrap text-xs sm:text-sm">{format(parseDataLocal(p.data_venda), 'dd/MM/yy', { locale: ptBR })}</span>
                )},
                { key: 'itens', header: 'Itens', mobilePriority: 1, render: (p) => (
                  <span className="font-medium truncate block max-w-[140px] sm:max-w-[280px]">{nomeItens(p)}</span>
                )},
                { key: 'canal', header: 'Canal', mobilePriority: 5, hideOnMobile: true, render: (p) => (
                  <div className="min-w-0">
                    <Badge variant={p.canal_id ? 'secondary' : 'destructive'} className="text-[10px] px-1.5 py-0 truncate max-w-[100px]">{canalNome(p)}</Badge>
                    {p.clientes?.nome && <span className="block text-[10px] text-muted-foreground truncate max-w-[100px]">{p.clientes.nome}</span>}
                  </div>
                )},
                { key: 'valor', header: 'Total', align: 'right', mobilePriority: 3, render: (p) => (
                  <span className="font-medium whitespace-nowrap text-xs sm:text-sm">{fmt(Number(p.valor_bruto))}</span>
                )},
                { key: 'liquido', header: 'Líquido', align: 'right', mobilePriority: 7, hideOnMobile: true, render: (p) => (
                  Number(p.valor_liquido) === Number(p.valor_bruto)
                    ? <span className="text-xs text-muted-foreground">-</span>
                    : <span className="font-medium whitespace-nowrap text-xs text-success">{fmt(Number(p.valor_liquido))}</span>
                )},
                { key: 'origem', header: 'Origem', mobilePriority: 6, hideOnMobile: true, render: (p) => (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ORIGEM_LABEL[p.origem] || p.origem}</Badge>
                )},
              ]}
              renderActions={(p) => (
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Abrir venda" onClick={() => setPedidoAberto(p)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              renderMobileHeader={(p) => <span className="truncate block max-w-[180px]">{nomeItens(p)}</span>}
              renderMobileSubtitle={(p) => (
                <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                  <span className="text-xs whitespace-nowrap">{format(parseDataLocal(p.data_venda), 'dd/MM/yy', { locale: ptBR })}</span>
                  <Badge variant={p.canal_id ? 'secondary' : 'destructive'} className="text-[10px] px-1.5 py-0 truncate max-w-[80px] shrink-0">{canalNome(p)}</Badge>
                  {p.clientes?.nome && <span className="text-[10px] text-muted-foreground truncate">{p.clientes.nome}</span>}
                </div>
              )}
              renderMobileHighlight={(p) => (
                <div className="text-right whitespace-nowrap shrink-0">
                  <p className="font-bold text-foreground text-sm">{fmt(Number(p.valor_bruto))}</p>
                  {Number(p.valor_liquido) !== Number(p.valor_bruto) && <p className="text-[10px] text-success">Líq: {fmt(Number(p.valor_liquido))}</p>}
                </div>
              )}
              emptyMessage={pedidos && pedidos.length > 0 ? 'Nenhuma venda corresponde aos filtros selecionados.' : 'Registre vendas manualmente ou importe do iFood.'}
              emptyAction={!pedidos || pedidos.length === 0 ? (
                <Button onClick={() => { setPedidoEditar(null); setVendaRapidaAberta(true); }}><Plus className="mr-2 h-4 w-4" />Nova Venda</Button>
              ) : undefined}
            />
            <PaginationControls
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
              totalItems={pagination.totalItems}
              onPrevPage={pagination.prevPage}
              onNextPage={pagination.nextPage}
            />
          </>
        )}
      </div>

      <VendaRapidaDialog
        open={vendaRapidaAberta}
        onOpenChange={(o) => { setVendaRapidaAberta(o); if (!o) setPedidoEditar(null); }}
        pedido={pedidoEditar}
      />
      <PedidoDetalheDialog
        pedido={pedidoAberto}
        onClose={() => setPedidoAberto(null)}
        onEditar={abrirEdicao}
        canais={(canaisConfigurados || []).map(c => ({ id: c.id, nome: c.nome }))}
      />
    </div>
  );
};

export default Vendas;
