import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invalidateEmpresaCachesAndRefetch } from '@/lib/queryConfig';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyBRL, parseDataLocal } from '@/lib/format';
import { format } from 'date-fns';
import { Pencil, XCircle, AlertTriangle } from 'lucide-react';
import { FORMAS_PAGAMENTO } from './VendaRapidaDialog';

export interface PedidoLista {
  id: string;
  canal_id: string | null;
  canal_texto: string | null;
  cliente_id: string | null;
  forma_pagamento: string | null;
  data_venda: string;
  origem: string;
  numero_externo: string | null;
  desconto: number;
  taxa_entrega: number;
  taxa_canal: number;
  valor_bruto: number;
  valor_liquido: number;
  canais_venda: { nome: string } | null;
  clientes: { nome: string } | null;
  vendas: { id: string; produto_id: string | null; descricao_produto: string | null; quantidade: number; preco_unitario: number | null; valor_total: number; produtos: { nome: string } | null }[];
}

export const ORIGEM_LABEL: Record<string, string> = {
  manual: 'Manual', fechamento: 'Fechamento', planilha: 'Planilha', foto: 'Foto', '99food': '99Food',
  encomenda: 'Encomenda', pedido: 'Cardápio', assistente_ia: 'Assistente',
};

interface Props {
  pedido: PedidoLista | null;
  onClose: () => void;
  onEditar: (p: PedidoLista) => void;
  canais: { id: string; nome: string }[];
}

export default function PedidoDetalheDialog({ pedido, onClose, onEditar, canais }: Props) {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const [confirmar, setConfirmar] = useState(false);
  const [canalRevisao, setCanalRevisao] = useState('');
  const fmt = formatCurrencyBRL;

  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cancelar_venda_pedido' as any, { p_pedido_id: id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast({ title: 'Venda cancelada', description: 'O estoque foi devolvido e a entrada saiu do Caixa.' });
      setConfirmar(false); onClose();
    },
    onError: (e: Error) => toast({ title: 'Erro ao cancelar', description: e.message, variant: 'destructive' }),
  });

  const definirCanal = useMutation({
    mutationFn: async ({ id, canalId }: { id: string; canalId: string }) => {
      const nome = canais.find(c => c.id === canalId)?.nome;
      const { error } = await supabase.from('vendas_pedidos' as any).update({ canal_id: canalId } as any).eq('id', id);
      if (error) throw error;
      const { error: e2 } = await supabase.from('vendas').update({ canal: nome }).eq('pedido_id' as any, id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast({ title: 'Canal definido' });
      setCanalRevisao(''); onClose();
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  if (!pedido) return null;
  const somenteLeitura = pedido.origem === 'encomenda' || pedido.origem === 'pedido';
  const formaLabel = FORMAS_PAGAMENTO.find(f => f.value === pedido.forma_pagamento)?.label;
  const qtdTotal = pedido.vendas.reduce((a, v) => a + Number(v.quantidade), 0);

  return (
    <>
      <Dialog open={!!pedido} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Venda de {format(parseDataLocal(pedido.data_venda), 'dd/MM/yyyy')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={pedido.canal_id ? 'secondary' : 'destructive'}>{pedido.canais_venda?.nome || `${pedido.canal_texto || 'Sem canal'} (revisar)`}</Badge>
              <Badge variant="outline">{ORIGEM_LABEL[pedido.origem] || pedido.origem}</Badge>
              {formaLabel && <Badge variant="outline">{formaLabel}</Badge>}
              {pedido.numero_externo && <Badge variant="outline">#{pedido.numero_externo.slice(0, 12)}</Badge>}
            </div>
            {pedido.clientes?.nome && <p className="text-muted-foreground">Cliente: <span className="text-foreground">{pedido.clientes.nome}</span></p>}

            {!pedido.canal_id && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-2 space-y-2">
                <p className="text-xs flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />O canal "{pedido.canal_texto || 'vazio'}" não existe no cadastro. Escolha o canal certo:</p>
                <div className="flex gap-2">
                  <Select value={canalRevisao} onValueChange={setCanalRevisao}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Escolher canal" /></SelectTrigger>
                    <SelectContent>{canais.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" disabled={!canalRevisao || definirCanal.isPending} onClick={() => definirCanal.mutate({ id: pedido.id, canalId: canalRevisao })}>Salvar</Button>
                </div>
              </div>
            )}

            <div className="rounded-md border divide-y">
              {pedido.vendas.map(v => (
                <div key={v.id} className="flex justify-between gap-2 p-2">
                  <span className="truncate">{Number(v.quantidade)}× {v.produtos?.nome || v.descricao_produto || 'Item'}</span>
                  <span className="whitespace-nowrap">{fmt(Number(v.valor_total))}</span>
                </div>
              ))}
            </div>
            <div className="space-y-0.5 text-xs">
              {Number(pedido.desconto) > 0 && <div className="flex justify-between"><span>Desconto</span><span>- {fmt(Number(pedido.desconto))}</span></div>}
              {Number(pedido.taxa_entrega) > 0 && <div className="flex justify-between"><span>Taxa de entrega</span><span>{fmt(Number(pedido.taxa_entrega))}</span></div>}
              <div className="flex justify-between font-semibold text-sm"><span>Total ({qtdTotal} itens)</span><span>{fmt(Number(pedido.valor_bruto))}</span></div>
              {Number(pedido.taxa_canal) > 0 && <div className="flex justify-between text-destructive"><span>Taxa do canal</span><span>- {fmt(Number(pedido.taxa_canal))}</span></div>}
              <div className="flex justify-between"><span>Líquido</span><span className="font-semibold">{fmt(Number(pedido.valor_liquido))}</span></div>
            </div>

            {somenteLeitura ? (
              <p className="text-xs text-muted-foreground">Esta venda veio {pedido.origem === 'encomenda' ? 'de uma encomenda. Altere em Encomendas.' : 'de um pedido do Cardápio. Altere em Pedidos.'}</p>
            ) : (
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => onEditar(pedido)}><Pencil className="h-4 w-4 mr-1" />Editar</Button>
                <Button variant="outline" className="flex-1 text-destructive" onClick={() => setConfirmar(true)}><XCircle className="h-4 w-4 mr-1" />Cancelar venda</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta venda?</AlertDialogTitle>
            <AlertDialogDescription>
              A venda de {fmt(Number(pedido.valor_bruto))} será apagada. O estoque dos {qtdTotal} itens volta e a entrada sai do Caixa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={cancelar.isPending}
              onClick={(e) => { e.preventDefault(); cancelar.mutate(pedido.id); }}>
              {cancelar.isPending ? 'Cancelando...' : 'Cancelar venda'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
