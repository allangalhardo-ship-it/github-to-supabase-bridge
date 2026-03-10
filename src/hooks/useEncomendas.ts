import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export type EncomendaStatus = 'pendente' | 'em_producao' | 'pronta' | 'entregue' | 'cancelada';

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
      const valorTotal = form.itens.reduce((acc, item) => acc + item.quantidade * item.preco_unitario, 0);

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

  // Atualizar status
  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: EncomendaStatus }) => {
      const { error } = await supabase
        .from('encomendas')
        .update({ status } as any)
        .eq('id', id);

      if (error) throw error;

      // Se marcou como entregue, registrar venda + caixa
      if (status === 'entregue') {
        const encomenda = encomendas.find(e => e.id === id);
        if (encomenda) {
          await registrarEntrega(encomenda);
        }
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['encomendas'] });
      if (status === 'entregue') {
        // Invalidar todas as queries que dependem de vendas e caixa
        queryClient.invalidateQueries({ queryKey: ['vendas'] });
        queryClient.invalidateQueries({ queryKey: ['vendas-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['vendas-financeiro-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['vendas-anterior'] });
        queryClient.invalidateQueries({ queryKey: ['top-produtos'] });
        queryClient.invalidateQueries({ queryKey: ['caixa'] });
        queryClient.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      }
      const msgs: Record<string, string> = {
        em_producao: 'Encomenda em produção!',
        pronta: 'Encomenda pronta!',
        entregue: 'Encomenda entregue! Venda e caixa atualizados.',
        cancelada: 'Encomenda cancelada.',
      };
      toast.success(msgs[status] || 'Status atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  // Registrar venda + caixa ao entregar
  const registrarEntrega = async (encomenda: Encomenda) => {
    const itens = encomenda.encomenda_itens || [];

    // Registrar vendas por item
    for (const item of itens) {
      await supabase.from('vendas').insert({
        empresa_id: empresaId!,
        produto_id: item.produto_id,
        descricao_produto: item.produto_nome,
        quantidade: item.quantidade,
        valor_total: item.quantidade * item.preco_unitario,
        data_venda: encomenda.data_entrega,
        origem: 'encomenda',
        tipo_venda: 'encomenda',
        canal: 'encomenda',
      } as any);
    }

    // Registrar entrada no caixa (valor total - sinal já pago)
    const saldoRestante = encomenda.valor_total - encomenda.valor_sinal;
    if (saldoRestante > 0) {
      await supabase.from('caixa_movimentos').insert({
        empresa_id: empresaId!,
        tipo: 'entrada',
        categoria: 'Encomenda',
        descricao: `Encomenda - ${encomenda.cliente_nome}`,
        valor: saldoRestante,
        data_movimento: encomenda.data_entrega,
        origem: 'encomenda',
      } as any);
    }

    // Se teve sinal, já foi registrado na criação — registrar agora se não foi
    if (encomenda.valor_sinal > 0) {
      await supabase.from('caixa_movimentos').insert({
        empresa_id: empresaId!,
        tipo: 'entrada',
        categoria: 'Sinal Encomenda',
        descricao: `Sinal - ${encomenda.cliente_nome}`,
        valor: encomenda.valor_sinal,
        data_movimento: format(new Date(encomenda.created_at), 'yyyy-MM-dd'),
        origem: 'encomenda',
      } as any);
    }
  };

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
  };
}
