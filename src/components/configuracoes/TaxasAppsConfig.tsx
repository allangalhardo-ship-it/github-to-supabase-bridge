import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Plus, Truck, Pencil, Trash2 } from 'lucide-react';

interface TaxaApp {
  id: string;
  nome_app: string;
  taxa_percentual: number;
  ativo: boolean;
}

const TaxasAppsConfig = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTaxa, setEditingTaxa] = useState<TaxaApp | null>(null);
  const [formData, setFormData] = useState({
    nome_app: '',
    taxa_percentual: '',
  });

  const { data: taxas, isLoading } = useQuery({
    queryKey: ['taxas_apps', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taxas_apps')
        .select('*')
        .order('nome_app');

      if (error) throw error;
      return data as TaxaApp[];
    },
    enabled: !!usuario?.empresa_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { nome_app: string; taxa_percentual: number }) => {
      const { error } = await supabase.from('taxas_apps').insert({
        empresa_id: usuario!.empresa_id,
        nome_app: data.nome_app,
        taxa_percentual: data.taxa_percentual,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxas_apps'] });
      toast({ title: 'Taxa adicionada!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; nome_app: string; taxa_percentual: number }) => {
      const { error } = await supabase
        .from('taxas_apps')
        .update({ nome_app: data.nome_app, taxa_percentual: data.taxa_percentual })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxas_apps'] });
      toast({ title: 'Taxa atualizada!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('taxas_apps')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxas_apps'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('taxas_apps').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxas_apps'] });
      toast({ title: 'Taxa removida!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({ nome_app: '', taxa_percentual: '' });
    setEditingTaxa(null);
    setDialogOpen(false);
  };

  const handleEdit = (taxa: TaxaApp) => {
    setEditingTaxa(taxa);
    setFormData({
      nome_app: taxa.nome_app,
      taxa_percentual: taxa.taxa_percentual.toString(),
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      nome_app: formData.nome_app.trim(),
      taxa_percentual: parseFloat(formData.taxa_percentual) || 0,
    };

    if (editingTaxa) {
      updateMutation.mutate({ id: editingTaxa.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Taxas por App de Delivery
            </CardTitle>
            <CardDescription>
              Configure a taxa de cada plataforma de delivery individualmente
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar App
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTaxa ? 'Editar Taxa' : 'Novo App de Delivery'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome_app">Nome do App</Label>
                  <Input
                    id="nome_app"
                    placeholder="Ex: iFood, Rappi, 99Food..."
                    value={formData.nome_app}
                    onChange={(e) => setFormData({ ...formData, nome_app: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxa_percentual">Taxa (%)</Label>
                  <Input
                    id="taxa_percentual"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="Ex: 12"
                    value={formData.taxa_percentual}
                    onChange={(e) => setFormData({ ...formData, taxa_percentual: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Porcentagem cobrada pelo app sobre cada venda
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingTaxa ? 'Salvar' : 'Adicionar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {taxas && taxas.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-center">Ativo</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxas.map((taxa) => (
                <TableRow key={taxa.id}>
                  <TableCell className="font-medium">{taxa.nome_app}</TableCell>
                  <TableCell className="text-right">{Number(taxa.taxa_percentual).toFixed(1)}%</TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={taxa.ativo}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: taxa.id, ativo: checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(taxa)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteMutation.mutate(taxa.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum app configurado</p>
            <p className="text-sm">Adicione apps como iFood, Rappi, 99Food...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TaxasAppsConfig;
