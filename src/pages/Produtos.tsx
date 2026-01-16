import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Package, Search, Filter, X, Upload } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProductCard from '@/components/produtos/ProductCard';
import ImportProdutosDialog from '@/components/import/ImportProdutosDialog';
import ImportFichaTecnicaDialog from '@/components/import/ImportFichaTecnicaDialog';

interface Produto {
  id: string;
  nome: string;
  categoria: string | null;
  preco_venda: number;
  ativo: boolean;
  rendimento_padrao?: number | null;
  imagem_url?: string | null;
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
  const [importProdutosOpen, setImportProdutosOpen] = useState(false);
  const [importFichasOpen, setImportFichasOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    preco_venda: '',
    ativo: true,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');

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

  // Duplicar produto
  const handleDuplicate = async (produto: Produto) => {
    if (!usuario?.empresa_id) return;
    
    try {
      // Criar cópia do produto
      const { data: novoProduto, error: produtoError } = await supabase
        .from('produtos')
        .insert({
          empresa_id: usuario.empresa_id,
          nome: `${produto.nome} (cópia)`,
          categoria: produto.categoria,
          preco_venda: produto.preco_venda,
          ativo: produto.ativo,
          rendimento_padrao: produto.rendimento_padrao,
        })
        .select()
        .single();
      
      if (produtoError) throw produtoError;
      
      // Copiar ficha técnica se existir
      if (produto.fichas_tecnicas && produto.fichas_tecnicas.length > 0) {
        const fichasParaCopiar = produto.fichas_tecnicas.map(ft => ({
          produto_id: novoProduto.id,
          insumo_id: ft.insumos.id,
          quantidade: ft.quantidade,
        }));
        
        const { error: fichasError } = await supabase
          .from('fichas_tecnicas')
          .insert(fichasParaCopiar);
        
        if (fichasError) throw fichasError;
      }
      
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      toast({ title: 'Produto duplicado com sucesso!' });
    } catch (error: any) {
      toast({ title: 'Erro ao duplicar', description: error.message, variant: 'destructive' });
    }
  };

  // Extrair categorias únicas dos produtos
  const categorias = React.useMemo(() => {
    if (!produtos) return [];
    const cats = produtos
      .map(p => p.categoria)
      .filter((c): c is string => c !== null && c !== '');
    return [...new Set(cats)].sort();
  }, [produtos]);

  // Filtrar produtos
  const produtosFiltrados = React.useMemo(() => {
    if (!produtos) return [];
    return produtos.filter(produto => {
      const matchSearch = produto.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategoria = categoriaFiltro === 'todas' || produto.categoria === categoriaFiltro;
      return matchSearch && matchCategoria;
    });
  }, [produtos, searchTerm, categoriaFiltro]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Produtos</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Gerencie seus produtos e fichas técnicas</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportProdutosOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Produtos
          </Button>
          <Button variant="outline" onClick={() => setImportFichasOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Fichas
          </Button>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          </DialogTrigger>
        </div>
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

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {categorias.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : produtosFiltrados && produtosFiltrados.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {produtosFiltrados.map((produto) => (
            <ProductCard
              key={produto.id}
              produto={produto}
              config={config}
              onEdit={() => handleEdit(produto)}
              onDelete={() => handleDeleteClick(produto.id)}
              onDuplicate={() => handleDuplicate(produto)}
            />
          ))}
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

      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
        title="Excluir produto"
        description="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
      />

      <ImportProdutosDialog
        open={importProdutosOpen}
        onOpenChange={setImportProdutosOpen}
        existingProdutos={produtos || []}
      />

      <ImportFichaTecnicaDialog
        open={importFichasOpen}
        onOpenChange={setImportFichasOpen}
      />
    </div>
  );
};

export default Produtos;
