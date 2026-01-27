import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Target,
  DollarSign,
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
  config,
  taxasApps,
  isAplicando,
}) => {
  const isMobile = useIsMobile();
  const [margemDesejada, setMargemDesejada] = useState(config?.margem_desejada_padrao || 30);
  const [cmvDesejado, setCmvDesejado] = useState(config?.cmv_alvo || 35);
  const [precoSimulado, setPrecoSimulado] = useState('');
  const [canalParaAplicar, setCanalParaAplicar] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('margem');
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

  // Calcular margem e lucro dado um preço e taxa
  const calcularResultado = (preco: number, taxa: number) => {
    if (preco <= 0) return { margem: 0, lucro: 0 };
    const lucro = preco - produto.custoInsumos - preco * imposto - preco * (taxa / 100);
    const margem = (lucro / preco) * 100;
    return { margem, lucro };
  };

  // Calcular preço necessário para atingir margem em um canal
  const calcularPrecoParaMargem = (margemAlvo: number, taxa: number) => {
    const m = margemAlvo / 100;
    const t = taxa / 100;
    const divisor = 1 - m - imposto - t;
    if (divisor <= 0.01) return null;
    return produto.custoInsumos / divisor;
  };

  // Calcular preço necessário para atingir CMV em um canal
  // CMV = custoInsumos / preco => preco = custoInsumos / CMV
  const calcularPrecoParaCMV = (cmvAlvo: number) => {
    if (cmvAlvo <= 0 || cmvAlvo >= 100) return null;
    return produto.custoInsumos / (cmvAlvo / 100);
  };

  // Resultados atuais (preço atual)
  const resultadosAtuais = canais.map(canal => ({
    ...canal,
    ...calcularResultado(produto.preco_venda, canal.taxa)
  }));

  // Resultados da simulação por margem
  const resultadosSimulacaoMargem = canais.map(canal => {
    const precoIdeal = calcularPrecoParaMargem(margemDesejada, canal.taxa);
    return {
      ...canal,
      precoIdeal,
      margem: margemDesejada,
      lucro: precoIdeal ? calcularResultado(precoIdeal, canal.taxa).lucro : 0
    };
  });

  // Resultados da simulação por CMV
  const precoParaCMV = calcularPrecoParaCMV(cmvDesejado);
  const resultadosSimulacaoCMV = canais.map(canal => {
    const resultado = precoParaCMV ? calcularResultado(precoParaCMV, canal.taxa) : { margem: 0, lucro: 0 };
    return {
      ...canal,
      precoIdeal: precoParaCMV,
      ...resultado
    };
  });

  // Resultados da simulação por preço
  const precoNumerico = parseFloat(precoSimulado.replace(',', '.')) || 0;
  const resultadosSimulacaoPreco = canais.map(canal => ({
    ...canal,
    ...calcularResultado(precoNumerico, canal.taxa)
  }));

  const getCorMargem = (m: number) => 
    m < 0 ? "text-destructive" : m < 15 ? "text-amber-600" : "text-emerald-600";

  const getCorBgMargem = (m: number) => 
    m < 0 ? "bg-destructive/10 border-destructive/30" : 
    m < 15 ? "bg-amber-500/10 border-amber-500/30" : 
    "bg-emerald-500/10 border-emerald-500/30";

  const handleAplicar = (preco: number) => {
    onAplicarPreco(produto.id, preco, produto.preco_venda);
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

      {/* Situação Atual - Grid compacto */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Situação Atual (preço {formatCurrency(produto.preco_venda)})
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
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Simulador com Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="margem" className="text-xs gap-1">
            <Target className="h-3 w-3" />
            Margem
          </TabsTrigger>
          <TabsTrigger value="cmv" className="text-xs gap-1">
            <Percent className="h-3 w-3" />
            CMV
          </TabsTrigger>
          <TabsTrigger value="preco" className="text-xs gap-1">
            <DollarSign className="h-3 w-3" />
            Preço
          </TabsTrigger>
        </TabsList>

        {/* Tab: Simular por Margem */}
        <TabsContent value="margem" className="space-y-4 mt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Margem desejada</Label>
              <div className="flex items-center gap-1 bg-primary/10 rounded-md px-2 py-1">
                <span className="font-bold text-primary">{margemDesejada.toFixed(0)}%</span>
              </div>
            </div>
            <Slider
              value={[margemDesejada]}
              onValueChange={([value]) => {
                setMargemDesejada(value);
                setCanalParaAplicar(null);
              }}
              min={5}
              max={90}
              step={1}
              className="py-2"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>5%</span>
              <span>Alvo: {config?.margem_desejada_padrao || 30}%</span>
              <span>90%</span>
            </div>
          </div>

          {/* Preços ideais por canal */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Preço necessário para {margemDesejada}% de margem
            </Label>
            <div className="space-y-2">
              {resultadosSimulacaoMargem.map(canal => (
                <div 
                  key={canal.id}
                  className={cn(
                    "p-3 rounded-lg border transition-all cursor-pointer",
                    canalParaAplicar === canal.id 
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                      : canal.destaque 
                        ? "border-primary/20 hover:border-primary/40" 
                        : "hover:border-muted-foreground/30"
                  )}
                  onClick={() => canal.precoIdeal && setCanalParaAplicar(canal.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {canal.icone}
                      <span className="text-sm font-medium">{canal.nome}</span>
                      {canal.taxa > 0 && (
                        <Badge variant="outline" className="text-[9px] px-1.5 h-4">
                          -{canal.taxa}%
                        </Badge>
                      )}
                    </div>
                    {canal.precoIdeal ? (
                      <div className="text-right">
                        <p className="text-base font-bold text-primary">
                          {formatCurrency(canal.precoIdeal)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          lucro: {formatCurrency(canal.lucro)}/un
                        </p>
                      </div>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Inviável</Badge>
                    )}
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
                const canal = resultadosSimulacaoMargem.find(c => c.id === canalParaAplicar);
                if (canal?.precoIdeal) handleAplicar(canal.precoIdeal);
              }}
              disabled={isAplicando}
            >
              <Zap className="h-4 w-4" />
              Aplicar {formatCurrency(resultadosSimulacaoMargem.find(c => c.id === canalParaAplicar)?.precoIdeal || 0)}
            </Button>
          )}
        </TabsContent>

        {/* Tab: Simular por CMV */}
        <TabsContent value="cmv" className="space-y-4 mt-4">
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

          {/* Preço único para CMV + margens por canal */}
          {precoParaCMV && (
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Preço para CMV de {cmvDesejado}%
                </p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatCurrency(precoParaCMV)}
                </p>
              </div>

              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Margem resultante por canal
              </Label>
              <div className="space-y-2">
                {resultadosSimulacaoCMV.map(canal => (
                  <div 
                    key={canal.id}
                    className={cn(
                      "p-3 rounded-lg border transition-all",
                      canal.destaque 
                        ? "border-primary/20" 
                        : "border-muted"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {canal.icone}
                        <span className="text-sm font-medium">{canal.nome}</span>
                        {canal.taxa > 0 && (
                          <Badge variant="outline" className="text-[9px] px-1.5 h-4">
                            -{canal.taxa}%
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={cn("text-base font-bold", getCorMargem(canal.margem))}>
                          {formatPercent(canal.margem)}
                        </p>
                        <p className={cn("text-[10px]", getCorMargem(canal.lucro))}>
                          lucro: {formatCurrency(canal.lucro)}/un
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botão aplicar */}
              <Button
                size="lg"
                className="w-full gap-2 mt-2"
                onClick={() => handleAplicar(precoParaCMV)}
                disabled={isAplicando || precoParaCMV === produto.preco_venda}
              >
                <Zap className="h-4 w-4" />
                Aplicar {formatCurrency(precoParaCMV)}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Tab: Simular por Preço */}
        <TabsContent value="preco" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="text-sm">Digite o preço de venda</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={precoSimulado}
                onChange={(e) => setPrecoSimulado(e.target.value)}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="pl-10 text-lg font-semibold h-12"
              />
            </div>
          </div>

          {/* Resultados por canal */}
          {precoNumerico > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Margem com preço de {formatCurrency(precoNumerico)}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {resultadosSimulacaoPreco.map(canal => (
                  <div 
                    key={canal.id}
                    className={cn(
                      "p-3 rounded-lg border-2",
                      getCorBgMargem(canal.margem)
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
                    <p className={cn("text-xl font-bold", getCorMargem(canal.margem))}>
                      {formatPercent(canal.margem)}
                    </p>
                    <p className={cn("text-sm font-medium", getCorMargem(canal.lucro))}>
                      {formatCurrency(canal.lucro)}/un
                    </p>
                  </div>
                ))}
              </div>

              {/* Botão aplicar */}
              <Button
                size="lg"
                className="w-full gap-2 mt-2"
                onClick={() => handleAplicar(precoNumerico)}
                disabled={isAplicando || precoNumerico === produto.preco_venda}
              >
                <Zap className="h-4 w-4" />
                Aplicar {formatCurrency(precoNumerico)}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

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