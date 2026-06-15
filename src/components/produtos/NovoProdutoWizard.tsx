import React, { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invalidateEmpresaCachesAndRefetch } from '@/lib/queryConfig';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import CategorySelect from './CategorySelect';
import FichaTecnicaForm from './FichaTecnicaForm';
import PrecosCanaisEditor from './PrecosCanaisEditor';
import CustoMargemCard from './CustoMargemCard';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  ImageIcon,
  Loader2,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  Tag,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NovoProdutoWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorias: string[];
  onCreated?: (produtoId: string) => void;
}

type Step = 1 | 2 | 3;

const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 1, label: 'Identificação', icon: <Tag className="h-4 w-4" /> },
  { id: 2, label: 'Ficha técnica', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 3, label: 'Preços por canal', icon: <DollarSign className="h-4 w-4" /> },
];

const NovoProdutoWizard: React.FC<NovoProdutoWizardProps> = ({
  open,
  onOpenChange,
  categorias,
  onCreated,
}) => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    ativo: true,
    imagem_url: '',
  });

  const reset = () => {
    setStep(1);
    setProdutoId(null);
    setFormData({ nome: '', categoria: '', ativo: true, imagem_url: '' });
  };

  const handleClose = () => {
    if (produtoId) {
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      onCreated?.(produtoId);
    }
    reset();
    onOpenChange(false);
  };

  // Config para cálculo de custo/margem
  const { data: config } = useQuery({
    queryKey: ['config', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('imposto_medio_sobre_vendas, margem_desejada_padrao')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id && open,
  });

  // Ficha técnica do produto criado (para mostrar custo ao vivo)
  const { data: fichaTecnica } = useQuery({
    queryKey: ['ficha-tecnica-wizard', produtoId],
    queryFn: async () => {
      if (!produtoId) return [];
      const { data, error } = await supabase
        .from('fichas_tecnicas')
        .select('id, quantidade, insumos (id, nome, unidade_medida, custo_unitario)')
        .eq('produto_id', produtoId);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!produtoId && step >= 2,
    refetchInterval: step === 2 ? 1500 : false,
  });

  const custoFicha = React.useMemo(() => {
    if (!fichaTecnica) return 0;
    return fichaTecnica.reduce(
      (sum, ft: any) =>
        sum + (Number(ft.quantidade) || 0) * (Number(ft.insumos?.custo_unitario) || 0),
      0
    );
  }, [fichaTecnica]);

  // Upload de imagem
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usuario?.empresa_id) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Selecione uma imagem.', variant: 'destructive' });
      return;
    }
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
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      setFormData((prev) => ({ ...prev, imagem_url: urlData.publicUrl }));
      toast({ title: 'Imagem enviada!' });
    } catch (error: any) {
      toast({ title: 'Erro ao enviar imagem', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingImage(false);
    }
  };

  // Cria o produto ao avançar do passo 1
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!usuario?.empresa_id) throw new Error('Empresa não identificada.');
      const { data, error } = await supabase
        .from('produtos')
        .insert({
          empresa_id: usuario.empresa_id,
          nome: formData.nome,
          categoria: formData.categoria || null,
          preco_venda: 0,
          ativo: formData.ativo,
          imagem_url: formData.imagem_url || null,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      setProdutoId(id);
      setStep(2);
      invalidateEmpresaCachesAndRefetch(usuario?.empresa_id);
      toast({ title: 'Produto criado!', description: 'Agora monte a ficha técnica.' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao criar produto', description: err.message, variant: 'destructive' });
    },
  });

  const goNext = () => {
    if (step === 1) {
      if (!formData.nome.trim()) {
        toast({ title: 'Informe o nome do produto', variant: 'destructive' });
        return;
      }
      if (produtoId) {
        // já criado (voltou e avançou de novo)
        setStep(2);
      } else {
        createMutation.mutate();
      }
    } else if (step === 2) {
      setStep(3);
    } else {
      handleClose();
    }
  };

  const goBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : onOpenChange(o))}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Produto</DialogTitle>
          <DialogDescription>
            Cadastre em 3 passos: identifique, monte a ficha e defina os preços.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between gap-2 py-3 border-y">
          {steps.map((s, idx) => {
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <React.Fragment key={s.id}>
                <div
                  className={cn(
                    'flex items-center gap-2 text-sm',
                    isActive && 'text-primary font-semibold',
                    isDone && 'text-success',
                    !isActive && !isDone && 'text-muted-foreground'
                  )}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs',
                      isActive && 'border-primary bg-primary/10',
                      isDone && 'border-success bg-success/10',
                      !isActive && !isDone && 'border-muted-foreground/30'
                    )}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : s.id}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex-1 h-px bg-border" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Conteúdo do passo */}
        <div className="py-2 space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Foto do produto</Label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-20 h-20 bg-muted rounded-md flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {formData.imagem_url ? (
                      <img src={formData.imagem_url} alt="Preview" className="w-full h-full object-cover" />
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
                        onClick={() => setFormData((p) => ({ ...p, imagem_url: '' }))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG até 5MB</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wizard-nome">Nome *</Label>
                <Input
                  id="wizard-nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: X-Burguer"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wizard-categoria">Categoria</Label>
                <CategorySelect
                  value={formData.categoria}
                  onChange={(value) => setFormData({ ...formData, categoria: value })}
                  categories={categorias}
                  placeholder="Selecione ou crie uma categoria"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="wizard-ativo">Produto ativo</Label>
                <Switch
                  id="wizard-ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
                />
              </div>
            </div>
          )}

          {step === 2 && produtoId && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold mb-1">Monte a ficha técnica</h3>
                <p className="text-xs text-muted-foreground">
                  Adicione os ingredientes e quantidades. O custo é calculado automaticamente.
                </p>
              </div>
              <FichaTecnicaForm produtoId={produtoId} fichaTecnica={(fichaTecnica || []) as any} />
              <div className="rounded-md bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Custo total da ficha</p>
                <p className="text-lg font-bold">
                  {custoFicha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>
          )}

          {step === 3 && produtoId && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold mb-1">Defina os preços por canal</h3>
                <p className="text-xs text-muted-foreground">
                  Cada canal tem taxa diferente. Veja a margem em tempo real.
                </p>
              </div>
              <CustoMargemCard
                custoFicha={custoFicha}
                precoBase={0}
                produtoId={produtoId}
                impostoPercentual={config?.imposto_medio_sobre_vendas || 0}
                margemAlvo={config?.margem_desejada_padrao || 30}
                compact
              />
              <PrecosCanaisEditor
                produtoId={produtoId}
                precoBase={0}
                custoInsumos={custoFicha}
                impostoPercentual={config?.imposto_medio_sobre_vendas || 0}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            disabled={step === 1 || createMutation.isPending}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={handleClose}>
                Concluir agora
              </Button>
            )}
            <Button type="button" onClick={goNext} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...
                </>
              ) : step === 3 ? (
                <>
                  Finalizar <Check className="ml-1 h-4 w-4" />
                </>
              ) : (
                <>
                  Próximo <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NovoProdutoWizard;
