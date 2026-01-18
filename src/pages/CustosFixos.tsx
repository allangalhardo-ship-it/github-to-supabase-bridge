import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { MobileDataView } from '@/components/ui/mobile-data-view';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Wallet, TrendingUp, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';

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

interface Configuracoes {
  id: string;
  faturamento_mensal: number;
}

const CustosFixos = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCusto, setEditingCusto] = useState<CustoFixo | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [faturamentoInput, setFaturamentoInput] = useState('');
  const [isEditingFaturamento, setIsEditingFaturamento] = useState(false);
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

  const { data: configuracoes } = useQuery({
    queryKey: ['configuracoes-faturamento', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('id, faturamento_mensal')
        .eq('empresa_id', usuario!.empresa_id)
        .maybeSingle();

      if (error) throw error;
      return data as Configuracoes | null;
    },
    enabled: !!usuario?.empresa_id,
  });

  useEffect(() => {
    if (configuracoes?.faturamento_mensal) {
      setFaturamentoInput(configuracoes.faturamento_mensal.toString());
    }
  }, [configuracoes]);

  const updateFaturamentoMutation = useMutation({
    mutationFn: async (valor: number) => {
      if (configuracoes?.id) {
        const { error } = await supabase
          .from('configuracoes')
          .update({ faturamento_mensal: valor })
          .eq('id', configuracoes.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('configuracoes')
          .insert({
            empresa_id: usuario!.empresa_id,
            faturamento_mensal: valor,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-faturamento'] });
      toast({ title: 'Faturamento atualizado!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
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
  const faturamento = configuracoes?.faturamento_mensal || 0;
  const percentualCustoFixo = faturamento > 0 ? (totalMensal / faturamento) * 100 : 0;

  const getHealthStatus = (percentual: number) => {
    if (percentual === 0 || faturamento === 0) {
      return { label: 'Informe o faturamento', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: AlertCircle, status: 'neutral' };
    }
    if (percentual <= 20) {
      return { label: 'Saudável', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle2, status: 'healthy' };
    }
    if (percentual <= 25) {
      return { label: 'Atenção', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: AlertTriangle, status: 'warning' };
    }
    return { label: 'Alarmante', color: 'text-red-600', bgColor: 'bg-red-100', icon: AlertTriangle, status: 'danger' };
  };

  const healthStatus = getHealthStatus(percentualCustoFixo);
  const HealthIcon = healthStatus.icon;

  const handleSaveFaturamento = () => {
    const valor = parseFloat(faturamentoInput) || 0;
    updateFaturamentoMutation.mutate(valor);
    setIsEditingFaturamento(false);
  };

  const handleCancelFaturamento = () => {
    setFaturamentoInput((configuracoes?.faturamento_mensal || 0).toString());
    setIsEditingFaturamento(false);
  };

  const getProgressColor = () => {
    if (faturamento === 0) return 'bg-muted';
    if (percentualCustoFixo <= 20) return 'bg-green-500';
    if (percentualCustoFixo <= 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

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

      {/* Health Indicator Card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: Faturamento Input */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <Label className="text-base font-medium">Faturamento Mensal</Label>
              </div>
              
              {isEditingFaturamento ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">R$</span>
                    <Input
                      id="faturamento"
                      type="number"
                      step="0.01"
                      min="0"
                      value={faturamentoInput}
                      onChange={(e) => setFaturamentoInput(e.target.value)}
                      placeholder="0,00"
                      className="max-w-[200px]"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={handleSaveFaturamento}
                      disabled={updateFaturamentoMutation.isPending}
                    >
                      {updateFaturamentoMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleCancelFaturamento}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div 
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => setIsEditingFaturamento(true)}
                  >
                    <span className="text-2xl font-bold">
                      {faturamento > 0 ? formatCurrency(faturamento) : 'R$ 0,00'}
                    </span>
                    <Button size="sm" variant="ghost" className="h-7 px-2">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {faturamento === 0 && totalMensal > 0 && (
                    <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        💡 Para seus custos fixos ficarem saudáveis (até 20%):
                      </p>
                      <p className="text-lg font-bold text-amber-600">
                        Fature pelo menos {formatCurrency(totalMensal / 0.20)}/mês
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Clique acima para informar seu faturamento atual
                      </p>
                    </div>
                  )}
                  {faturamento === 0 && totalMensal === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Clique para informar seu faturamento mensal
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right: Health Status */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Custos Fixos</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalMensal)}</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${healthStatus.bgColor}`}>
                  <HealthIcon className={`h-5 w-5 ${healthStatus.color}`} />
                  <span className={`font-medium ${healthStatus.color}`}>
                    {healthStatus.label}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Percentual do Faturamento</span>
                  <span className={`font-bold ${faturamento > 0 ? healthStatus.color : 'text-muted-foreground'}`}>
                    {faturamento > 0 ? `${percentualCustoFixo.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div 
                    className={`absolute left-0 top-0 h-full transition-all duration-500 ${getProgressColor()}`}
                    style={{ width: `${Math.min(percentualCustoFixo, 100)}%` }}
                  />
                  {/* Markers */}
                  <div className="absolute left-[20%] top-0 h-full w-px bg-green-600/50" title="20% - Limite saudável" />
                  <div className="absolute left-[25%] top-0 h-full w-px bg-red-600/50" title="25% - Limite alarmante" />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0%</span>
                  <span className="text-green-600">20%</span>
                  <span className="text-red-600">25%</span>
                  <span>50%+</span>
                </div>
              </div>

              {faturamento > 0 && percentualCustoFixo <= 20 && (
                <p className="text-sm text-green-600">
                  ✓ Seus custos fixos estão controlados e dentro do ideal para um negócio saudável.
                </p>
              )}

              {faturamento > 0 && percentualCustoFixo > 20 && percentualCustoFixo <= 25 && (
                <p className="text-sm text-yellow-600">
                  ⚠️ Seus custos fixos estão próximos do limite. Fique atento para não ultrapassar 25%.
                </p>
              )}

              {faturamento > 0 && percentualCustoFixo > 25 && (() => {
                // Para chegar a 20% (saudável):
                // Opção 1: Reduzir custos → custos_alvo = faturamento * 0.20
                const custosAlvo = faturamento * 0.20;
                const reducaoCustos = totalMensal - custosAlvo;
                
                // Opção 2: Aumentar faturamento → faturamento_alvo = totalMensal / 0.20
                const faturamentoAlvo = totalMensal / 0.20;
                const aumentoFaturamento = faturamentoAlvo - faturamento;

                return (
                  <div className="text-sm text-red-600 space-y-2">
                    <p>⚠️ Seus custos fixos estão acima de 25% do faturamento. Considere revisar suas despesas.</p>
                    <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg space-y-1">
                      <p className="font-medium">Para alcançar uma margem saudável (20%):</p>
                      <p>• Reduza <strong>{formatCurrency(reducaoCustos)}</strong> em custos fixos, ou</p>
                      <p>• Aumente o faturamento em <strong>{formatCurrency(aumentoFaturamento)}</strong></p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <MobileDataView
          data={custos || []}
          columns={[
            {
              key: 'nome',
              header: 'Nome',
              mobilePriority: 1,
              render: (custo) => <span className="font-medium truncate block max-w-[150px] sm:max-w-none">{custo.nome}</span>,
            },
            {
              key: 'categoria',
              header: 'Categoria',
              mobilePriority: 3,
              render: (custo) => custo.categoria ? (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 truncate max-w-[80px]">{custo.categoria}</Badge>
              ) : <span className="text-muted-foreground">-</span>,
            },
            {
              key: 'valor',
              header: 'Valor Mensal',
              align: 'right',
              mobilePriority: 2,
              render: (custo) => (
                <span className="font-medium">{formatCurrency(Number(custo.valor_mensal))}</span>
              ),
            },
          ]}
          keyExtractor={(custo) => custo.id}
          renderActions={(custo) => (
            <>
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
            </>
          )}
          renderMobileHeader={(custo) => (
            <span className="truncate block max-w-[180px]">{custo.nome}</span>
          )}
          renderMobileSubtitle={(custo) => custo.categoria ? (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 max-w-[80px] truncate">{custo.categoria}</Badge>
          ) : null}
          renderMobileHighlight={(custo) => (
            <span className="font-bold text-foreground">
              {formatCurrency(Number(custo.valor_mensal))}
            </span>
          )}
          emptyMessage="Nenhum custo fixo cadastrado"
          emptyAction={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Custo Fixo
            </Button>
          }
        />
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
