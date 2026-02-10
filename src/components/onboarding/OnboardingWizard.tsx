import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sparkles,
  Package,
  ShoppingBasket,
  FileText,
  Rocket,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2
} from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: () => void;
  initialStep?: number;
}

const STEPS = [
  { id: 1, title: 'Boas-vindas', icon: Sparkles, description: 'Vamos configurar seu negócio' },
  { id: 2, title: 'Primeiro Insumo', icon: ShoppingBasket, description: 'Cadastre sua matéria-prima' },
  { id: 3, title: 'Primeiro Produto', icon: Package, description: 'Crie seu produto para venda' },
  { id: 4, title: 'Ficha Técnica', icon: FileText, description: 'Monte o custo do produto' },
  { id: 5, title: 'Pronto!', icon: Rocket, description: 'Comece a lucrar' },
];

const UNIDADES_MEDIDA = [
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'l', label: 'Litro (L)' },
  { value: 'ml', label: 'Mililitro (mL)' },
  { value: 'un', label: 'Unidade (un)' },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, initialStep = 1 }) => {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [isLoading, setIsLoading] = useState(false);

  // Form data
  const [insumoData, setInsumoData] = useState({
    nome: '',
    unidade_medida: 'kg',
    custo_unitario: '',
  });

  const [produtoData, setProdutoData] = useState({
    nome: '',
    preco_venda: '',
    categoria: '',
  });

  const [fichaTecnicaData, setFichaTecnicaData] = useState({
    quantidade: '',
  });

  // IDs criados
  const [createdInsumoId, setCreatedInsumoId] = useState<string | null>(null);
  const [createdProdutoId, setCreatedProdutoId] = useState<string | null>(null);

  const progressValue = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  // Salvar progresso no banco
  const saveProgress = async (step: number, insumoId?: string, produtoId?: string) => {
    if (!usuario?.id || !usuario?.empresa_id) return;

    await supabase
      .from('onboarding_progress')
      .upsert({
        user_id: usuario.id,
        empresa_id: usuario.empresa_id,
        current_step: step,
        first_insumo_id: insumoId || createdInsumoId,
        first_produto_id: produtoId || createdProdutoId,
        completed: step > STEPS.length,
      }, { onConflict: 'user_id' });
  };

  // Criar insumo
  const createInsumo = async () => {
    if (!usuario?.empresa_id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('insumos')
        .insert({
          empresa_id: usuario.empresa_id,
          nome: insumoData.nome,
          unidade_medida: insumoData.unidade_medida,
          custo_unitario: parseFloat(insumoData.custo_unitario.replace(',', '.')),
          estoque_atual: 0,
          estoque_minimo: 0,
        })
        .select()
        .single();

      if (error) throw error;

      setCreatedInsumoId(data.id);
      await saveProgress(3, data.id);
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      
      toast({
        title: 'Insumo criado!',
        description: `${insumoData.nome} foi cadastrado com sucesso.`,
      });

      setCurrentStep(3);
    } catch (error) {
      console.error('Error creating insumo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o insumo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Criar produto
  const createProduto = async () => {
    if (!usuario?.empresa_id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('produtos')
        .insert({
          empresa_id: usuario.empresa_id,
          nome: produtoData.nome,
          preco_venda: parseFloat(produtoData.preco_venda.replace(',', '.')),
          categoria: produtoData.categoria || null,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;

      setCreatedProdutoId(data.id);
      await saveProgress(4, undefined, data.id);
      queryClient.invalidateQueries({ queryKey: ['produtos'] });

      toast({
        title: 'Produto criado!',
        description: `${produtoData.nome} foi cadastrado com sucesso.`,
      });

      setCurrentStep(4);
    } catch (error) {
      console.error('Error creating produto:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o produto.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Criar ficha técnica
  const createFichaTecnica = async () => {
    if (!createdProdutoId || !createdInsumoId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('fichas_tecnicas')
        .insert({
          produto_id: createdProdutoId,
          insumo_id: createdInsumoId,
          quantidade: parseFloat(fichaTecnicaData.quantidade.replace(',', '.')),
        });

      if (error) throw error;

      await saveProgress(5);
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['fichas_tecnicas'] });

      toast({
        title: 'Ficha Técnica criada!',
        description: 'Agora você pode ver o custo e margem do seu produto.',
      });

      setCurrentStep(5);
    } catch (error) {
      console.error('Error creating ficha tecnica:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a ficha técnica.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Finalizar onboarding
  const finishOnboarding = async () => {
    if (!usuario?.id || !usuario?.empresa_id) return;

    setIsLoading(true);
    try {
      await supabase
        .from('onboarding_progress')
        .upsert({
          user_id: usuario.id,
          empresa_id: usuario.empresa_id,
          current_step: 6,
          completed: true,
          first_insumo_id: createdInsumoId,
          first_produto_id: createdProdutoId,
        }, { onConflict: 'user_id' });

      toast({
        title: '🎉 Parabéns!',
        description: 'Seu negócio está configurado. Boas vendas!',
      });

      onComplete();
      navigate('/dashboard');
    } catch (error) {
      console.error('Error finishing onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Pular onboarding
  const skipOnboarding = async () => {
    if (!usuario?.id || !usuario?.empresa_id) return;

    await supabase
      .from('onboarding_progress')
      .upsert({
        user_id: usuario.id,
        empresa_id: usuario.empresa_id,
        current_step: 6,
        completed: true,
      }, { onConflict: 'user_id' });

    onComplete();
    navigate('/dashboard');
  };

  // Carregar dados de exemplo
  const loadDemoData = async () => {
    if (!usuario?.id || !usuario?.empresa_id) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('populate-demo-data', {
        body: { empresa_id: usuario.empresa_id, focus_current_month: true },
      });
      if (error) throw error;
      toast({ title: '🎉 Dados carregados!', description: 'Explore o sistema com dados de exemplo.' });
      queryClient.invalidateQueries();
      await supabase.from('onboarding_progress').upsert({
        user_id: usuario.id,
        empresa_id: usuario.empresa_id,
        current_step: 6,
        completed: true,
      }, { onConflict: 'user_id' });
      onComplete();
      navigate('/dashboard');
    } catch (error) {
      console.error('Error loading demo data:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar os dados.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 2) {
      createInsumo();
    } else if (currentStep === 3) {
      createProduto();
    } else if (currentStep === 4) {
      createFichaTecnica();
    } else if (currentStep === 5) {
      finishOnboarding();
    } else {
      setCurrentStep(prev => prev + 1);
      saveProgress(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        return insumoData.nome && insumoData.custo_unitario;
      case 3:
        return produtoData.nome && produtoData.preco_venda;
      case 4:
        return fichaTecnicaData.quantidade;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <div>
            <h2 className="text-2xl font-bold text-foreground">
              Bem-vindo ao Gastro Gestor! 🎉
            </h2>
            <p className="text-muted-foreground mt-2">
                Vamos configurar seu negócio em apenas <strong>3 passos simples</strong>.
                Em menos de 2 minutos você estará pronto para controlar seus lucros!
              </p>
            </div>
            <div className="grid gap-3 text-left max-w-sm mx-auto">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <ShoppingBasket className="w-5 h-5 text-primary" />
                <span className="text-sm">Cadastrar um insumo (matéria-prima)</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Package className="w-5 h-5 text-primary" />
                <span className="text-sm">Criar um produto para venda</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-sm">Montar a ficha técnica (custo)</span>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <ShoppingBasket className="w-8 h-8 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Cadastre seu primeiro insumo
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Insumo é tudo que você usa para fazer seu produto (ingredientes, embalagens, etc)
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="insumo-nome">Nome do insumo *</Label>
                <Input
                  id="insumo-nome"
                  placeholder="Ex: Chocolate em pó, Embalagem 500ml, Leite..."
                  value={insumoData.nome}
                  onChange={(e) => setInsumoData(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="insumo-unidade">Unidade de medida</Label>
                  <Select
                    value={insumoData.unidade_medida}
                    onValueChange={(value) => setInsumoData(prev => ({ ...prev, unidade_medida: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES_MEDIDA.map(u => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="insumo-custo">Custo por {insumoData.unidade_medida} *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                    <Input
                      id="insumo-custo"
                      placeholder="0,00"
                      className="pl-10"
                      value={insumoData.custo_unitario}
                      onChange={(e) => setInsumoData(prev => ({ ...prev, custo_unitario: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Cadastre seu primeiro produto
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Produto é o que você vende para seus clientes
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="produto-nome">Nome do produto *</Label>
                <Input
                  id="produto-nome"
                  placeholder="Ex: Açaí 500ml, Bolo no pote, Hambúrguer..."
                  value={produtoData.nome}
                  onChange={(e) => setProdutoData(prev => ({ ...prev, nome: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="produto-preco">Preço de venda *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                    <Input
                      id="produto-preco"
                      placeholder="0,00"
                      className="pl-10"
                      value={produtoData.preco_venda}
                      onChange={(e) => setProdutoData(prev => ({ ...prev, preco_venda: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="produto-categoria">Categoria (opcional)</Label>
                  <Input
                    id="produto-categoria"
                    placeholder="Ex: Sobremesas, Bebidas..."
                    value={produtoData.categoria}
                    onChange={(e) => setProdutoData(prev => ({ ...prev, categoria: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        const custoInsumo = parseFloat(insumoData.custo_unitario.replace(',', '.')) || 0;
        const qtdFicha = parseFloat(fichaTecnicaData.quantidade.replace(',', '.')) || 0;
        const custoTotal = custoInsumo * qtdFicha;
        const precoVenda = parseFloat(produtoData.preco_venda.replace(',', '.')) || 0;
        const lucro = precoVenda - custoTotal;
        const margem = precoVenda > 0 ? (lucro / precoVenda) * 100 : 0;

        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Monte a Ficha Técnica
              </h2>
              <p className="text-muted-foreground text-sm mt-1">
                Quanto de <strong>{insumoData.nome || 'insumo'}</strong> você usa para fazer 1 <strong>{produtoData.nome || 'produto'}</strong>?
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Insumo:</span>
                  <span className="font-medium">{insumoData.nome}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo unitário:</span>
                  <span className="font-medium">R$ {insumoData.custo_unitario || '0,00'}/{insumoData.unidade_medida}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ficha-quantidade">
                  Quantidade usada ({insumoData.unidade_medida}) *
                </Label>
                <Input
                  id="ficha-quantidade"
                  placeholder={`Ex: 0,5 ${insumoData.unidade_medida}`}
                  value={fichaTecnicaData.quantidade}
                  onChange={(e) => setFichaTecnicaData(prev => ({ ...prev, quantidade: e.target.value }))}
                />
              </div>

              {qtdFicha > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2"
                >
                  <div className="flex justify-between text-sm">
                    <span>Custo do insumo:</span>
                    <span className="font-medium">R$ {custoTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Preço de venda:</span>
                    <span className="font-medium">R$ {precoVenda.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-medium">Lucro estimado:</span>
                    <span className={`font-bold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      R$ {lucro.toFixed(2)} ({margem.toFixed(0)}%)
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="mx-auto w-24 h-24 rounded-full bg-green-100 flex items-center justify-center"
            >
              <Rocket className="w-12 h-12 text-green-600" />
            </motion.div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Tudo pronto! 🚀
              </h2>
              <p className="text-muted-foreground mt-2">
                Seu primeiro produto está configurado. Agora você pode:
              </p>
            </div>
            <div className="grid gap-3 text-left max-w-sm mx-auto">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm">Ver suas margens no Dashboard</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm">Registrar vendas e calcular lucros</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <Check className="w-5 h-5 text-green-600" />
                <span className="text-sm">Adicionar mais produtos e insumos</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Passo {currentStep} de {STEPS.length}</span>
              <span>{Math.round(progressValue)}% completo</span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>

          {/* Step indicators */}
          <div className="flex justify-between">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center gap-1 ${
                    isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground/40'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : isCompleted
                        ? 'bg-green-100 text-green-600'
                        : 'bg-muted'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="text-[10px] hidden sm:block">{step.title}</span>
                </div>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8 gap-4">
            {currentStep > 1 && currentStep < 5 ? (
              <Button variant="outline" onClick={handleBack} disabled={isLoading}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            ) : currentStep === 1 ? (
              <Button variant="ghost" onClick={skipOnboarding} className="text-muted-foreground">
                Pular configuração
              </Button>
            ) : (
              <div />
            )}

            <Button
              onClick={handleNext}
              disabled={!canProceed() || isLoading}
              className="w-full sm:w-auto sm:min-w-[120px]"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : currentStep === 5 ? (
                <>
                  Ir para Dashboard
                  <Rocket className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  Continuar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingWizard;
