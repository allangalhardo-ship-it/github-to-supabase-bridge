import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { MobileDataView } from '@/components/ui/mobile-data-view';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, Trash2, Pencil, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Cliente {
  id: string;
  nome: string;
  whatsapp: string | null;
  created_at: string;
}

const Clientes = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    whatsapp: '',
  });

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
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('clientes').insert({
        empresa_id: usuario!.empresa_id,
        nome: data.nome.trim(),
        whatsapp: data.whatsapp.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ title: 'Cliente cadastrado!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao cadastrar', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('clientes')
        .update({
          nome: data.nome.trim(),
          whatsapp: data.whatsapp.trim() || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ title: 'Cliente atualizado!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast({ title: 'Cliente excluído!' });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    },
  });

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete);
    }
  };

  const resetForm = () => {
    setFormData({ nome: '', whatsapp: '' });
    setEditingCliente(null);
    setDialogOpen(false);
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome,
      whatsapp: cliente.whatsapp || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }
    
    if (editingCliente) {
      updateMutation.mutate({ id: editingCliente.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatWhatsApp = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    // Formata como (XX) XXXXX-XXXX
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWhatsApp(e.target.value);
    setFormData({ ...formData, whatsapp: formatted });
  };

  const openWhatsApp = (whatsapp: string) => {
    const numbers = whatsapp.replace(/\D/g, '');
    const fullNumber = numbers.length === 11 ? `55${numbers}` : `55${numbers}`;
    window.open(`https://wa.me/${fullNumber}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Cadastre clientes para vendas diretas</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCliente ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do cliente"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleWhatsAppChange}
                  placeholder="(XX) XXXXX-XXXX"
                  maxLength={16}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingCliente ? 'Salvar' : 'Cadastrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <MobileDataView
          data={clientes || []}
          columns={[
            {
              key: 'nome',
              header: 'Nome',
              mobilePriority: 1,
              render: (cliente) => <span className="font-medium">{cliente.nome}</span>,
            },
            {
              key: 'whatsapp',
              header: 'WhatsApp',
              mobilePriority: 2,
              render: (cliente) => cliente.whatsapp ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-600 hover:text-green-700 p-0 h-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    openWhatsApp(cliente.whatsapp!);
                  }}
                >
                  <Phone className="h-4 w-4 mr-1" />
                  {cliente.whatsapp}
                </Button>
              ) : (
                <span className="text-muted-foreground">-</span>
              ),
            },
            {
              key: 'created_at',
              header: 'Cadastrado em',
              mobilePriority: 3,
              render: (cliente) => (
                <span className="text-muted-foreground">
                  {cliente.created_at ? format(new Date(cliente.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                </span>
              ),
            },
          ]}
          keyExtractor={(cliente) => cliente.id}
          renderActions={(cliente) => (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleEdit(cliente)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => handleDeleteClick(cliente.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          renderMobileHeader={(cliente) => cliente.nome}
          renderMobileSubtitle={(cliente) => (
            cliente.whatsapp ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-green-600 hover:text-green-700 p-0 h-auto text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  openWhatsApp(cliente.whatsapp!);
                }}
              >
                <Phone className="h-3 w-3 mr-1" />
                {cliente.whatsapp}
              </Button>
            ) : (
              <span className="text-muted-foreground text-xs">Sem WhatsApp</span>
            )
          )}
          renderMobileHighlight={(cliente) => (
            <span className="text-xs text-muted-foreground">
              {cliente.created_at ? format(new Date(cliente.created_at), 'dd/MM/yy', { locale: ptBR }) : ''}
            </span>
          )}
          emptyMessage="Nenhum cliente cadastrado"
          emptyAction={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          }
        />
      )}

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
