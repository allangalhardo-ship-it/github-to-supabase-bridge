import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react';

const categorias = [
  'Aluguel',
  'Energia',
  'Água',
  'Gás',
  'Internet',
  'Telefone',
  'Funcionários',
  'Contador',
  'Marketing',
  'Manutenção',
  'Outros',
];

interface CustoFixo {
  id: string;
  nome: string;
  valor_mensal: number;
  categoria: string | null;
}

const CustosFixos = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCusto, setEditingCusto] = useState<CustoFixo | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    valor_mensal: '',
    categoria: '',
  });

  const { data: custos, isLoading } = useQuery({
    queryKey: ['custos-fixos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custos_fixos')
        .select('*')
        .order('categoria', { ascending: true })
        .order('nome', { ascending: true });

      if (error) throw error;
      return data as CustoFixo[];
    },
    enabled: !!usuario?.empresa_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('custos_fixos').insert({
        empresa_id: usuario!.empresa_id,
        nome: data.nome,
        valor_mensal: parseFloat(data.valor_mensal) || 0,
        categoria: data.categoria || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos-fixos'] });
      toast({ title: 'Custo fixo criado!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from('custos_fixos')
        .update({
          nome: data.nome,
          valor_mensal: parseFloat(data.valor_mensal) || 0,
          categoria: data.categoria || null,
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos-fixos'] });
      toast({ title: 'Custo fixo atualizado!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custos_fixos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos-fixos'] });
      toast({ title: 'Custo fixo excluído!' });
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
    setFormData({ nome: '', valor_mensal: '', categoria: '' });
    setEditingCusto(null);
    setDialogOpen(false);
  };

  const handleEdit = (custo: CustoFixo) => {
    setEditingCusto(custo);
    setFormData({
      nome: custo.nome,
      valor_mensal: custo.valor_mensal.toString(),
      categoria: custo.categoria || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCusto) {
      updateMutation.mutate({ ...formData, id: editingCusto.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const totalMensal = custos?.reduce((sum, c) => sum + Number(c.valor_mensal), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Custos Fixos</h1>
          <p className="text-muted-foreground">Gerencie os custos fixos mensais do seu negócio</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Custo Fixo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCusto ? 'Editar Custo Fixo' : 'Novo Custo Fixo'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Aluguel do ponto"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select
                    value={formData.categoria}
                    onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor_mensal">Valor Mensal (R$)</Label>
                  <Input
                    id="valor_mensal"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.valor_mensal}
                    onChange={(e) => setFormData({ ...formData, valor_mensal: e.target.value })}
                    placeholder="0,00"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingCusto ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Card */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-foreground/80">Total de Custos Fixos Mensais</p>
              <p className="text-3xl font-bold">{formatCurrency(totalMensal)}</p>
            </div>
            <Wallet className="h-12 w-12 opacity-50" />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : custos && custos.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor Mensal</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {custos.map((custo) => (
                  <TableRow key={custo.id}>
                    <TableCell className="font-medium">{custo.nome}</TableCell>
                    <TableCell>
                      {custo.categoria && (
                        <Badge variant="secondary">{custo.categoria}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(custo.valor_mensal))}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(custo)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDeleteClick(custo.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum custo fixo cadastrado</h3>
          <p className="text-muted-foreground mb-4">
            Adicione seus custos fixos mensais para ter uma visão completa do negócio.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Custo Fixo
          </Button>
        </Card>
      )}

      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
        title="Excluir custo fixo"
        description="Tem certeza que deseja excluir este custo fixo? Esta ação não pode ser desfeita."
      />
    </div>
  );
};

export default CustosFixos;
