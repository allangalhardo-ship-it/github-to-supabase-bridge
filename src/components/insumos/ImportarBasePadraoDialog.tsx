import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Download, ChevronRight, ChevronLeft, Package, Check, AlertCircle, Loader2 } from "lucide-react";
import { RAMOS_TEMPLATES, verificarDuplicado, type RamoTemplate, type InsumoTemplate } from "@/lib/insumosTemplates";

interface ImportarBasePadraoDialogProps {
  trigger?: React.ReactNode;
}

type Step = 'selecao-ramo' | 'preview' | 'resultado';

interface InsumoParaImportar extends InsumoTemplate {
  duplicado: boolean;
  selecionado: boolean;
}

export function ImportarBasePadraoDialog({ trigger }: ImportarBasePadraoDialogProps) {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('selecao-ramo');
  const [ramoSelecionado, setRamoSelecionado] = useState<RamoTemplate | null>(null);
  const [insumosParaImportar, setInsumosParaImportar] = useState<InsumoParaImportar[]>([]);
  const [resultado, setResultado] = useState<{ importados: number; pulados: number }>({ importados: 0, pulados: 0 });

  // Buscar insumos existentes para verificar duplicados
  const { data: insumosExistentes } = useQuery({
    queryKey: ['insumos-nomes', usuario?.empresa_id],
    queryFn: async () => {
      if (!usuario?.empresa_id) return [];
      const { data, error } = await supabase
        .from('insumos')
        .select('nome')
        .eq('empresa_id', usuario.empresa_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id && open,
  });

  const importMutation = useMutation({
    mutationFn: async (insumos: InsumoTemplate[]) => {
      if (!usuario?.empresa_id) throw new Error('Empresa não encontrada');
      
      const insumosParaInserir = insumos.map(insumo => ({
        nome: insumo.nome,
        unidade_medida: insumo.unidade_medida,
        custo_unitario: insumo.custo_unitario,
        estoque_minimo: insumo.estoque_minimo,
        estoque_atual: 0,
        empresa_id: usuario.empresa_id,
      }));

      const { error } = await supabase
        .from('insumos')
        .insert(insumosParaInserir);

      if (error) throw error;
      return insumosParaInserir.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['insumos-nomes'] });
      toast({
        title: "Insumos importados!",
        description: `${count} insumo(s) foram adicionados com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao importar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelecionarRamo = (ramo: RamoTemplate) => {
    setRamoSelecionado(ramo);
    
    // Verificar duplicados e preparar lista
    const insumosComStatus = ramo.insumos.map(insumo => ({
      ...insumo,
      duplicado: verificarDuplicado(insumo.nome, insumosExistentes || []),
      selecionado: !verificarDuplicado(insumo.nome, insumosExistentes || []),
    }));
    
    setInsumosParaImportar(insumosComStatus);
    setStep('preview');
  };

  const handleToggleInsumo = (index: number) => {
    setInsumosParaImportar(prev => 
      prev.map((insumo, i) => 
        i === index ? { ...insumo, selecionado: !insumo.selecionado } : insumo
      )
    );
  };

  const handleToggleAll = (selecionado: boolean) => {
    setInsumosParaImportar(prev => 
      prev.map(insumo => ({ ...insumo, selecionado: insumo.duplicado ? false : selecionado }))
    );
  };

  const handleImportar = async () => {
    const insumosASelecionados = insumosParaImportar.filter(i => i.selecionado && !i.duplicado);
    const duplicados = insumosParaImportar.filter(i => i.duplicado).length;
    
    if (insumosASelecionados.length === 0) {
      toast({
        title: "Nenhum insumo selecionado",
        description: "Selecione pelo menos um insumo para importar.",
        variant: "destructive",
      });
      return;
    }

    await importMutation.mutateAsync(insumosASelecionados);
    
    setResultado({
      importados: insumosASelecionados.length,
      pulados: duplicados,
    });
    setStep('resultado');
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep('selecao-ramo');
      setRamoSelecionado(null);
      setInsumosParaImportar([]);
      setResultado({ importados: 0, pulados: 0 });
    }, 200);
  };

  const selecionados = insumosParaImportar.filter(i => i.selecionado && !i.duplicado).length;
  const duplicados = insumosParaImportar.filter(i => i.duplicado).length;
  const disponiveis = insumosParaImportar.filter(i => !i.duplicado).length;

  return (
    <Dialog open={open} onOpenChange={(o) => o ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Base Padrão</span>
            <span className="sm:hidden">Base</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-0 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {step === 'selecao-ramo' && 'Importar Base Padrão de Insumos'}
            {step === 'preview' && `Insumos: ${ramoSelecionado?.nome}`}
            {step === 'resultado' && 'Importação Concluída'}
          </DialogTitle>
          <DialogDescription>
            {step === 'selecao-ramo' && 'Escolha o ramo do seu negócio para importar uma lista de insumos comuns'}
            {step === 'preview' && 'Revise os insumos que serão importados. Duplicados são marcados automaticamente.'}
            {step === 'resultado' && 'Veja o resumo da importação'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4">
          {/* Step 1: Seleção de Ramo */}
          {step === 'selecao-ramo' && (
            <div className="grid gap-3">
              {RAMOS_TEMPLATES.map((ramo) => (
                <Card 
                  key={ramo.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleSelecionarRamo(ramo)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{ramo.icone}</span>
                      <div>
                        <h3 className="font-medium">{ramo.nome}</h3>
                        <p className="text-sm text-muted-foreground">{ramo.descricao}</p>
                        <Badge variant="secondary" className="mt-1">
                          {ramo.insumos.length} insumos
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Step 2: Preview e Seleção */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline" className="gap-1">
                  <Check className="h-3 w-3" />
                  {selecionados} selecionados
                </Badge>
                {duplicados > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {duplicados} já existem
                  </Badge>
                )}
                <Badge variant="outline">
                  {disponiveis} disponíveis
                </Badge>
              </div>

              {/* Ações em lote */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleToggleAll(true)}
                  disabled={selecionados === disponiveis}
                >
                  Selecionar todos
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleToggleAll(false)}
                  disabled={selecionados === 0}
                >
                  Limpar seleção
                </Button>
              </div>

              {/* Lista de insumos */}
              <ScrollArea className="h-[300px] sm:h-[350px] border rounded-md">
                <div className="p-2 space-y-1">
                  {insumosParaImportar.map((insumo, index) => (
                    <div 
                      key={index}
                      className={`flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 ${
                        insumo.duplicado ? 'opacity-50' : ''
                      }`}
                    >
                      <Checkbox
                        checked={insumo.selecionado}
                        onCheckedChange={() => handleToggleInsumo(index)}
                        disabled={insumo.duplicado}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{insumo.nome}</span>
                          {insumo.duplicado && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              Já existe
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {insumo.unidade_medida} • R$ {insumo.custo_unitario.toFixed(2)} • Mín: {insumo.estoque_minimo}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Step 3: Resultado */}
          {step === 'resultado' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Importação realizada!</h3>
                <div className="space-y-1 text-muted-foreground">
                  <p><strong>{resultado.importados}</strong> insumos importados com sucesso</p>
                  {resultado.pulados > 0 && (
                    <p><strong>{resultado.pulados}</strong> já existiam e foram pulados</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 pt-0 border-t mt-auto shrink-0">
          <div className="flex justify-between gap-2">
            {step === 'preview' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep('selecao-ramo')}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  onClick={handleImportar}
                  disabled={selecionados === 0 || importMutation.isPending}
                  className="gap-2"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Importar {selecionados} insumos
                    </>
                  )}
                </Button>
              </>
            )}
            {step === 'resultado' && (
              <Button onClick={handleClose} className="w-full">
                Fechar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
