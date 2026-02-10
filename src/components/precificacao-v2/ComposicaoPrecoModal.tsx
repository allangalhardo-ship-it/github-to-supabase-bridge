import React from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { 
  Store, 
  Smartphone, 
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Receipt,
  Percent,
  Package,
  Banknote
} from 'lucide-react';
import { formatCurrency, formatPercent } from './types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface CanalComposicao {
  id: string;
  nome: string;
  taxa: number;
  isBalcao?: boolean;
  precoCanal?: number; // Preço específico do canal (fallback para preco_venda)
}

interface ComposicaoPrecoModalProps {
  isOpen: boolean;
  onClose: () => void;
  produto: {
    nome: string;
    preco_venda: number;
    custoInsumos: number;
  } | null;
  canais: CanalComposicao[];
  impostoPercentual: number;
}

const ComposicaoPrecoModal: React.FC<ComposicaoPrecoModalProps> = ({
  isOpen,
  onClose,
  produto,
  canais,
  impostoPercentual,
}) => {
  const isMobile = useIsMobile();

  if (!produto) return null;

  const { custoInsumos } = produto;
  const impostoDecimal = impostoPercentual / 100;

  // Calcula composição para cada canal usando preço específico do canal
  const composicoesPorCanal = canais.map(canal => {
    const precoCanal = canal.precoCanal ?? produto.preco_venda;
    const taxaDecimal = canal.taxa / 100;
    
    const valorImposto = precoCanal * impostoDecimal;
    const valorTaxa = precoCanal * taxaDecimal;
    const lucro = precoCanal - custoInsumos - valorImposto - valorTaxa;
    const margem = precoCanal > 0 ? (lucro / precoCanal) * 100 : 0;
    
    // CMV considerando receita líquida (após taxa do canal)
    const receitaLiquida = precoCanal * (1 - taxaDecimal);
    const cmv = receitaLiquida > 0 ? (custoInsumos / receitaLiquida) * 100 : 0;
    
    // Percentuais relativos ao preço de venda (para barra visual)
    const percCusto = precoCanal > 0 ? (custoInsumos / precoCanal) * 100 : 0;
    const percImposto = precoCanal > 0 ? (valorImposto / precoCanal) * 100 : 0;
    const percTaxa = precoCanal > 0 ? (valorTaxa / precoCanal) * 100 : 0;
    const percMargem = precoCanal > 0 ? (lucro / precoCanal) * 100 : 0;
    
    return {
      ...canal,
      precoCanal,
      custoInsumos,
      valorImposto,
      valorTaxa,
      lucro,
      margem,
      cmv,
      percentualCusto: percCusto,
      percentualImposto: percImposto,
      percentualTaxa: percTaxa,
      percentualMargem: percMargem,
    };
  });

  const getCorMargem = (m: number) => 
    m < 0 ? "text-destructive" : m < 15 ? "text-amber-600" : "text-emerald-600";

  const getCorBgMargem = (m: number) => 
    m < 0 ? "bg-destructive/10" : m < 15 ? "bg-amber-500/10" : "bg-emerald-500/10";

  const getIconeMargem = (m: number) => 
    m < 0 ? <TrendingDown className="h-4 w-4" /> : 
    m < 15 ? <Minus className="h-4 w-4" /> : 
    <TrendingUp className="h-4 w-4" />;

  const conteudo = (
    <div className="flex flex-col gap-4 p-4 max-h-[70vh] overflow-y-auto">
      {/* Header do produto */}
      <div className="text-center pb-2">
        <p className="font-semibold text-lg">{produto.nome}</p>
        <p className="text-muted-foreground text-sm">
          Preço base: <span className="font-bold text-foreground">{formatCurrency(produto.preco_venda)}</span>
        </p>
      </div>

      <Separator />

      {/* Composição por canal */}
      <div className="space-y-4">
        {composicoesPorCanal.map((canal, index) => (
          <div key={canal.id} className="space-y-3">
            {index > 0 && <Separator className="my-2" />}
            
            {/* Header do canal */}
            <div className="flex items-center gap-2">
              {canal.isBalcao ? (
                <Store className="h-5 w-5 text-primary" />
              ) : (
                <Smartphone className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="font-semibold">{canal.nome}</span>
              {canal.taxa > 0 && (
                <Badge variant="secondary" className="text-xs">
                  Taxa: {canal.taxa}%
                </Badge>
              )}
            </div>

            {/* Breakdown visual - barras empilhadas */}
            <div className="space-y-1.5">
              {/* Barra visual de composição */}
              <div className="h-3 rounded-full overflow-hidden flex bg-muted">
                <div 
                  className="bg-orange-400 transition-all"
                  style={{ width: `${Math.max(canal.percentualCusto, 0)}%` }}
                  title={`CMV: ${formatPercent(canal.percentualCusto)}`}
                />
                <div 
                  className="bg-blue-400 transition-all"
                  style={{ width: `${Math.max(canal.percentualImposto, 0)}%` }}
                  title={`Impostos: ${formatPercent(canal.percentualImposto)}`}
                />
                {canal.taxa > 0 && (
                  <div 
                    className="bg-purple-400 transition-all"
                    style={{ width: `${Math.max(canal.percentualTaxa, 0)}%` }}
                    title={`Taxa App: ${formatPercent(canal.percentualTaxa)}`}
                  />
                )}
                <div 
                  className={cn(
                    "transition-all",
                    canal.margem >= 0 ? "bg-emerald-400" : "bg-destructive"
                  )}
                  style={{ width: `${Math.max(canal.percentualMargem, 0)}%` }}
                  title={`Margem: ${formatPercent(canal.percentualMargem)}`}
                />
              </div>

              {/* Legenda */}
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-orange-400" />
                  CMV
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  Imposto
                </span>
                {canal.taxa > 0 && (
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    Taxa App
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <div className={cn("w-2 h-2 rounded-full", canal.margem >= 0 ? "bg-emerald-400" : "bg-destructive")} />
                  Margem
                </span>
              </div>
            </div>

            {/* Detalhamento em lista */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
              {/* Preço de Venda */}
              <div className="flex justify-between items-center font-medium border-b pb-2 border-border/50">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-muted-foreground" />
                  <span>Preço de Venda</span>
                </div>
                <span>{formatCurrency(canal.precoCanal)}</span>
              </div>
              
              {/* CMV */}
              <div className="flex justify-between items-center text-orange-600">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span>CMV (Custo dos Insumos)</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">-{formatCurrency(canal.custoInsumos)}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({formatPercent(canal.cmv)})
                  </span>
                </div>
              </div>
              
              {/* Impostos */}
              <div className="flex justify-between items-center text-blue-600">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  <span>Impostos</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">-{formatCurrency(canal.valorImposto)}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({formatPercent(canal.percentualImposto)})
                  </span>
                </div>
              </div>
              
              {/* Taxa do App (se houver) */}
              {canal.taxa > 0 && (
                <div className="flex justify-between items-center text-purple-600">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    <span>Taxa {canal.nome}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">-{formatCurrency(canal.valorTaxa)}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({formatPercent(canal.percentualTaxa)})
                    </span>
                  </div>
                </div>
              )}
              
              {/* Lucro/Margem */}
              <div className={cn(
                "flex justify-between items-center pt-2 border-t border-border/50 font-semibold",
                getCorMargem(canal.margem)
              )}>
                <div className="flex items-center gap-2">
                  {getIconeMargem(canal.margem)}
                  <span>Lucro por Unidade</span>
                </div>
                <div className="text-right">
                  <span className="font-bold">{formatCurrency(canal.lucro)}</span>
                  <span className="text-xs ml-1">
                    ({formatPercent(canal.margem)})
                  </span>
                </div>
              </div>
            </div>

            {/* Resumo do canal */}
            <div className={cn(
              "rounded-lg p-2 text-center",
              getCorBgMargem(canal.margem)
            )}>
              <p className={cn("text-xs", getCorMargem(canal.margem))}>
                {canal.margem < 0 
                  ? `⚠️ Prejuízo de ${formatCurrency(Math.abs(canal.lucro))} por unidade vendida`
                  : canal.margem < 15 
                    ? `⚡ Margem apertada - considere ajustar o preço`
                    : `✓ Margem saudável de ${formatPercent(canal.margem)}`
                }
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="flex items-center justify-between border-b pb-3">
            <DrawerTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Composição do Preço
            </DrawerTitle>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DrawerHeader>
          {conteudo}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Composição do Preço
          </DialogTitle>
        </DialogHeader>
        {conteudo}
      </DialogContent>
    </Dialog>
  );
};

export default ComposicaoPrecoModal;
