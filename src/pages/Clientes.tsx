import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Users, Gift } from 'lucide-react';
import { useClientes, Cliente, ClienteFormData } from '@/hooks/useClientes';
import { ClienteFormDialog } from '@/components/clientes/ClienteFormDialog';
import { ClienteCard } from '@/components/clientes/ClienteCard';
import { differenceInDays, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const Clientes = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const { 
    clientes, 
    isLoading, 
    createCliente, 
    updateCliente, 
    deleteCliente,
    isCreating,
    isUpdating,
    gerarLinkWhatsApp,
    gerarLinkPedido,
  } = useClientes();

  // Filtrar clientes
  const clientesFiltrados = useMemo(() => {
    if (!clientes) return [];
    if (!busca.trim()) return clientes;
    
    const termo = busca.toLowerCase();
    return clientes.filter(c => 
      c.nome.toLowerCase().includes(termo) ||
      c.whatsapp?.includes(termo) ||
      c.email?.toLowerCase().includes(termo) ||
      c.endereco_bairro?.toLowerCase().includes(termo) ||
      c.endereco_cidade?.toLowerCase().includes(termo)
    );
  }, [clientes, busca]);

  // Clientes com aniversário próximo
  const aniversariantesProximos = useMemo(() => {
    if (!clientes) return [];
    const hoje = new Date();
    
    return clientes.filter(c => {
      if (!c.data_nascimento) return false;
      const nascimento = parseISO(c.data_nascimento);
      const aniversarioEsteAno = new Date(hoje.getFullYear(), nascimento.getMonth(), nascimento.getDate());
      const diff = differenceInDays(aniversarioEsteAno, hoje);
      return diff >= 0 && diff <= 7;
    });
  }, [clientes]);

  const handleSubmit = (data: ClienteFormData) => {
    if (editingCliente) {
      updateCliente({ id: editingCliente.id, data });
    } else {
      createCliente(data);
    }
    setEditingCliente(null);
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setDialogOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setClienteToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (clienteToDelete) {
      deleteCliente(clienteToDelete);
      setDeleteConfirmOpen(false);
      setClienteToDelete(null);
    }
  };

  const handleWhatsApp = (cliente: Cliente, mensagem: string) => {
    if (!cliente.whatsapp) return;
    
    // Substituir placeholder do link de pedido
    let mensagemFinal = mensagem;
    if (mensagem.includes('[LINK_PEDIDO]') && usuario?.empresa_id) {
      const linkPedido = gerarLinkPedido(usuario.empresa_id, cliente.id);
      mensagemFinal = mensagem.replace('[LINK_PEDIDO]', linkPedido);
    }
    
    const link = gerarLinkWhatsApp(cliente.whatsapp, mensagemFinal);
    window.open(link, '_blank');
  };

  const handleCopyLink = (cliente: Cliente) => {
    if (!usuario?.empresa_id) return;
    const link = gerarLinkPedido(usuario.empresa_id, cliente.id);
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado!', description: 'Cole no WhatsApp ou onde preferir.' });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Clientes</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gerencie seus clientes e envie pedidos pelo WhatsApp
            </p>
          </div>

          <Button onClick={() => { setEditingCliente(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </div>

        {/* Alerta de aniversariantes */}
        {aniversariantesProximos.length > 0 && (
          <div className="bg-pink-50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900 rounded-lg p-3 flex items-center gap-2">
            <Gift className="h-5 w-5 text-pink-600" />
            <span className="text-sm text-pink-700 dark:text-pink-300">
              <strong>{aniversariantesProximos.length}</strong> cliente(s) fazem aniversário nos próximos 7 dias!
            </span>
          </div>
        )}

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, email ou bairro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{clientes?.length || 0} clientes</span>
          </div>
          {busca && (
            <Badge variant="secondary">
              {clientesFiltrados.length} encontrados
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {busca 
              ? 'Tente outro termo de busca' 
              : 'Cadastre seus clientes para enviar pedidos pelo WhatsApp'
            }
          </p>
          {!busca && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clientesFiltrados.map((cliente) => (
            <ClienteCard
              key={cliente.id}
              cliente={cliente}
              onEdit={() => handleEdit(cliente)}
              onDelete={() => handleDeleteClick(cliente.id)}
              onWhatsApp={(mensagem) => handleWhatsApp(cliente, mensagem)}
              onCopyLink={() => handleCopyLink(cliente)}
            />
          ))}
        </div>
      )}

      <ClienteFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cliente={editingCliente}
        onSubmit={handleSubmit}
        isLoading={isCreating || isUpdating}
      />

      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
        title="Excluir cliente"
        description="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default Clientes;
