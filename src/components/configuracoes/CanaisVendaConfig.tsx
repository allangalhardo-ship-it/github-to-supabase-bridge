import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Plus, Store, Truck, Send, Pencil, Trash2, 
  ChevronDown, ChevronRight, Percent 
} from 'lucide-react';
import { useCanaisVenda, CanalComTaxaTotal, TaxaCanal } from '@/hooks/useCanaisVenda';
import { cn } from '@/lib/utils';
import { fmtNum } from '@/lib/format';
import NovoCanalPrecosDialog from './NovoCanalPrecosDialog';
import CanalTaxasForm from './CanalTaxasForm';

const TIPOS_CANAL = [
  { value: 'presencial', label: 'Presencial', icon: Store, description: 'Balcão, loja física' },
  { value: 'app_delivery', label: 'App Delivery', icon: Truck, description: 'iFood, Rappi, 99Food...' },
  { value: 'proprio', label: 'Canal Próprio', icon: Send, description: 'WhatsApp, site próprio, motoboy...' },
];

const getTipoIcon = (tipo: string) => {
  const tipoConfig = TIPOS_CANAL.find(t => t.value === tipo);
  return tipoConfig?.icon || Store;
};

const getTipoLabel = (tipo: string) => {
  const tipoConfig = TIPOS_CANAL.find(t => t.value === tipo);
  return tipoConfig?.label || tipo;
};

const CanaisVendaConfig: React.FC = () => {
  const {
    canais,
    isLoading,
    createCanal,
    updateCanal,
    toggleCanal,
    deleteCanal,
    addTaxa,
    updateTaxa,
    deleteTaxa,
    isCreating,
  } = useCanaisVenda();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCanal, setEditingCanal] = useState<CanalComTaxaTotal | null>(null);
  const [formData, setFormData] = useState({ nome: '', tipo: 'app_delivery' });
  
  const [taxaDialogOpen, setTaxaDialogOpen] = useState(false);
  const [taxaCanalId, setTaxaCanalId] = useState<string | null>(null);
  const [editingTaxa, setEditingTaxa] = useState<TaxaCanal | null>(null);
  const [taxaFormData, setTaxaFormData] = useState({ nome: '', percentual: '' });

  const [canalNovo, setCanalNovo] = useState<{ id: string; nome: string; tipo: string } | null>(null);
  const [expandedCanais, setExpandedCanais] = useState<Set<string>>(new Set());

  const resetCanalForm = () => {
    setFormData({ nome: '', tipo: 'app_delivery' });
    setEditingCanal(null);
    setDialogOpen(false);
  };

  const resetTaxaForm = () => {
    setTaxaFormData({ nome: '', percentual: '' });
    setEditingTaxa(null);
    setTaxaCanalId(null);
    setTaxaDialogOpen(false);
  };

  const handleEditCanal = (canal: CanalComTaxaTotal) => {
    setEditingCanal(canal);
    setFormData({ nome: canal.nome, tipo: canal.tipo });
    setDialogOpen(true);
  };

  const handleSubmitCanal = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCanal) {
      updateCanal({ id: editingCanal.id, ...formData });
    } else {
      createCanal(formData, { onSuccess: (c: any) => c && setCanalNovo({ id: c.id, nome: c.nome, tipo: c.tipo }) });
    }
    resetCanalForm();
  };

  const handleAddTaxa = (canalId: string) => {
    setTaxaCanalId(canalId);
    setTaxaDialogOpen(true);
  };

  const handleEditTaxa = (taxa: TaxaCanal) => {
    setEditingTaxa(taxa);
    setTaxaFormData({ nome: taxa.nome, percentual: taxa.percentual.toString() });
    setTaxaDialogOpen(true);
  };

  const handleSubmitTaxa = (e: React.FormEvent) => {
    e.preventDefault();
    const percentual = parseFloat(taxaFormData.percentual) || 0;

    if (editingTaxa) {
      updateTaxa({ id: editingTaxa.id, nome: taxaFormData.nome, percentual });
    } else if (taxaCanalId) {
      addTaxa({ canal_id: taxaCanalId, nome: taxaFormData.nome, percentual });
    }
    resetTaxaForm();
  };

  const toggleExpanded = (canalId: string) => {
    const newExpanded = new Set(expandedCanais);
    if (newExpanded.has(canalId)) {
      newExpanded.delete(canalId);
    } else {
      newExpanded.add(canalId);
    }
    setExpandedCanais(newExpanded);
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const canaisPorTipo = {
    presencial: canais?.filter(c => c.tipo === 'presencial') || [],
    app_delivery: canais?.filter(c => c.tipo === 'app_delivery') || [],
    proprio: canais?.filter(c => c.tipo === 'proprio') || [],
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Canais de Atendimento
            </CardTitle>
            <CardDescription>
              Configure seus canais de venda e as taxas de cada um
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetCanalForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Novo Canal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCanal ? 'Editar Canal' : 'Novo Canal'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitCanal} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Canal</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: iFood, Balcão VIP, WhatsApp..."
                    value={formData.nome}
                    onChange={(e) => {
                      const nome = e.target.value;
                      // Ao criar, WhatsApp/Instagram já vêm como Canal Próprio (pode trocar)
                      const sugerirProprio = !editingCanal && /whats|insta/i.test(nome) && formData.tipo === 'app_delivery';
                      setFormData({ ...formData, nome, tipo: sugerirProprio ? 'proprio' : formData.tipo });
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_CANAL.map(tipo => {
                        const Icon = tipo.icon;
                        return (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{tipo.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetCanalForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {editingCanal ? 'Salvar' : 'Criar Canal'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {TIPOS_CANAL.map(tipoConfig => {
          const Icon = tipoConfig.icon;
          const canaisDoTipo = canaisPorTipo[tipoConfig.value as keyof typeof canaisPorTipo];

          if (canaisDoTipo.length === 0) return null;

          return (
            <div key={tipoConfig.value} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon className="h-4 w-4" />
                {tipoConfig.label}
              </div>

              {canaisDoTipo.map(canal => (
                <CanalCard
                  key={canal.id}
                  canal={canal}
                  isExpanded={expandedCanais.has(canal.id)}
                  onToggleExpand={() => toggleExpanded(canal.id)}
                  onEdit={() => handleEditCanal(canal)}
                  onToggleAtivo={(ativo) => toggleCanal({ id: canal.id, ativo })}
                  onDelete={() => deleteCanal(canal.id)}
                  onAddTaxa={() => handleAddTaxa(canal.id)}
                  onEditTaxa={handleEditTaxa}
                  onDeleteTaxa={(id) => deleteTaxa(id)}
                />
              ))}
            </div>
          );
        })}

        {(!canais || canais.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum canal configurado</p>
            <p className="text-sm">Adicione canais como Balcão, iFood, WhatsApp...</p>
          </div>
        )}
      </CardContent>

      {/* Dialog para adicionar/editar taxa */}
      <Dialog open={taxaDialogOpen} onOpenChange={(open) => {
        setTaxaDialogOpen(open);
        if (!open) resetTaxaForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTaxa ? 'Editar Taxa' : 'Nova Taxa'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitTaxa} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="taxa_nome">Nome da Taxa</Label>
              <Input
                id="taxa_nome"
                placeholder="Ex: Comissão, Taxa de entrega, Marketing..."
                value={taxaFormData.nome}
                onChange={(e) => setTaxaFormData({ ...taxaFormData, nome: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxa_percentual">Percentual (%)</Label>
              <Input
                id="taxa_percentual"
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="Ex: 12"
                value={taxaFormData.percentual}
                onChange={(e) => setTaxaFormData({ ...taxaFormData, percentual: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={resetTaxaForm}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingTaxa ? 'Salvar' : 'Adicionar Taxa'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <NovoCanalPrecosDialog canal={canalNovo} onClose={() => setCanalNovo(null)} />
    </Card>
  );
};

// Componente de Card do Canal
interface CanalCardProps {
  canal: CanalComTaxaTotal;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onToggleAtivo: (ativo: boolean) => void;
  onDelete: () => void;
  onAddTaxa: () => void;
  onEditTaxa: (taxa: TaxaCanal) => void;
  onDeleteTaxa: (id: string) => void;
}

const CanalCard: React.FC<CanalCardProps> = ({
  canal,
  isExpanded,
  onToggleExpand,
  onEdit,
  onToggleAtivo,
  onDelete,
  onAddTaxa,
  onEditTaxa,
  onDeleteTaxa,
}) => {
  const Icon = getTipoIcon(canal.tipo);
  const hasTaxas = canal.taxas && canal.taxas.length > 0;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div className={cn(
        "border rounded-lg",
        !canal.ativo && "opacity-60"
      )}>
        <div className="flex items-center justify-between p-3">
          <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <Icon className="h-4 w-4" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{canal.nome}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                  {getTipoLabel(canal.tipo)}
                </Badge>
                {canal.taxaTotal > 0 && (
                  <span className="flex items-center gap-1">
                    <Percent className="h-3 w-3" />
                    {fmtNum(canal.taxaTotal, 1)}% total
                  </span>
                )}
              </div>
            </div>
          </CollapsibleTrigger>

          <div className="flex items-center gap-2">
            <Switch
              checked={canal.ativo}
              onCheckedChange={onToggleAtivo}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <CanalTaxasForm canal={canal} />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default CanaisVendaConfig;
