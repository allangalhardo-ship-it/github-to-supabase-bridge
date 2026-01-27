import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  X,
  ImageIcon,
  Store,
  Smartphone,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Zap,
  Calculator
} from 'lucide-react';
import { ProdutoAnalise, TaxaApp, ConfiguracoesPrecificacao, formatCurrency, formatPercent, getQuadranteInfo } from './types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ProdutoDetalheDrawerProps {
  produto: ProdutoAnalise | null;
  isOpen: boolean;
  onClose: () => void;
  onAplicarPreco: (produtoId: string, novoPreco: number, precoAnterior: number) => void;
  config: ConfiguracoesPrecificacao | undefined;
  taxasApps: TaxaApp[] | undefined;
  isAplicando?: boolean;
}

const ProdutoDetalheDrawer: React.FC<ProdutoDetalheDrawerProps> = ({
  produto,
  isOpen,
  onClose,
  onAplicarPreco,
  config,
  taxasApps,
  isAplicando,
}) => {
  const isMobile = useIsMobile();
  const [margemDesejada, setMargemDesejada] = useState(config?.margem_desejada_padrao || 30);
  const [canalSelecionado, setCanalSelecionado] = useState<string>('balcao');

  if (!produto) return null;

  const quadInfo = getQuadranteInfo(produto.quadrante);

  // Calcular preço para margem desejada
  const taxaCanal = canalSelecionado === 'balcao' 
    ? 0 
    : (taxasApps?.find(a => a.id === canalSelecionado)?.taxa_percentual || 0);
  
  const imposto = (config?.imposto_medio_sobre_vendas || 0) / 100;
  const margem = margemDesejada / 100;
  const taxa = taxaCanal / 100;
  const divisor = 1 - margem - imposto - taxa;
  const precoCalculado = divisor > 0.01 ? produto.custoInsumos / divisor : null;
  
  const diferencaPreco = precoCalculado ? precoCalculado - produto.preco_venda : 0;
  
  // Margem atual no canal selecionado
  const margemAtualCanal = produto.preco_venda > 0
    ? ((produto.preco_venda - produto.custoInsumos - produto.preco_venda * imposto - produto.preco_venda * taxa) / produto.preco_venda) * 100
    : 0;

  const ConteudoDrawer = () => (
    <div className="flex flex-col gap-4 p-4">
      {/* Header Produto */}
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="w-14 h-14 rounded-lg bg-background flex items-center justify-center overflow-hidden shrink-0 border">
          {produto.imagem_url ? (
            <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">{quadInfo.icone}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn(quadInfo.bgCor, quadInfo.cor, "text-xs")}>
              {quadInfo.label}
            </Badge>
          </div>
          <p className="font-semibold mt-1 truncate">{produto.nome}</p>
          <p className="text-xs text-muted-foreground">
            Custo: {formatCurrency(produto.custoInsumos)}
          </p>
        </div>
      </div>

      {/* Comparação Atual vs Calculado */}
      <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-stretch">
        <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Atual</p>
          <p className="text-xl font-bold">{formatCurrency(produto.preco_venda)}</p>
          <p className={cn(
            "text-sm font-medium",
            margemAtualCanal < 0 ? "text-destructive" :
            margemAtualCanal < 15 ? "text-amber-600" : "text-emerald-600"
          )}>
            {formatPercent(margemAtualCanal)} margem
          </p>
        </div>

        <div className="flex items-center justify-center">
          <div className={cn(
            "p-1.5 rounded-full",
            diferencaPreco >= 0 ? "bg-emerald-500/10" : "bg-amber-500/10"
          )}>
            <ArrowRight className={cn(
              "h-4 w-4",
              diferencaPreco >= 0 ? "text-emerald-600" : "text-amber-600"
            )} />
          </div>
        </div>

        <div className={cn(
          "p-3 rounded-lg border-2 space-y-1",
          precoCalculado ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"
        )}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Calculado</p>
          {precoCalculado ? (
            <>
              <p className="text-xl font-bold text-primary">{formatCurrency(precoCalculado)}</p>
              <p className="text-sm font-medium text-primary">{formatPercent(margemDesejada)} margem</p>
            </>
          ) : (
            <p className="text-sm text-destructive font-medium">Inviável</p>
          )}
        </div>
      </div>

      {/* Diferença */}
      {precoCalculado && diferencaPreco !== 0 && (
        <div className="flex items-center justify-center gap-2 py-2 rounded-lg bg-muted/30 text-sm">
          {diferencaPreco > 0 ? (
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-amber-600" />
          )}
          <span className={diferencaPreco > 0 ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
            {diferencaPreco > 0 ? '+' : ''}{formatCurrency(diferencaPreco)} por unidade
          </span>
        </div>
      )}

      <Separator />

      {/* Seletor de Canal */}
      <div className="space-y-2">
        <Label className="text-sm">Canal de venda</Label>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Button
            size="sm"
            variant={canalSelecionado === 'balcao' ? 'default' : 'outline'}
            onClick={() => setCanalSelecionado('balcao')}
            className="h-9 px-3 gap-1.5 shrink-0"
          >
            <Store className="h-3.5 w-3.5" />
            Balcão
          </Button>
          {taxasApps?.map(app => (
            <Button
              key={app.id}
              size="sm"
              variant={canalSelecionado === app.id ? 'default' : 'outline'}
              onClick={() => setCanalSelecionado(app.id)}
              className="h-9 px-3 gap-1.5 shrink-0"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="truncate max-w-[60px]">{app.nome_app}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 h-4">
                {app.taxa_percentual}%
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Slider de Margem */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Margem desejada</Label>
          <div className="flex items-center gap-1 bg-primary/10 rounded-md px-2 py-1">
            <span className="font-bold text-primary">{margemDesejada.toFixed(0)}%</span>
          </div>
        </div>
        <Slider
          value={[margemDesejada]}
          onValueChange={([value]) => setMargemDesejada(value)}
          min={5}
          max={60}
          step={1}
          className="py-2"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>5%</span>
          <span>Alvo: {config?.margem_desejada_padrao || 30}%</span>
          <span>60%</span>
        </div>
      </div>

      {/* Métricas do produto */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-muted/30">
          <p className="text-[10px] text-muted-foreground uppercase">CMV</p>
          <p className={cn(
            "text-sm font-bold",
            produto.cmv > (config?.cmv_alvo || 35) + 10 ? "text-destructive" :
            produto.cmv > (config?.cmv_alvo || 35) ? "text-amber-600" : "text-emerald-600"
          )}>
            {formatPercent(produto.cmv)}
          </p>
        </div>
        <div className="p-2 rounded-lg bg-muted/30">
          <p className="text-[10px] text-muted-foreground uppercase">Vendas 30d</p>
          <p className="text-sm font-bold">{produto.quantidadeVendida}</p>
        </div>
        <div className="p-2 rounded-lg bg-muted/30">
          <p className="text-[10px] text-muted-foreground uppercase">Receita 30d</p>
          <p className="text-sm font-bold">{formatCurrency(produto.receitaTotal)}</p>
        </div>
      </div>

      {/* Botão Aplicar */}
      {precoCalculado && precoCalculado !== produto.preco_venda && (
        <Button
          size="lg"
          className="w-full gap-2"
          onClick={() => {
            onAplicarPreco(produto.id, precoCalculado, produto.preco_venda);
            onClose();
          }}
          disabled={isAplicando}
        >
          <Zap className="h-4 w-4" />
          Aplicar {formatCurrency(precoCalculado)}
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="flex items-center justify-between border-b pb-3">
            <DrawerTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Simulador de Preço
            </DrawerTitle>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DrawerHeader>
          <div className="overflow-y-auto">
            <ConteudoDrawer />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simulador de Preço
          </DialogTitle>
        </DialogHeader>
        <ConteudoDrawer />
      </DialogContent>
    </Dialog>
  );
};

export default ProdutoDetalheDrawer;
