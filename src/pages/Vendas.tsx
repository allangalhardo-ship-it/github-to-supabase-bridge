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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Receipt, Upload, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const canais = ['balcao', 'iFood', 'Rappi', '99Food', 'Aiqfome', 'WhatsApp', 'Outro'];

const Vendas = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    produto_id: '',
    quantidade: '1',
    valor_total: '',
    canal: 'balcao',
    data_venda: format(new Date(), 'yyyy-MM-dd'),
  });

  // Fetch produtos para o select
  const { data: produtos } = useQuery({
    queryKey: ['produtos-select', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, preco_venda')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch vendas
  const { data: vendas, isLoading } = useQuery({
    queryKey: ['vendas', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select(`
          *,
          produtos (nome)
        `)
        .order('data_venda', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const produto = produtos?.find(p => p.id === data.produto_id);
      const { error } = await supabase.from('vendas').insert({
        empresa_id: usuario!.empresa_id,
        produto_id: data.produto_id || null,
        descricao_produto: produto?.nome || null,
        quantidade: parseFloat(data.quantidade) || 1,
        valor_total: parseFloat(data.valor_total) || 0,
        canal: data.canal,
        data_venda: data.data_venda,
        origem: 'manual',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      toast({ title: 'Venda registrada!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao registrar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vendas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      toast({ title: 'Venda excluída!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      produto_id: '',
      quantidade: '1',
      valor_total: '',
      canal: 'balcao',
      data_venda: format(new Date(), 'yyyy-MM-dd'),
    });
    setDialogOpen(false);
  };

  const handleProdutoChange = (produtoId: string) => {
    const produto = produtos?.find(p => p.id === produtoId);
    setFormData({
      ...formData,
      produto_id: produtoId,
      valor_total: produto ? produto.preco_venda.toString() : formData.valor_total,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vendas</h1>
          <p className="text-muted-foreground">Registre vendas manualmente ou importe relatórios</p>
        </div>

        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Venda
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Venda</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="produto">Produto</Label>
                  <Select
                    value={formData.produto_id}
                    onValueChange={handleProdutoChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos?.map((produto) => (
                        <SelectItem key={produto.id} value={produto.id}>
                          {produto.nome} - {formatCurrency(Number(produto.preco_venda))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantidade">Quantidade</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      step="1"
                      min="1"
                      value={formData.quantidade}
                      onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valor_total">Valor Total (R$)</Label>
                    <Input
                      id="valor_total"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.valor_total}
                      onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="canal">Canal</Label>
                    <Select
                      value={formData.canal}
                      onValueChange={(value) => setFormData({ ...formData, canal: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {canais.map((canal) => (
                          <SelectItem key={canal} value={canal}>
                            {canal}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data_venda">Data</Label>
                    <Input
                      id="data_venda"
                      type="date"
                      value={formData.data_venda}
                      onChange={(e) => setFormData({ ...formData, data_venda: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    Registrar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="historico">
        <TabsList>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="importar">Importar CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="historico" className="mt-4">
          {isLoading ? (
            <Skeleton className="h-96" />
          ) : vendas && vendas.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendas.map((venda) => (
                      <TableRow key={venda.id}>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(venda.data_venda), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {venda.produtos?.nome || venda.descricao_produto || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {Number(venda.quantidade)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(venda.valor_total))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{venda.canal}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{venda.origem}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteMutation.mutate(venda.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-12 text-center">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma venda registrada</h3>
              <p className="text-muted-foreground mb-4">
                Registre vendas manualmente ou importe do iFood.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Venda
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="importar" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Importar Relatório CSV
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Em breve: importe relatórios do iFood, Rappi e outras plataformas de delivery.
              </p>
              <Button disabled>
                <Upload className="mr-2 h-4 w-4" />
                Selecionar Arquivo CSV
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Vendas;
