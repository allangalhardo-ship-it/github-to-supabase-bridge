import React, { useState, useMemo } from 'react';
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
  Store,
  Smartphone,
  Zap,
  Calculator,
  Receipt,
  Percent
} from 'lucide-react';
import { ProdutoAnalise, TaxaApp, ConfiguracoesPrecificacao, formatCurrency, formatPercent, getQuadranteInfo } from './types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import ComposicaoPrecoModal from './ComposicaoPrecoModal';

interface ProdutoDetalheDrawerProps {
  produto: ProdutoAnalise | null;
  isOpen: boolean;
  onClose: () => void;
  onAplicarPreco: (produtoId: string, novoPreco: number, precoAnterior: number) => void;
  onAplicarPrecoCanal?: (produtoId: string, canal: string, novoPreco: number, precoAnterior: number) => void;
  config: ConfiguracoesPrecificacao | undefined;
  taxasApps: TaxaApp[] | undefined;
  isAplicando?: boolean;
}

interface CanalInfo {
  id: string;
  nome: string;
  taxa: number;
  icone: React.ReactNode;
  destaque?: boolean;
}

const ProdutoDetalheDrawer: React.FC<ProdutoDetalheDrawerProps> = ({
  produto,
  isOpen,
  onClose,
  onAplicarPreco,
  onAplicarPrecoCanal,
  config,
  taxasApps,
  isAplicando,
}) => {
  const isMobile = useIsMobile();
  const [cmvDesejado, setCmvDesejado] = useState(config?.cmv_alvo || 35);
  const [canalParaAplicar, setCanalParaAplicar] = useState<string | null>(null);
  // Preços editáveis por canal (inicializa com valores calculados)
  const [precosEditaveis, setPrecosEditaveis] = useState<Record<string, string>>({});
  const [showComposicao, setShowComposicao] = useState(false);

  // Montar lista de canais: Balcão + plataformas (antes do early return!)
  const canais: CanalInfo[] = useMemo(() => {
    const lista: CanalInfo[] = [
      { id: 'balcao', nome: 'Balcão', taxa: 0, icone: <Store className="h-4 w-4" />, destaque: true }
    ];
    (taxasApps || []).forEach(app => {
      lista.push({
        id: app.id,
        nome: app.nome_app,
        taxa: app.taxa_percentual,
        icone: <Smartphone className="h-4 w-4" />
      });
    });
    return lista;
  }, [taxasApps]);

  if (!produto) return null;

  const quadInfo = getQuadranteInfo(produto.quadrante);
  const imposto = (config?.imposto_medio_sobre_vendas || 0) / 100;

  // Obter preço de um canal específico (usa preço customizado se existir)
  const getPrecoCanal = (canalId: string): number => {
    if (produto.precosCanais && produto.precosCanais[canalId] !== undefined) {
      return produto.precosCanais[canalId];
    }
    return produto.preco_venda;
  };

  // Calcular margem e lucro dado um preço e taxa
  const calcularResultado = (preco: number, taxa: number) => {
    if (preco <= 0) return { margem: 0, lucro: 0 };
    const lucro = preco - produto.custoInsumos - preco * imposto - preco * (taxa / 100);
    const margem = (lucro / preco) * 100;
    return { margem, lucro };
  };

  // Calcular preço necessário para atingir CMV em um canal
  const calcularPrecoParaCMV = (cmvAlvo: number, taxaCanal: number) => {
    if (cmvAlvo <= 0 || cmvAlvo >= 100) return null;
    const cmv = cmvAlvo / 100;
    const taxa = taxaCanal / 100;
    const fatorReceita = 1 - taxa;
    if (fatorReceita <= 0) return null;
    return produto.custoInsumos / (cmv * fatorReceita);
  };

  // Resultados atuais por canal (usa preço específico de cada canal)
  const resultadosAtuais = canais.map(canal => {
    const precoCanal = getPrecoCanal(canal.id);
    return {
      ...canal,
      preco: precoCanal,
      ...calcularResultado(precoCanal, canal.taxa)
    };
  });

  // Resultados da simulação por CMV - preço diferente por canal!
  const resultadosSimulacaoCMV = canais.map(canal => {
    const precoCalculado = calcularPrecoParaCMV(cmvDesejado, canal.taxa);
    // Usar preço editável se existir, senão usar calculado
    const precoEditavel = precosEditaveis[canal.id];
    const precoFinal = precoEditavel ? parseFloat(precoEditavel.replace(',', '.')) || 0 : precoCalculado;
    const resultado = precoFinal > 0 ? calcularResultado(precoFinal, canal.taxa) : { margem: 0, lucro: 0 };
    return {
      ...canal,
      precoCalculado,
      precoFinal,
      ...resultado
    };
  });

  // Atualizar preços editáveis quando CMV muda
  const atualizarPrecosParaCMV = () => {
    const novosPrecos: Record<string, string> = {};
    canais.forEach(canal => {
      const preco = calcularPrecoParaCMV(cmvDesejado, canal.taxa);
      if (preco) {
        novosPrecos[canal.id] = preco.toFixed(2).replace('.', ',');
      }
    });
    setPrecosEditaveis(novosPrecos);
  };

  const getCorMargem = (m: number) => 
    m < 0 ? "text-destructive" : m < 15 ? "text-amber-600" : "text-emerald-600";

  const getCorBgMargem = (m: number) => 
    m < 0 ? "bg-destructive/10 border-destructive/30" : 
    m < 15 ? "bg-amber-500/10 border-amber-500/30" : 
    "bg-emerald-500/10 border-emerald-500/30";

  const handleAplicar = (preco: number, canal?: string) => {
    if (canal && onAplicarPrecoCanal) {
      onAplicarPrecoCanal(produto.id, canal, preco, produto.preco_venda);
    } else {
      onAplicarPreco(produto.id, preco, produto.preco_venda);
    }
    onClose();
  };

  const conteudoDrawer = (
    <div className="flex flex-col gap-4 p-4">
      {/* Header Produto */}
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center overflow-hidden shrink-0 border">
          {produto.imagem_url ? (
            <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl">{quadInfo.icone}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn(quadInfo.bgCor, quadInfo.cor, "text-xs")}>
              {quadInfo.label}
            </Badge>
          </div>
          <p className="font-semibold mt-1 truncate text-sm">{produto.nome}</p>
          <p className="text-xs text-muted-foreground">
            Custo: {formatCurrency(produto.custoInsumos)} • Preço atual: {formatCurrency(produto.preco_venda)}
          </p>
        </div>
      </div>

      {/* Situação Atual - Grid com preços por canal */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Situação Atual
          </Label>
          <button
            onClick={() => setShowComposicao(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Receipt className="h-3 w-3" />
            Ver composição
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {resultadosAtuais.map(canal => (
            <div 
              key={canal.id} 
              className={cn(
                "p-2.5 rounded-lg border",
                canal.destaque ? "border-primary/30 bg-primary/5" : "bg-muted/30"
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {canal.icone}
                <span className="text-xs font-medium truncate">{canal.nome}</span>
                {canal.taxa > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1 h-4 ml-auto">
                    {canal.taxa}%
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-base font-bold", getCorMargem(canal.margem))}>
                  {formatPercent(canal.margem)}
                </span>
                <span className={cn("text-xs", getCorMargem(canal.lucro))}>
                  {formatCurrency(canal.lucro)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Preço: {formatCurrency(canal.preco)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Simulador por CMV - sem tabs, direto */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Simulador de Preço por CMV</Label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">CMV desejado</Label>
            <div className="flex items-center gap-1 bg-amber-500/10 rounded-md px-2 py-1">
              <span className="font-bold text-amber-600">{cmvDesejado.toFixed(0)}%</span>
            </div>
          </div>
          <Slider
            value={[cmvDesejado]}
            onValueChange={([value]) => {
              setCmvDesejado(value);
              setCanalParaAplicar(null);
              // Atualizar preços editáveis quando muda CMV
              const novosPrecos: Record<string, string> = {};
              canais.forEach(canal => {
                const preco = calcularPrecoParaCMV(value, canal.taxa);
                if (preco) {
                  novosPrecos[canal.id] = preco.toFixed(2).replace('.', ',');
                }
              });
              setPrecosEditaveis(novosPrecos);
            }}
            min={10}
            max={70}
            step={1}
            className="py-2"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>10%</span>
            <span>Alvo: {config?.cmv_alvo || 35}%</span>
            <span>70%</span>
          </div>
        </div>

        {/* Preços por canal - editáveis */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Preço por canal (edite para arredondar)
          </Label>
          <div className="space-y-2">
            {resultadosSimulacaoCMV.map(canal => (
              <div 
                key={canal.id}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  canalParaAplicar === canal.id 
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                    : canal.destaque 
                      ? "border-primary/20" 
                      : "border-muted"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {canal.icone}
                    <span className="text-sm font-medium truncate">{canal.nome}</span>
                    {canal.taxa > 0 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 h-4 shrink-0">
                        -{canal.taxa}%
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                        R$
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={precosEditaveis[canal.id] || (canal.precoCalculado?.toFixed(2).replace('.', ',') || '')}
                        onChange={(e) => {
                          setPrecosEditaveis(prev => ({
                            ...prev,
                            [canal.id]: e.target.value
                          }));
                        }}
                        onFocus={() => setCanalParaAplicar(canal.id)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        className="pl-7 text-sm font-semibold h-9 text-right"
                      />
                    </div>
                    <div className={cn(
                      "text-right min-w-[60px]",
                      getCorMargem(canal.margem)
                    )}>
                      <p className="text-sm font-bold">{formatPercent(canal.margem)}</p>
                      <p className="text-[10px]">{formatCurrency(canal.lucro)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Botão aplicar */}
        {canalParaAplicar && (
          <Button
            size="lg"
            className="w-full gap-2"
            onClick={() => {
              const canal = resultadosSimulacaoCMV.find(c => c.id === canalParaAplicar);
              if (canal?.precoFinal > 0) handleAplicar(canal.precoFinal, canal.id);
            }}
            disabled={isAplicando}
          >
            <Zap className="h-4 w-4" />
            Aplicar {formatCurrency(resultadosSimulacaoCMV.find(c => c.id === canalParaAplicar)?.precoFinal || 0)} em {resultadosSimulacaoCMV.find(c => c.id === canalParaAplicar)?.nome}
          </Button>
        )}
      </div>

      {/* Métricas do produto - mais compacto */}
      <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t">
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
      {/* Modal de Composição do Preço */}
      <ComposicaoPrecoModal
        isOpen={showComposicao}
        onClose={() => setShowComposicao(false)}
        produto={produto ? {
          nome: produto.nome,
          preco_venda: produto.preco_venda,
          custoInsumos: produto.custoInsumos
        } : null}
        canais={canais.map(c => ({
          id: c.id,
          nome: c.nome,
          taxa: c.taxa,
          isBalcao: c.destaque
        }))}
        impostoPercentual={config?.imposto_medio_sobre_vendas || 0}
      />
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
            {conteudoDrawer}
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
        {conteudoDrawer}
      </DialogContent>
    </Dialog>
  );
};

export default ProdutoDetalheDrawer;