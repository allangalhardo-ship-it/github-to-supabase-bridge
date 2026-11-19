import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export type EncomendaStatus = 'orcamento' | 'pendente' | 'em_producao' | 'pronta' | 'entregue' | 'cancelada';

export interface EncomendaItem {
  id: string;
  encomenda_id: string;
  produto_id: string | null;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  observacoes: string | null;
}

export interface Encomenda {
  id: string;
  empresa_id: string;
  cliente_id: string | null;
  cliente_nome: string;
  cliente_whatsapp: string | null;
  data_entrega: string;
  hora_entrega: string | null;
  local_entrega: string | null;
  observacoes: string | null;
  status: EncomendaStatus;
  valor_sinal: number;
  valor_total: number;
  forma_pagamento: string | null;
  canal_id?: string | null;
  desconto?: number;
  sinal_data?: string | null;
  sinal_forma_pagamento?: string | null;
  sinal_devolvido?: boolean | null;
  pedido_id?: string | null;
  created_at: string;
  updated_at: string;
  encomenda_itens?: EncomendaItem[];
}

export interface EncomendaFormData {
  cliente_id?: string | null;
  cliente_nome: string;
  cliente_whatsapp?: string;
  data_entrega: string;
  hora_entrega?: string;
  local_entrega?: string;
  observacoes?: string;
  valor_sinal?: number;
  forma_pagamento?: string;
  canal_id?: string;
  desconto?: number;
  sinal_data?: string | null;
  sinal_forma_pagamento?: string | null;
  orcamento?: boolean;
  itens: {
    produto_id?: string | null;
    produto_nome: string;
    quantidade: number;
    preco_unitario: number;
    observacoes?: string;
  }[];
}

export function useEncomendas(mesAtual: Date) {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const empresaId = usuario?.empresa_id;

  const inicioMes = format(startOfMonth(mesAtual), 'yyyy-MM-dd');
  const fimMes = format(endOfMonth(mesAtual), 'yyyy-MM-dd');

  // Buscar encomendas do mês
  const { data: encomendas = [], isLoading } = useQuery({
    queryKey: ['encomendas', empresaId, inicioMes, fimMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('encomendas')
        .select('*, encomenda_itens(*)')
        .eq('empresa_id', empresaId!)
        .gte('data_entrega', inicioMes)
        .lte('data_entrega', fimMes)
        .order('data_entrega', { ascending: true });

      if (error) throw error;
      return (data as unknown as Encomenda[]) || [];
    },
    enabled: !!empresaId,
  });

  // Criar encomenda
  const criarEncomenda = useMutation({
    mutationFn: async (form: EncomendaFormData) => {
      const valorTotal = totalEncomenda(form);

      const { data: encomenda, error } = await supabase
        .from('encomendas')
        .insert({
          empresa_id: empresaId!,
          cliente_id: form.cliente_id || null,
          cliente_nome: form.cliente_nome,
          cliente_whatsapp: form.cliente_whatsapp || null,
          data_entrega: form.data_entrega,
          hora_entrega: form.hora_entrega || null,
          local_entrega: form.local_entrega || null,
          observacoes: form.observacoes || null,
          valor_sinal: form.valor_sinal || 0,
          valor_total: valorTotal,
          forma_pagamento: form.forma_pagamento || 'dinheiro',
          canal_id: form.canal_id || null,
          desconto: form.desconto || 0,
          sinal_data: form.sinal_data || null,
          sinal_forma_pagamento: form.sinal_forma_pagamento || null,
          status: form.orcamento ? 'orcamento' : 'pendente',
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Inserir itens
      const itens = form.itens.map(item => ({
        encomenda_id: encomenda.id,
        produto_id: item.produto_id || null,
        produto_nome: item.produto_nome,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        observacoes: item.observacoes || null,
      }));

      const { error: itensError } = await supabase
        .from('encomenda_itens')
        .insert(itens as any);

      if (itensError) throw itensError;

      return encomenda;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encomendas'] });
      toast.success('Encomenda criada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar encomenda: ' + error.message);
    },
  });

  const invalidarFinanceiro = () => {
    ['encomendas', 'vendas', 'vendas-dashboard', 'vendas-financeiro-dashboard', 'vendas-anterior', 'top-produtos',
      'caixa', 'caixa-movimentos', 'caixa-saldo-total', 'caixa-vendas', 'caixa-pedidos', 'vendas-pedidos']
      .forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
  };

  // Editar encomenda (bloqueado quando entregue)
  const atualizarEncomenda = useMutation({
    mutationFn: async ({ id, form, statusAtual }: { id: string; form: EncomendaFormData; statusAtual: EncomendaStatus }) => {
      if (statusAtual === 'entregue') throw new Error('Encomenda entregue. Use "Reabrir encomenda" para corrigir.');
      const { error } = await supabase.from('encomendas').update({
        cliente_id: form.cliente_id || null,
        cliente_nome: form.cliente_nome,
        cliente_whatsapp: form.cliente_whatsapp || null,
        data_entrega: form.data_entrega,
        hora_entrega: form.hora_entrega || null,
        local_entrega: form.local_entrega || null,
        observacoes: form.observacoes || null,
        valor_sinal: form.valor_sinal || 0,
        valor_total: totalEncomenda(form),
        forma_pagamento: form.forma_pagamento || 'dinheiro',
        canal_id: form.canal_id || null,
        desconto: form.desconto || 0,
        sinal_data: form.sinal_data || null,
        sinal_forma_pagamento: form.sinal_forma_pagamento || null,
        ...(statusAtual === 'orcamento' && !form.orcamento ? { status: 'pendente' } : {}),
      } as any).eq('id', id).neq('status', 'entregue');
      if (error) throw error;
      const { error: delErr } = await supabase.from('encomenda_itens').delete().eq('encomenda_id', id);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from('encomenda_itens').insert(form.itens.map(item => ({
        encomenda_id: id, produto_id: item.produto_id || null, produto_nome: item.produto_nome,
        quantidade: item.quantidade, preco_unitario: item.preco_unitario, observacoes: item.observacoes || null,
      })) as any);
      if (insErr) throw insErr;
    },
    onSuccess: () => { invalidarFinanceiro(); toast.success('Encomenda atualizada!'); },
    onError: (e: Error) => toast.error('Erro ao salvar: ' + e.message),
  });

  // Cancelar (pergunta sobre o sinal na interface)
  const cancelarEncomenda = useMutation({
    mutationFn: async ({ id, sinalDevolvido }: { id: string; sinalDevolvido: boolean }) => {
      const { error } = await supabase.from('encomendas')
        .update({ status: 'cancelada', sinal_devolvido: sinalDevolvido } as any)
        .eq('id', id).neq('status', 'cancelada');
      if (error) throw error;
    },
    onSuccess: () => { invalidarFinanceiro(); toast.success('Encomenda cancelada. Venda e estoque desfeitos.'); },
    onError: (e: Error) => toast.error('Erro ao cancelar: ' + e.message),
  });

  // Reabrir encomenda entregue
  const reabrirEncomenda = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('reabrir_encomenda' as any, { p_encomenda_id: id });
      if (error) throw error;
    },
    onSuccess: () => { invalidarFinanceiro(); toast.success('Encomenda reaberta. A venda foi desfeita e o sinal mantido.'); },
    onError: (e: Error) => toast.error('Erro ao reabrir: ' + e.message),
  });

  // Atualizar status
  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: EncomendaStatus }) => {
      // A venda, o caixa e o estoque são gerados/estornados pelo banco
      // (gatilho trg_encomenda_financeiro), de forma idempotente.
      const { error } = await supabase
        .from('encomendas')
        .update({ status } as any)
        .eq('id', id)
        .neq('status', status);

      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['encomendas'] });
      if (status === 'entregue' || status === 'cancelada') {
        invalidarFinanceiro();
        // Invalidar todas as queries que dependem de vendas e caixa
        queryClient.invalidateQueries({ queryKey: ['vendas'] });
        queryClient.invalidateQueries({ queryKey: ['vendas-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['vendas-financeiro-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['vendas-anterior'] });
        queryClient.invalidateQueries({ queryKey: ['top-produtos'] });
        queryClient.invalidateQueries({ queryKey: ['caixa'] });
        queryClient.invalidateQueries({ queryKey: ['caixa-movimentos'] });
        queryClient.invalidateQueries({ queryKey: ['caixa-saldo-total'] });
        queryClient.invalidateQueries({ queryKey: ['caixa-vendas'] });
      }
      const msgs: Record<string, string> = {
        em_producao: 'Encomenda em produção!',
        pronta: 'Encomenda pronta!',
        pendente: 'Orçamento aprovado! Agora é uma encomenda confirmada.',
        entregue: 'Encomenda entregue! Venda e caixa atualizados.',
        cancelada: 'Encomenda cancelada. Venda e caixa estornados.',
      };
      toast.success(msgs[status] || 'Status atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  // Excluir encomenda
  const excluirEncomenda = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('encomendas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encomendas'] });
      toast.success('Encomenda excluída.');
    },
    onError: (error) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });

  // Agrupar por dia para o calendário
  const encomendasPorDia = encomendas.reduce<Record<string, Encomenda[]>>((acc, enc) => {
    if (!acc[enc.data_entrega]) acc[enc.data_entrega] = [];
    acc[enc.data_entrega].push(enc);
    return acc;
  }, {});

  return {
    encomendas,
    encomendasPorDia,
    isLoading,
    criarEncomenda,
    atualizarStatus,
    excluirEncomenda,
    atualizarEncomenda,
    cancelarEncomenda,
    reabrirEncomenda,
  };
}

export function totalEncomenda(form: Pick<EncomendaFormData, 'itens' | 'desconto'>): number {
  const soma = form.itens.reduce((acc, i) => acc + i.quantidade * i.preco_unitario, 0);
  return Math.max(0, Math.round((soma - Math.min(form.desconto || 0, soma)) * 100) / 100);
}

/** Encomendas abertas (não entregues/canceladas) entre duas datas, para lembretes e produção. */
export function useEncomendasPeriodo(inicio: string, fim: string) {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresa_id;
  return useQuery({
    queryKey: ['encomendas', 'periodo', empresaId, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.from('encomendas').select('*, encomenda_itens(*)')
        .eq('empresa_id', empresaId!).gte('data_entrega', inicio).lte('data_entrega', fim)
        .order('data_entrega');
      if (error) throw error;
      return (data as unknown as Encomenda[]) || [];
    },
    enabled: !!empresaId,
  });
}
