import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Store, Smartphone, Save, Calculator, Info } from 'lucide-react';
import { usePrecosCanais } from '@/hooks/usePrecosCanais';
import { cn } from '@/lib/utils';

interface PrecosCanaisEditorProps {
  produtoId: string;
  precoBase: number;
  custoInsumos: number;
  impostoPercentual?: number;
  onSave?: () => void;
}

const PrecosCanaisEditor: React.FC<PrecosCanaisEditorProps> = ({
  produtoId,
  precoBase,
  custoInsumos,
  impostoPercentual = 0,
  onSave,
}) => {
  const { 
    canaisConfigurados, 
    precosMap, 
    isLoadingPrecos, 
    upsertMultiplosPrecos,
    isSaving 
  } = usePrecosCanais(produtoId);
  
  const [precos, setPrecos] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Inicializar preços quando carregar
  useEffect(() => {
    if (canaisConfigurados && !isLoadingPrecos) {
      const novosPrecos: Record<string, string> = {};
      canaisConfigurados.forEach(canal => {
        const precoExistente = precosMap[canal.id];
        if (precoExistente !== undefined) {
          novosPrecos[canal.id] = precoExistente.toString();
        } else if (canal.isBalcao) {
          novosPrecos[canal.id] = precoBase.toString();
        } else {
          novosPrecos[canal.id] = '';
        }
      });
      setPrecos(novosPrecos);
      setHasChanges(false);
    }
  }, [canaisConfigurados, precosMap, precoBase, isLoadingPrecos]);
  const handlePrecoChange = (canalId: string, valor: string) => {
    setPrecos(prev => ({ ...prev, [canalId]: valor }));
    setHasChanges(true);
  };

  // Calcular margem para um preço e taxa
  const calcularMargem = (preco: number, taxa: number) => {
    if (preco <= 0) return 0;
    const imposto = preco * (impostoPercentual / 100);
    const taxaCanal = preco * (taxa / 100);
    const lucro = preco - custoInsumos - imposto - taxaCanal;
    return (lucro / preco) * 100;
  };

  const getCorMargem = (margem: number) => {
    if (margem < 0) return 'text-destructive';
    if (margem < 15) return 'text-amber-600';
    return 'text-emerald-600';
  };

  const handleSalvar = () => {
    const precosParaSalvar = Object.entries(precos)
      .filter(([_, valor]) => valor && parseFloat(valor) > 0)
      .map(([canal, valor]) => ({
        produtoId,
        canal,
        preco: parseFloat(valor),
      }));

    upsertMultiplosPrecos(precosParaSalvar, {
      onSuccess: () => {
        setHasChanges(false);
        onSave?.();
      },
    });
  };

  // Preencher preços sugeridos baseado no CMV alvo
  const preencherSugeridos = (cmvAlvo: number = 35) => {
    const novosPrecos: Record<string, string> = {};
    canaisConfigurados?.forEach(canal => {
      const taxa = canal.taxa / 100;
      const cmv = cmvAlvo / 100;
      const fatorReceita = 1 - taxa;
      if (fatorReceita > 0 && cmv > 0) {
        const precoSugerido = custoInsumos / (cmv * fatorReceita);
        novosPrecos[canal.id] = precoSugerido.toFixed(2);
      }
    });
    setPrecos(novosPrecos);
    setHasChanges(true);
  };

  if (isLoadingPrecos) {
    return <Skeleton className="h-48" />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" />
            Preços por Canal
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => preencherSugeridos(35)}
            className="text-xs gap-1"
          >
            <Calculator className="h-3 w-3" />
            CMV 35%
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Defina preços diferentes para cada canal de venda
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <TooltipProvider>
          {canaisConfigurados?.map(canal => {
            const precoAtual = parseFloat(precos[canal.id] || '0');
            const margem = calcularMargem(precoAtual, canal.taxa);

            return (
              <div 
                key={canal.id} 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  canal.isBalcao ? "border-primary/30 bg-primary/5" : "bg-muted/30"
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {canal.isBalcao ? (
                    <Store className="h-4 w-4 shrink-0" />
                  ) : (
                    <Smartphone className="h-4 w-4 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{canal.nome}</p>
                    {canal.taxa > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-[10px] px-1 h-4 cursor-help">
                            Taxa: {canal.taxa.toFixed(1)}%
                            <Info className="h-2.5 w-2.5 ml-0.5" />
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[200px]">
                          <p className="text-xs">Taxa total (soma de todas as taxas configuradas para este canal)</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={precos[canal.id] || ''}
                      onChange={(e) => handlePrecoChange(canal.id, e.target.value)}
                      className="pl-8 h-9 text-sm"
                      placeholder="0,00"
                    />
                  </div>
                  
                  {precoAtual > 0 && (
                    <div className="w-16 text-right">
                      <p className={cn("text-sm font-bold", getCorMargem(margem))}>
                        {margem.toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">margem</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </TooltipProvider>
        {hasChanges && (
          <Button 
            onClick={handleSalvar} 
            className="w-full gap-2"
            disabled={isSaving}
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Salvando...' : 'Salvar Preços'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default PrecosCanaisEditor;
