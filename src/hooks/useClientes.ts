import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { invalidateEmpresaCachesAndRefetch } from '@/lib/queryConfig';

export interface Cliente {
  id: string;
  empresa_id: string;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  data_nascimento: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  endereco_cep: string | null;
  observacoes: string | null;
  preferencias: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClienteFormData {
  nome: string;
  whatsapp?: string;
  email?: string;
  data_nascimento?: string;
  endereco_rua?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  endereco_cep?: string;
  observacoes?: string;
  preferencias?: string;
}

export function useClientes() {
  const { usuario } = useAuth();
  const { toast } = useToast();

  const { data: clientes, isLoading } = useQuery({
    queryKey: ['clientes', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      return data as Cliente[];
    },
    enabled: !!usuario?.empresa_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ClienteFormData) => {
      if (!usuario?.empresa_id) throw new Error('Empresa não encontrada');
      
      const { data: cliente, error } = await supabase
        .from('clientes')
        .insert({
          empresa_id: usuario.empresa_id,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return cliente;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast({ title: 'Cliente cadastrado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao cadastrar', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClienteFormData> }) => {
      const { error } = await supabase
        .from('clientes')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast({ title: 'Cliente atualizado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast({ title: 'Cliente removido!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    },
  });

  // Gerar link WhatsApp com mensagem pré-preenchida
  const gerarLinkWhatsApp = (whatsapp: string, mensagem: string) => {
    const numeroLimpo = whatsapp.replace(/\D/g, '');
    const numeroComPais = numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;
    const mensagemEncoded = encodeURIComponent(mensagem);
    return `https://wa.me/${numeroComPais}?text=${mensagemEncoded}`;
  };

  // Gerar link de pedido compartilhável
  const gerarLinkPedido = (empresaId: string, clienteId?: string) => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({ empresa: empresaId });
    if (clienteId) params.append('cliente', clienteId);
    return `${baseUrl}/pedido?${params.toString()}`;
  };

  return {
    clientes,
    isLoading,
    createCliente: createMutation.mutate,
    updateCliente: updateMutation.mutate,
    deleteCliente: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    gerarLinkWhatsApp,
    gerarLinkPedido,
  };
}
