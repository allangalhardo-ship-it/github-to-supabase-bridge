import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { CurrencyInput } from '@/components/ui/currency-input';
import { CalendarIcon, Plus, Trash2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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

export default function EncomendaFormDialog({ open, onOpenChange, onSubmit, dataPadrao }: Props) {
  const { usuario } = useAuth();
  const [clienteNome, setClienteNome] = useState('');
  const [clienteWhatsapp, setClienteWhatsapp] = useState('');
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [dataEntrega, setDataEntrega] = useState<Date | undefined>(dataPadrao || new Date());
  const [horaEntrega, setHoraEntrega] = useState('');
  const [localEntrega, setLocalEntrega] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [valorSinal, setValorSinal] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [itens, setItens] = useState<ItemForm[]>([{ ...itemVazio }]);

  // Buscar produtos
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

  // Buscar clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-encomenda', usuario?.empresa_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, whatsapp')
        .eq('empresa_id', usuario?.empresa_id!)
        .order('nome');
      return data || [];
    },
    enabled: !!usuario?.empresa_id && open,
  });

  const selecionarCliente = (id: string) => {
    const cliente = clientes.find(c => c.id === id);
    if (cliente) {
      setClienteId(id);
      setClienteNome(cliente.nome);
      setClienteWhatsapp(cliente.whatsapp || '');
    }
  };

  const selecionarProduto = (index: number, produtoId: string) => {
    const produto = produtos.find(p => p.id === produtoId);
    if (produto) {
      const novosItens = [...itens];
      novosItens[index] = {
        ...novosItens[index],
        produto_id: produto.id,
        produto_nome: produto.nome,
        preco_unitario: produto.preco_venda,
      };
      setItens(novosItens);
    }
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

  const handleSubmit = () => {
    if (!clienteNome.trim() || !dataEntrega || itens.some(i => !i.produto_nome.trim())) return;

    onSubmit({
      cliente_id: clienteId,
      cliente_nome: clienteNome,
      cliente_whatsapp: clienteWhatsapp,
      data_entrega: format(dataEntrega, 'yyyy-MM-dd'),
      hora_entrega: horaEntrega || undefined,
      local_entrega: localEntrega || undefined,
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

    // Reset
    setClienteNome(''); setClienteWhatsapp(''); setClienteId(null);
    setDataEntrega(dataPadrao || new Date()); setHoraEntrega('');
    setLocalEntrega(''); setObservacoes(''); setValorSinal(0);
    setFormaPagamento('dinheiro'); setItens([{ ...itemVazio }]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Nova Encomenda</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 pb-6">
          <div className="space-y-5 pt-4">
            {/* Cliente */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cliente</Label>
              {clientes.length > 0 && (
                <Select onValueChange={selecionarCliente} value={clienteId || ''}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecionar cliente cadastrado..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Nome do cliente *" value={clienteNome} onChange={e => setClienteNome(e.target.value)} className="h-9 text-sm" />
                <Input placeholder="WhatsApp" value={clienteWhatsapp} onChange={e => setClienteWhatsapp(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            {/* Data e Hora */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data de Entrega *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left h-9 text-sm', !dataEntrega && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {dataEntrega ? format(dataEntrega, "dd/MM/yyyy") : 'Selecionar'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataEntrega}
                      onSelect={setDataEntrega}
                      locale={ptBR}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horário</Label>
                <Input type="time" value={horaEntrega} onChange={e => setHoraEntrega(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Local de Entrega</Label>
              <Input placeholder="Endereço ou ponto de referência" value={localEntrega} onChange={e => setLocalEntrega(e.target.value)} className="h-9 text-sm" />
            </div>

            {/* Itens */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Itens da Encomenda</Label>
              {itens.map((item, idx) => (
                <div key={idx} className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                  <div className="flex gap-2">
                    <Select onValueChange={(v) => selecionarProduto(idx, v)} value={item.produto_id || ''}>
                      <SelectTrigger className="flex-1 h-8 text-sm">
                        <SelectValue placeholder="Selecionar produto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {itens.length > 1 && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => removerItem(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {!item.produto_id && (
                    <Input placeholder="Ou digite o nome do item" value={item.produto_nome} onChange={e => atualizarItem(idx, 'produto_nome', e.target.value)} className="h-8 text-sm" />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Qtd</Label>
                      <Input type="number" min={1} value={item.quantidade} onChange={e => atualizarItem(idx, 'quantidade', Number(e.target.value))} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Preço un.</Label>
                      <CurrencyInput value={item.preco_unitario} onChange={v => atualizarItem(idx, 'preco_unitario', v)} className="h-8 text-sm" />
                    </div>
                  </div>
                  <Input placeholder="Obs. do item (ex: sabor, cor)" value={item.observacoes} onChange={e => atualizarItem(idx, 'observacoes', e.target.value)} className="h-8 text-sm" />
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setItens([...itens, { ...itemVazio }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Item
              </Button>
            </div>

            {/* Pagamento */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pagamento</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Forma de Pagamento</Label>
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
                  <Label className="text-xs">Valor do Sinal</Label>
                  <CurrencyInput value={valorSinal} onChange={setValorSinal} className="h-9 text-sm" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observações Gerais</Label>
              <Textarea placeholder="Detalhes adicionais..." value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className="text-sm" />
            </div>

            {/* Resumo e botão */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Total da encomenda</p>
                <p className="text-lg font-bold text-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
                </p>
                {valorSinal > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Restante: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal - valorSinal)}
                  </p>
                )}
              </div>
              <Button onClick={handleSubmit} disabled={!clienteNome.trim() || !dataEntrega}>
                Criar Encomenda
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
