import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invalidateEmpresaCachesAndRefetch } from '@/lib/queryConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Package, Search, Filter, X, Upload, ImageIcon, Loader2, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import ProductCard from '@/components/produtos/ProductCard';
import FichaTecnicaDialog from '@/components/produtos/FichaTecnicaDialog';
import ImportProdutosDialog from '@/components/import/ImportProdutosDialog';
import ImportFichaTecnicaDialog from '@/components/import/ImportFichaTecnicaDialog';
import CategorySelect from '@/components/produtos/CategorySelect';
import ContextualTip from '@/components/onboarding/ContextualTip';

interface Produto {
  id: string;
  nome: string;
  categoria: string | null;
  preco_venda: number;
  ativo: boolean;
  rendimento_padrao?: number | null;
  imagem_url?: string | null;
  observacoes_ficha?: string | null;
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importProdutosOpen, setImportProdutosOpen] = useState(false);
  const [importFichasOpen, setImportFichasOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [openFichaForProductId, setOpenFichaForProductId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    preco_venda: '',
    ativo: true,
    imagem_url: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch produtos with ficha técnica
  const { data: produtos, isLoading } = useQuery({
    queryKey: ['produtos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select(`
          id,
          nome,
          categoria,
          preco_venda,
          ativo,
          rendimento_padrao,
          imagem_url,
          observacoes_ficha,
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
        imagem_url: data.imagem_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
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
          imagem_url: data.imagem_url || null,
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
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
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast({ title: 'Produto excluído!' });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation para aplicar preço sugerido
  const applyPriceMutation = useMutation({
    mutationFn: async ({ id, novoPreco }: { id: string; novoPreco: number }) => {
      const { error } = await supabase
        .from('produtos')
        .update({ preco_venda: novoPreco })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast({ title: 'Preço atualizado!', description: 'O preço sugerido foi aplicado com sucesso.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar preço', description: error.message, variant: 'destructive' });
    },
  });

  const handleApplyPrice = (produtoId: string, novoPreco: number) => {
    applyPriceMutation.mutate({ id: produtoId, novoPreco });
  };

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
    setFormData({ nome: '', categoria: '', preco_venda: '', ativo: true, imagem_url: '' });
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
      imagem_url: produto.imagem_url || '',
    });
    setDialogOpen(true);
  };

  // Upload de imagem
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usuario?.empresa_id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem.', variant: 'destructive' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 5MB.', variant: 'destructive' });
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${usuario.empresa_id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, imagem_url: urlData.publicUrl }));
      toast({ title: 'Imagem enviada!' });
    } catch (error: any) {
      toast({ title: 'Erro ao enviar imagem', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduto) {
      updateMutation.mutate({ ...formData, id: editingProduto.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Handler para quando duplicar produto com sucesso
  const handleDuplicateSuccess = (novoProdutoId: string) => {
    // Aguardar o refetch dos produtos e então abrir a ficha técnica do novo produto
    setOpenFichaForProductId(novoProdutoId);
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
      <ContextualTip
        tipKey="produtos-intro"
        title="🍰 Monte seus produtos e descubra o custo real!"
        description="Crie o produto que você vende, depois clique em 'Ficha Técnica' para vincular os ingredientes. O sistema calcula o custo automaticamente!"
      />
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
              {/* Upload de imagem */}
              <div className="space-y-2">
                <Label>Foto do Produto</Label>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-20 h-20 bg-muted rounded-md flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {formData.imagem_url ? (
                      <img 
                        src={formData.imagem_url} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : uploadingImage ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          {formData.imagem_url ? 'Trocar foto' : 'Enviar foto'}
                        </>
                      )}
                    </Button>
                    {formData.imagem_url && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        className="ml-2 text-destructive"
                        onClick={() => setFormData(prev => ({ ...prev, imagem_url: '' }))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG até 5MB</p>
                  </div>
                </div>
              </div>

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
                <CategorySelect
                  value={formData.categoria}
                  onChange={(value) => setFormData({ ...formData, categoria: value })}
                  categories={categorias}
                  placeholder="Selecione ou crie uma categoria"
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
              onApplyPrice={handleApplyPrice}
              isApplyingPrice={applyPriceMutation.isPending}
              onDuplicateSuccess={handleDuplicateSuccess}
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

      {/* Ficha técnica controlada para novo produto duplicado */}
      {openFichaForProductId && (() => {
        const novoProduto = produtos?.find(p => p.id === openFichaForProductId);
        if (!novoProduto) return null;
        return (
          <FichaTecnicaDialog
            produtoId={novoProduto.id}
            produtoNome={novoProduto.nome}
            fichaTecnica={novoProduto.fichas_tecnicas || []}
            rendimentoPadrao={novoProduto.rendimento_padrao}
            observacoesFicha={novoProduto.observacoes_ficha}
            defaultOpen={true}
            onClose={() => setOpenFichaForProductId(null)}
          />
        );
      })()}
    </div>
  );
};

export default Produtos;
