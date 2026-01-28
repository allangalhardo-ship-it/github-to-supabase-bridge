import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invalidateEmpresaCachesAndRefetch } from '@/lib/queryConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { MobileDataView, Column } from '@/components/ui/mobile-data-view';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, AlertTriangle, ShoppingCart, Upload, TrendingUp, Search, X, Download, Package } from 'lucide-react';
import { InsumoIcon } from '@/lib/insumoIconUtils';
import { formatCurrencySmartBRL } from '@/lib/format';
import ListaCompras from '@/components/insumos/ListaCompras';
import ImportInsumosDialog from '@/components/import/ImportInsumosDialog';
import HistoricoPrecos from '@/components/insumos/HistoricoPrecos';
import { ImportarBasePadraoDialog } from '@/components/insumos/ImportarBasePadraoDialog';
const unidadesMedida = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'pct', label: 'Pacote (pct)' },
  { value: 'dz', label: 'Dúzia (dz)' },
];

interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  estoque_atual: number;
  estoque_minimo: number;
  is_intermediario: boolean;
  rendimento_receita: number | null;
}

const Insumos = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [activeTab, setActiveTab] = useState<string>("todos");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [historicoInsumo, setHistoricoInsumo] = useState<{ id: string; nome: string; custo: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    unidade_medida: 'kg',
    custo_unitario: '',
    estoque_atual: '',
    estoque_minimo: '',
  });

  // Buscar apenas insumos simples (não intermediários)
  const { data: insumos, isLoading } = useQuery({
    queryKey: ['insumos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .eq('is_intermediario', false)
        .order('nome');

      if (error) throw error;
      return data as Insumo[];
    },
    enabled: !!usuario?.empresa_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('insumos').insert({
        empresa_id: usuario!.empresa_id,
        nome: data.nome,
        unidade_medida: data.unidade_medida,
        custo_unitario: parseFloat(data.custo_unitario) || 0,
        estoque_atual: parseFloat(data.estoque_atual) || 0,
        estoque_minimo: parseFloat(data.estoque_minimo) || 0,
        is_intermediario: false,
        rendimento_receita: null,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast({ title: 'Insumo criado com sucesso!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar insumo', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const { error } = await supabase
        .from('insumos')
        .update({
          nome: data.nome,
          unidade_medida: data.unidade_medida,
          custo_unitario: parseFloat(data.custo_unitario) || 0,
          estoque_atual: parseFloat(data.estoque_atual) || 0,
          estoque_minimo: parseFloat(data.estoque_minimo) || 0,
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast({ title: 'Insumo atualizado!' });
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('insumos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast({ title: 'Insumo excluído!' });
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
    setFormData({
      nome: '',
      unidade_medida: 'kg',
      custo_unitario: '',
      estoque_atual: '',
      estoque_minimo: '',
    });
    setEditingInsumo(null);
    setDialogOpen(false);
  };

  const handleEdit = (insumo: Insumo) => {
    setEditingInsumo(insumo);
    setFormData({
      nome: insumo.nome,
      unidade_medida: insumo.unidade_medida,
      custo_unitario: insumo.custo_unitario.toString(),
      estoque_atual: insumo.estoque_atual.toString(),
      estoque_minimo: insumo.estoque_minimo.toString(),
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingInsumo) {
      updateMutation.mutate({ ...formData, id: editingInsumo.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  const formatCurrency = formatCurrencySmartBRL;

  const insumoColumns: Column<Insumo>[] = useMemo(() => [
    {
      key: 'nome',
      header: 'Nome',
      mobilePriority: 1,
      render: (insumo) => {
        const estoqueBaixo = Number(insumo.estoque_atual) <= Number(insumo.estoque_minimo);
        return (
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden max-w-full">
            <span className="shrink-0">
              <InsumoIcon nome={insumo.nome} />
            </span>
            <span className="font-medium truncate flex-1 min-w-0">{insumo.nome}</span>
            {estoqueBaixo && (
              <Badge variant="destructive" className="gap-0.5 shrink-0 text-[10px] px-1.5 py-0">
                <AlertTriangle className="h-3 w-3" />
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'unidade',
      header: 'Unidade',
      align: 'center',
      mobilePriority: 3,
      render: (insumo) => insumo.unidade_medida,
    },
    {
      key: 'custo',
      header: 'Custo Unit.',
      align: 'right',
      mobilePriority: 2,
      render: (insumo) => formatCurrency(Number(insumo.custo_unitario)),
    },
    {
      key: 'estoque',
      header: 'Estoque',
      align: 'right',
      mobilePriority: 4,
      render: (insumo) => {
        const estoqueBaixo = Number(insumo.estoque_atual) <= Number(insumo.estoque_minimo);
        return (
          <span className={estoqueBaixo ? 'text-destructive font-medium' : ''}>
            {Number(insumo.estoque_atual).toFixed(2)}
          </span>
        );
      },
    },
    {
      key: 'minimo',
      header: 'Mínimo',
      align: 'right',
      mobilePriority: 5,
      render: (insumo) => (
        <span className="text-muted-foreground">
          {Number(insumo.estoque_minimo).toFixed(2)}
        </span>
      ),
    },
  ], []);

  const renderInsumoActions = (insumo: Insumo) => (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-blue-500 hover:text-blue-600"
        onClick={() => {
          setHistoricoInsumo({
            id: insumo.id,
            nome: insumo.nome,
            custo: Number(insumo.custo_unitario),
          });
          setHistoricoDialogOpen(true);
        }}
        title="Histórico de preços"
      >
        <TrendingUp className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => handleEdit(insumo)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive"
        onClick={() => handleDeleteClick(insumo.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );

  const renderTable = (items: Insumo[]) => (
    <MobileDataView
      data={items}
      columns={insumoColumns}
      keyExtractor={(insumo) => insumo.id}
      renderActions={renderInsumoActions}
      renderMobileHeader={(insumo) => (
        <div className="flex items-start gap-2 min-w-0">
          <span className="shrink-0 mt-0.5">
            <InsumoIcon nome={insumo.nome} />
          </span>
          <span className="min-w-0 whitespace-normal break-words leading-snug">
            {insumo.nome}
          </span>
        </div>
      )}
      renderMobileSubtitle={(insumo) => {
        const estoqueBaixo = Number(insumo.estoque_atual) <= Number(insumo.estoque_minimo);
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span>{insumo.unidade_medida}</span>
            {estoqueBaixo && (
              <Badge variant="destructive" className="gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" />
                Estoque baixo
              </Badge>
            )}
          </div>
        );
      }}
      renderMobileHighlight={(insumo) => (
        <div className="text-right">
          <p className="font-bold text-foreground">{formatCurrency(Number(insumo.custo_unitario))}</p>
          <p className="text-xs text-muted-foreground">
            Estoque: {Number(insumo.estoque_atual).toFixed(2)}
          </p>
        </div>
      )}
      getRowClassName={(insumo) => 
        Number(insumo.estoque_atual) <= Number(insumo.estoque_minimo) ? 'border-l-4 border-l-destructive' : ''
      }
      emptyMessage="Nenhum insumo cadastrado"
      emptyAction={
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Insumo
        </Button>
      }
    />
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Insumos</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Gerencie os insumos e matérias-primas</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <div className="flex flex-wrap gap-2">
            <ImportarBasePadraoDialog />
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Importar Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Novo Insumo</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </DialogTrigger>
          </div>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Farinha de Trigo"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unidade_medida">Como usa nas receitas?</Label>
                  <Select
                    value={formData.unidade_medida}
                    onValueChange={(value) => setFormData({ ...formData, unidade_medida: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {unidadesMedida.map((un) => (
                        <SelectItem key={un.value} value={un.value}>
                          {un.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Ex: "100g de farinha" → escolha Grama
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estoque_minimo">Avise quando faltar</Label>
                  <Input
                    id="estoque_minimo"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.estoque_minimo}
                    onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })}
                    placeholder="Ex: 5"
                  />
                  <p className="text-xs text-muted-foreground">
                    Você receberá alerta quando chegar nesse nível
                  </p>
                </div>
              </div>

              {!editingInsumo && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  <strong>💡 Dica:</strong> Custo e estoque serão preenchidos automaticamente quando você registrar compras. 
                  A conversão de unidades (ex: comprar em kg, usar em g) é feita no momento da compra.
                </div>
              )}

              {/* Campos adicionais só aparecem na edição */}
              {editingInsumo && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="custo_unitario">Custo Unitário</Label>
                    <Input
                      id="custo_unitario"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.custo_unitario}
                      onChange={(e) => setFormData({ ...formData, custo_unitario: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estoque_atual">Estoque Atual</Label>
                    <Input
                      id="estoque_atual"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.estoque_atual}
                      onChange={(e) => setFormData({ ...formData, estoque_atual: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingInsumo ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : insumos && insumos.length > 0 ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 grid grid-cols-2 sm:flex sm:flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="todos" className="gap-1.5 text-xs sm:text-sm px-3 py-2 justify-center">
              <Package className="h-4 w-4" />
              <span>Todos</span>
              <Badge variant="secondary" className="ml-1 text-[10px] sm:text-xs">{insumos.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="lista-compras" className="gap-1.5 text-xs sm:text-sm px-3 py-2 justify-center">
              <ShoppingCart className="h-4 w-4 text-green-600" />
              <span>Compras</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="todos">
            {/* Busca de insumos */}
            <div className="mb-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar insumo..."
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
            </div>
            {(() => {
              const filteredInsumos = insumos.filter(i => 
                i.nome.toLowerCase().includes(searchTerm.toLowerCase())
              );
              return filteredInsumos.length > 0 ? (
                renderTable(filteredInsumos)
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum insumo encontrado para "{searchTerm}"</p>
                  <Button variant="link" onClick={() => setSearchTerm('')}>
                    Limpar busca
                  </Button>
                </div>
              );
            })()}
          </TabsContent>

          <TabsContent value="lista-compras">
            <ListaCompras />
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum insumo cadastrado</h3>
          <p className="text-muted-foreground mb-4">
            Comece adicionando seus primeiros insumos.
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Insumo
          </Button>
        </Card>
      )}

      <DeleteConfirmationDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={confirmDelete}
        title="Excluir insumo"
        description="Tem certeza que deseja excluir este insumo? Esta ação não pode ser desfeita."
      />

      <ImportInsumosDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        existingInsumos={insumos || []}
      />

      {historicoInsumo && (
        <HistoricoPrecos
          open={historicoDialogOpen}
          onOpenChange={setHistoricoDialogOpen}
          insumoId={historicoInsumo.id}
          insumoNome={historicoInsumo.nome}
          custoAtual={historicoInsumo.custo}
        />
      )}
    </div>
  );
};

export default Insumos;
