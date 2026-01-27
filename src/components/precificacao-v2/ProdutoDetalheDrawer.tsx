import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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
  Store,
  Smartphone,
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

  if (!produto) return null;

  const quadInfo = getQuadranteInfo(produto.quadrante);
  const imposto = (config?.imposto_medio_sobre_vendas || 0) / 100;

  // Calcular margem e lucro para um canal
  const calcularCanal = (taxa: number) => {
    if (produto.preco_venda <= 0) return { margem: 0, lucro: 0 };
    const lucro = produto.preco_venda - produto.custoInsumos - produto.preco_venda * imposto - produto.preco_venda * taxa;
    const margem = (lucro / produto.preco_venda) * 100;
    return { margem, lucro };
  };

  // Balcão (sem taxa)
  const balcao = calcularCanal(0);

  // Todas as plataformas configuradas
  const plataformas = (taxasApps || []).map(app => ({
    id: app.id,
    nome: app.nome_app,
    taxa: app.taxa_percentual,
    ...calcularCanal(app.taxa_percentual / 100)
  }));

  // Calcular preço para margem desejada (no balcão)
  const margem = margemDesejada / 100;
  const divisor = 1 - margem - imposto;
  const precoCalculado = divisor > 0.01 ? produto.custoInsumos / divisor : null;
  
  const mostrarAplicar = precoCalculado && precoCalculado !== produto.preco_venda;

  const getCorMargem = (m: number) => 
    m < 0 ? "text-destructive" : m < 15 ? "text-amber-600" : "text-emerald-600";

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

      {/* Preço Atual */}
      <div className="text-center p-3 rounded-lg border bg-muted/30">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Preço Atual</p>
        <p className="text-2xl font-bold">{formatCurrency(produto.preco_venda)}</p>
      </div>

      {/* Comparativo de Margens - Balcão + Plataformas */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Comparativo por Canal (mesmo preço)</Label>
        <div className="grid grid-cols-2 gap-2">
          {/* Balcão */}
          <div className="p-3 rounded-lg border-2 border-primary/20 bg-primary/5 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Store className="h-4 w-4" />
              <span className="text-xs font-medium">Balcão</span>
            </div>
            <p className={cn("text-lg font-bold", getCorMargem(balcao.margem))}>
              {formatPercent(balcao.margem)}
            </p>
            <p className={cn("text-sm font-semibold", getCorMargem(balcao.lucro))}>
              {formatCurrency(balcao.lucro)}
            </p>
            <p className="text-[10px] text-muted-foreground">lucro/unidade</p>
          </div>

          {/* Plataformas dinâmicas */}
          {plataformas.map(plat => (
            <div key={plat.id} className="p-3 rounded-lg border bg-muted/30 space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Smartphone className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium truncate">{plat.nome}</span>
                <Badge variant="secondary" className="text-[9px] px-1 h-4 ml-auto shrink-0">
                  {plat.taxa}%
                </Badge>
              </div>
              <p className={cn("text-lg font-bold", getCorMargem(plat.margem))}>
                {formatPercent(plat.margem)}
              </p>
              <p className={cn("text-sm font-semibold", getCorMargem(plat.lucro))}>
                {formatCurrency(plat.lucro)}
              </p>
              <p className="text-[10px] text-muted-foreground">lucro/unidade</p>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Simulador de Margem */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Simular margem desejada</Label>
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

      {/* Botão Aplicar - mostra o preço calculado apenas aqui */}
      {mostrarAplicar && (
        <div className="space-y-2 pt-2">
          <div className="text-center text-sm text-muted-foreground">
            Para atingir <span className="font-semibold text-primary">{margemDesejada}% de margem</span> no balcão:
          </div>
          <Button
            size="lg"
            className="w-full gap-2"
            onClick={() => {
              onAplicarPreco(produto.id, precoCalculado!, produto.preco_venda);
              onClose();
            }}
            disabled={isAplicando}
          >
            <Zap className="h-4 w-4" />
            Aplicar {formatCurrency(precoCalculado!)}
          </Button>
        </div>
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
