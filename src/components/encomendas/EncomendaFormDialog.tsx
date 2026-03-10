import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCanaisVenda } from '@/hooks/useCanaisVenda';
import { useClientes, ClienteFormData as ClienteForm } from '@/hooks/useClientes';
import { EncomendaFormData } from '@/hooks/useEncomendas';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, Plus, Trash2, UserPlus, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyBRL } from '@/lib/format';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EncomendaFormData) => void;
  dataPadrao?: Date;
}

interface ItemForm {
  produto_id: string | null;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  observacoes: string;
}

const itemVazio: ItemForm = {
  produto_id: null,
  produto_nome: '',
  quantidade: 1,
  preco_unitario: 0,
  observacoes: '',
};

interface ClienteDB {
  id: string;
  nome: string;
  whatsapp: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
}

export default function EncomendaFormDialog({ open, onOpenChange, onSubmit, dataPadrao }: Props) {
  const { usuario } = useAuth();
  const { canaisAtivos } = useCanaisVenda();

  // Cliente
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteWhatsapp, setClienteWhatsapp] = useState('');
  const [novoCliente, setNovoCliente] = useState(false);
  const [enderecoCadastro, setEnderecoCadastro] = useState('');
  const [usarEnderecoAlternativo, setUsarEnderecoAlternativo] = useState(false);
  const [enderecoAlternativo, setEnderecoAlternativo] = useState('');

  // Dados da encomenda
  const [dataEntrega, setDataEntrega] = useState<Date | undefined>(dataPadrao || new Date());
  const [horaEntrega, setHoraEntrega] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [valorSinal, setValorSinal] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [canalSelecionado, setCanalSelecionado] = useState('');
  const [itens, setItens] = useState<ItemForm[]>([{ ...itemVazio }]);

  // Buscar produtos com preços por canal
  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-encomenda', usuario?.empresa_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('produtos')
        .select('id, nome, preco_venda')
        .eq('empresa_id', usuario?.empresa_id!)
        .eq('ativo', true)
        .order('nome');
      return data || [];
    },
    enabled: !!usuario?.empresa_id && open,
  });

  // Buscar preços por canal
  const { data: precosCanais = [] } = useQuery({
    queryKey: ['precos-canais-encomenda', usuario?.empresa_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('precos_canais')
        .select('produto_id, canal, preco')
        .eq('empresa_id', usuario?.empresa_id!);
      return data || [];
    },
    enabled: !!usuario?.empresa_id && open,
  });

  // Buscar clientes com endereço
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-encomenda', usuario?.empresa_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, whatsapp, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade')
        .eq('empresa_id', usuario?.empresa_id!)
        .order('nome');
      return (data || []) as ClienteDB[];
    },
    enabled: !!usuario?.empresa_id && open,
  });

  // Opções para SearchableSelect de clientes
  const clienteOptions = useMemo(() =>
    clientes.map(c => ({
      value: c.id,
      label: c.nome,
      searchTerms: `${c.nome} ${c.whatsapp || ''}`,
    })), [clientes]);

  // Opções para SearchableSelect de produtos
  const produtoOptions = useMemo(() =>
    produtos.map(p => ({
      value: p.id,
      label: `${p.nome} — ${formatCurrencyBRL(p.preco_venda)}`,
      searchTerms: p.nome,
    })), [produtos]);

  // Formatar endereço do cliente
  const formatarEndereco = (c: ClienteDB): string => {
    const partes = [c.endereco_rua, c.endereco_numero, c.endereco_complemento, c.endereco_bairro, c.endereco_cidade].filter(Boolean);
    return partes.join(', ');
  };

  // Obter preço do produto pelo canal selecionado
  const getPrecoParaCanal = (produtoId: string): number => {
    if (canalSelecionado) {
      const precoCanal = precosCanais.find(p => p.produto_id === produtoId && p.canal === canalSelecionado);
      if (precoCanal) return precoCanal.preco;
    }
    const produto = produtos.find(p => p.id === produtoId);
    return produto?.preco_venda || 0;
  };

  const selecionarCliente = (id: string) => {
    const cliente = clientes.find(c => c.id === id);
    if (cliente) {
      setClienteId(id);
      setClienteNome(cliente.nome);
      setClienteWhatsapp(cliente.whatsapp || '');
      setEnderecoCadastro(formatarEndereco(cliente));
      setNovoCliente(false);
      setUsarEnderecoAlternativo(false);
    }
  };

  const selecionarProduto = (index: number, produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    if (produto) {
      const preco = getPrecoParaCanal(produtoId);
      const novosItens = [...itens];
      novosItens[index] = {
        ...novosItens[index],
        produto_id: produto.id,
        produto_nome: produto.nome,
        preco_unitario: preco,
      };
      setItens(novosItens);
    }
  };

  // Quando muda o canal, atualizar preços de todos os itens que têm produto_id
  const handleCanalChange = (canal: string) => {
    setCanalSelecionado(canal);
    setItens(prev => prev.map(item => {
      if (!item.produto_id) return item;
      const precoCanal = precosCanais.find(p => p.produto_id === item.produto_id && p.canal === canal);
      const produto = produtos.find(p => p.id === item.produto_id);
      return {
        ...item,
        preco_unitario: precoCanal?.preco ?? produto?.preco_venda ?? item.preco_unitario,
      };
    }));
  };

  const atualizarItem = (index: number, campo: keyof ItemForm, valor: any) => {
    const novosItens = [...itens];
    novosItens[index] = { ...novosItens[index], [campo]: valor };
    setItens(novosItens);
  };

  const removerItem = (index: number) => {
    if (itens.length <= 1) return;
    setItens(itens.filter((_, i) => i !== index));
  };

  const valorTotal = itens.reduce((acc, item) => acc + item.quantidade * item.preco_unitario, 0);

  const localEntregaFinal = usarEnderecoAlternativo ? enderecoAlternativo : enderecoCadastro;

  const resetForm = () => {
    setClienteId(null); setClienteNome(''); setClienteWhatsapp('');
    setNovoCliente(false); setEnderecoCadastro(''); setUsarEnderecoAlternativo(false);
    setEnderecoAlternativo(''); setDataEntrega(dataPadrao || new Date());
    setHoraEntrega(''); setObservacoes(''); setValorSinal(0);
    setFormaPagamento('dinheiro'); setCanalSelecionado('');
    setItens([{ ...itemVazio }]);
  };

  const handleSubmit = () => {
    if (!clienteNome.trim() || !dataEntrega || itens.some(i => !i.produto_nome.trim())) return;

    onSubmit({
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      cliente_whatsapp: clienteWhatsapp,
      data_entrega: format(dataEntrega, 'yyyy-MM-dd'),
      hora_entrega: horaEntrega || undefined,
      local_entrega: localEntregaFinal || undefined,
      observacoes: observacoes || undefined,
      valor_sinal: valorSinal,
      forma_pagamento: formaPagamento,
      itens: itens.map(i => ({
        produto_id: i.produto_id,
        produto_nome: i.produto_nome,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        observacoes: i.observacoes || undefined,
      })),
    });

    resetForm();
    onOpenChange(false);
  };

  const canalNome = canaisAtivos?.find(c => c.id === canalSelecionado)?.nome;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <DialogTitle>Nova Encomenda</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-5 pt-2">
            {/* ========== CLIENTE ========== */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setNovoCliente(!novoCliente);
                    if (!novoCliente) {
                      setClienteId(null); setClienteNome(''); setClienteWhatsapp(''); setEnderecoCadastro('');
                    }
                  }}
                >
                  <UserPlus className="h-3 w-3" />
                  {novoCliente ? 'Buscar cadastrado' : 'Novo cliente'}
                </Button>
              </div>

              {!novoCliente ? (
                <>
                  <SearchableSelect
                    options={clienteOptions}
                    value={clienteId || ''}
                    onValueChange={selecionarCliente}
                    placeholder="🔍 Buscar cliente pelo nome..."
                    searchPlaceholder="Digite o nome do cliente..."
                    emptyMessage="Nenhum cliente encontrado."
                    className="h-10"
                  />
                  {clienteId && (
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
                      <p className="font-medium">{clienteNome}</p>
                      {clienteWhatsapp && <p className="text-xs text-muted-foreground">📱 {clienteWhatsapp}</p>}
                      {enderecoCadastro && (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <p className="text-xs text-muted-foreground">{enderecoCadastro}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <Input placeholder="Nome do cliente *" value={clienteNome} onChange={e => setClienteNome(e.target.value)} className="h-9 text-sm" />
                  <Input placeholder="WhatsApp" value={clienteWhatsapp} onChange={e => setClienteWhatsapp(e.target.value)} className="h-9 text-sm" />
                </div>
              )}

              {/* Endereço alternativo */}
              {(clienteId || novoCliente) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Endereço de entrega alternativo?</Label>
                    <Switch
                      checked={usarEnderecoAlternativo}
                      onCheckedChange={setUsarEnderecoAlternativo}
                    />
                  </div>
                  {(usarEnderecoAlternativo || novoCliente) && (
                    <Input
                      placeholder="Endereço de entrega"
                      value={novoCliente && !usarEnderecoAlternativo ? enderecoCadastro : enderecoAlternativo}
                      onChange={e => {
                        if (novoCliente && !usarEnderecoAlternativo) {
                          setEnderecoCadastro(e.target.value);
                        } else {
                          setEnderecoAlternativo(e.target.value);
                        }
                      }}
                      className="h-9 text-sm"
                    />
                  )}
                </div>
              )}
            </div>

            {/* ========== DATA, HORA, CANAL ========== */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Data *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left h-9 text-sm', !dataEntrega && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                      {dataEntrega ? format(dataEntrega, "dd/MM/yy") : '—'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataEntrega} onSelect={setDataEntrega} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horário</Label>
                <Input type="time" value={horaEntrega} onChange={e => setHoraEntrega(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Canal</Label>
                <Select value={canalSelecionado} onValueChange={handleCanalChange}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Balcão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balcao">Balcão (preço base)</SelectItem>
                    {canaisAtivos?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {canalNome && (
              <p className="text-[11px] text-muted-foreground -mt-3">
                💡 Preços ajustados para o canal <strong>{canalNome}</strong>
              </p>
            )}

            {/* ========== ITENS ========== */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Itens da Encomenda
              </Label>
              {itens.map((item, idx) => (
                <div key={idx} className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <SearchableSelect
                        options={produtoOptions}
                        value={item.produto_id || ''}
                        onValueChange={(v) => selecionarProduto(idx, v)}
                        placeholder="🔍 Buscar produto..."
                        searchPlaceholder="Digite o nome do produto..."
                        emptyMessage="Nenhum produto encontrado."
                        className="h-9 text-sm"
                      />
                    </div>
                    {itens.length > 1 && (
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => removerItem(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {!item.produto_id && (
                    <Input placeholder="Ou digite o nome do item personalizado" value={item.produto_nome} onChange={e => atualizarItem(idx, 'produto_nome', e.target.value)} className="h-8 text-sm" />
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Quantidade</Label>
                      <Input type="number" min={1} value={item.quantidade} onChange={e => atualizarItem(idx, 'quantidade', Number(e.target.value) || 1)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Preço unitário</Label>
                      <CurrencyInput value={String(item.preco_unitario)} onChange={v => atualizarItem(idx, 'preco_unitario', parseFloat(v) || 0)} className="h-8 text-sm" />
                    </div>
                  </div>

                  {item.produto_id && item.preco_unitario > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Subtotal: <strong>{formatCurrencyBRL(item.quantidade * item.preco_unitario)}</strong>
                    </p>
                  )}

                  <Input placeholder="Obs. do item (ex: sabor morango, tema unicórnio)" value={item.observacoes} onChange={e => atualizarItem(idx, 'observacoes', e.target.value)} className="h-8 text-sm" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setItens([...itens, { ...itemVazio }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Item
              </Button>
            </div>

            {/* ========== PAGAMENTO ========== */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pagamento</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Forma</Label>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                      <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Sinal (entrada)</Label>
                  <CurrencyInput value={String(valorSinal)} onChange={v => setValorSinal(parseFloat(v) || 0)} className="h-9 text-sm" />
                </div>
              </div>
            </div>

            {/* ========== OBSERVAÇÕES ========== */}
            <div className="space-y-1.5">
              <Label className="text-xs">Observações Gerais</Label>
              <Textarea placeholder="Detalhes adicionais da encomenda..." value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className="text-sm resize-none" />
            </div>

            {/* ========== RESUMO + BOTÃO ========== */}
            <div className="flex items-center justify-between pt-4 border-t border-border sticky bottom-0 bg-background pb-1">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{formatCurrencyBRL(valorTotal)}</p>
                {valorSinal > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Sinal: {formatCurrencyBRL(valorSinal)} · Restante: {formatCurrencyBRL(valorTotal - valorSinal)}
                  </p>
                )}
              </div>
              <Button onClick={handleSubmit} disabled={!clienteNome.trim() || !dataEntrega || itens.every(i => !i.produto_nome.trim())}>
                Criar Encomenda
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
