import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Package, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import FichaTecnicaForm from '@/components/produtos/FichaTecnicaForm';

interface Produto {
  id: string;
  nome: string;
  categoria: string | null;
  preco_venda: number;
  ativo: boolean;
  fichas_tecnicas?: {
    id: string;
    quantidade: number;
    insumos: {
      id: string;
      nome: string;
      unidade_medida: string;
      custo_unitario: number;
    };
  }[];
}

const Produtos = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [expandedProduto, setExpandedProduto] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    preco_venda: '',
    ativo: true,
  });

  // Fetch produtos with ficha técnica
  const { data: produtos, isLoading } = useQuery({
    queryKey: ['produtos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select(`
          *,
          fichas_tecnicas (
            id,
            quantidade,
            insumos (
              id,
              nome,
              unidade_medida,
              custo_unitario
            )
          )
        `)
        .order('nome');

      if (error) throw error;
      return data as Produto[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch configurações para cálculo de preço sugerido
  const { data: config } = useQuery({
    queryKey: ['config', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!usuario?.empresa_id) {
        throw new Error('Seu cadastro ainda não foi finalizado. Saia e entre novamente.');
      }

      const { error } = await supabase.from('produtos').insert({
        empresa_id: usuario.empresa_id,
        nome: data.nome,
        categoria: data.categoria || null,
        preco_venda: parseFloat(data.preco_venda) || 0,
        ativo: data.ativo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast({ title: 'Produto criado com sucesso!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar produto', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from('produtos')
        .update({
          nome: data.nome,
          categoria: data.categoria || null,
          preco_venda: parseFloat(data.preco_venda) || 0,
          ativo: data.ativo,
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast({ title: 'Produto atualizado!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('produtos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast({ title: 'Produto excluído!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({ nome: '', categoria: '', preco_venda: '', ativo: true });
    setEditingProduto(null);
    setDialogOpen(false);
  };

  const handleEdit = (produto: Produto) => {
    setEditingProduto(produto);
    setFormData({
      nome: produto.nome,
      categoria: produto.categoria || '',
      preco_venda: produto.preco_venda.toString(),
      ativo: produto.ativo,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduto) {
      updateMutation.mutate({ ...formData, id: editingProduto.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const calcularCustoInsumos = (produto: Produto) => {
    if (!produto.fichas_tecnicas) return 0;
    return produto.fichas_tecnicas.reduce((sum, ft) => {
      return sum + (Number(ft.quantidade) * Number(ft.insumos?.custo_unitario || 0));
    }, 0);
  };

  const calcularPrecoSugerido = (custoInsumos: number) => {
    const margemDesejada = config?.margem_desejada_padrao || 30;
    const taxaApp = (config as any)?.taxa_app_delivery || 12;
    // Preço = Custo / (1 - margem% - taxaApp%)
    return custoInsumos / (1 - (margemDesejada + taxaApp) / 100);
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
          <h1 className="text-3xl font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">Gerencie seus produtos e fichas técnicas</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingProduto ? 'Editar Produto' : 'Novo Produto'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: X-Burguer"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  placeholder="Ex: Lanches"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preco_venda">Preço de Venda (R$)</Label>
                <Input
                  id="preco_venda"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.preco_venda}
                  onChange={(e) => setFormData({ ...formData, preco_venda: e.target.value })}
                  placeholder="0,00"
                  required
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="ativo">Produto Ativo</Label>
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingProduto ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : produtos && produtos.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {produtos.map((produto) => {
            const custoInsumos = calcularCustoInsumos(produto);
            const precoSugerido = calcularPrecoSugerido(custoInsumos);
            const precoVenda = Number(produto.preco_venda);
            const cmvAtual = precoVenda > 0 ? (custoInsumos / precoVenda) * 100 : 0;
            const cmvAlvo = config?.cmv_alvo || 35;
            const margemContribuicao = precoVenda - custoInsumos;
            const isExpanded = expandedProduto === produto.id;
            const temFichaTecnica = produto.fichas_tecnicas && produto.fichas_tecnicas.length > 0;

            return (
              <Card key={produto.id} className={!produto.ativo ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{produto.nome}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(produto)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteMutation.mutate(produto.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {produto.categoria && (
                    <Badge variant="secondary" className="w-fit">
                      {produto.categoria}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Preço Atual</p>
                      <p className="font-bold text-lg">{formatCurrency(precoVenda)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Custo Insumos</p>
                      <p className="font-medium">{formatCurrency(custoInsumos)}</p>
                    </div>
                  </div>

                  {temFichaTecnica && (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Preço Sugerido</p>
                          <p className={`font-medium ${precoVenda < precoSugerido ? 'text-amber-600' : 'text-green-600'}`}>
                            {formatCurrency(precoSugerido)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Margem</p>
                          <p className="font-medium">{formatCurrency(margemContribuicao)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span>CMV: {cmvAtual.toFixed(1)}%</span>
                            <span className="text-muted-foreground">Alvo: {cmvAlvo}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${cmvAtual <= cmvAlvo ? 'bg-green-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(cmvAtual, 100)}%` }}
                            />
                          </div>
                        </div>
                        {cmvAtual > cmvAlvo && (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                    </>
                  )}

                  <Button
                    variant="ghost"
                    className="w-full justify-between"
                    onClick={() => setExpandedProduto(isExpanded ? null : produto.id)}
                  >
                    <span>Ficha Técnica ({produto.fichas_tecnicas?.length || 0} itens)</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>

                  {isExpanded && (
                    <FichaTecnicaForm
                      produtoId={produto.id}
                      fichaTecnica={produto.fichas_tecnicas || []}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum produto cadastrado</h3>
          <p className="text-muted-foreground mb-4">
            Comece adicionando seu primeiro produto.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Button>
        </Card>
      )}
    </div>
  );
};

export default Produtos;
