import React, { useState, useMemo, useCallback } from 'react';
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
import { ProdutoAnalise, ConfiguracoesPrecificacao, formatCurrency, formatPercent, getQuadranteInfo } from './types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import ComposicaoPrecoModal from './ComposicaoPrecoModal';
import { usePrecosCanais } from '@/hooks/usePrecosCanais';

interface ProdutoDetalheDrawerProps {
  produto: ProdutoAnalise | null;
  isOpen: boolean;
  onClose: () => void;
  onAplicarPreco: (produtoId: string, novoPreco: number, precoAnterior: number) => void;
  onAplicarPrecoCanal?: (produtoId: string, canal: string, novoPreco: number, precoAnterior: number) => void;
  config: ConfiguracoesPrecificacao | undefined;
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
  isAplicando,
}) => {
  const isMobile = useIsMobile();
  const [cmvDesejado, setCmvDesejado] = useState(config?.cmv_alvo || 35);
  const [canalParaAplicar, setCanalParaAplicar] = useState<string | null>(null);
  const [precosEditaveis, setPrecosEditaveis] = useState<Record<string, string>>({});
  const [showComposicao, setShowComposicao] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Usar hook que busca canais da nova estrutura
  const { canaisConfigurados, isLoadingPrecos } = usePrecosCanais(produto?.id);

  // CRÍTICO: Resetar estados quando muda o produto selecionado
  // Isso evita que dados do produto anterior fiquem "presos" no drawer
  React.useEffect(() => {
    if (produto?.id) {
      // Limpar estados quando abre um novo produto
      setCmvDesejado(config?.cmv_alvo || 35);
      setCanalParaAplicar(null);
      setPrecosEditaveis({});
      setShowComposicao(false);
    }
  }, [produto?.id, config?.cmv_alvo]);

  // Montar lista de canais a partir da nova estrutura
  const canais: CanalInfo[] = useMemo(() => {
    if (!canaisConfigurados) return [];
    
    return canaisConfigurados.map(canal => ({
      id: canal.id,
      nome: canal.nome,
      taxa: canal.taxa,
      icone: canal.isBalcao ? <Store className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />,
      destaque: canal.isBalcao
    }));
  }, [canaisConfigurados]);

  const imposto = (config?.imposto_medio_sobre_vendas || 0) / 100;

  // Obter preço de um canal específico (usa preço customizado se existir)
  const getPrecoCanal = useCallback((canalId: string): number => {
    if (produto?.precosCanais && produto.precosCanais[canalId] !== undefined) {
      return produto.precosCanais[canalId];
    }
    return produto?.preco_venda ?? 0;
  }, [produto?.precosCanais, produto?.preco_venda]);

  // Calcular margem e lucro dado um preço e taxa
  const calcularResultado = useCallback((preco: number, taxa: number) => {
    if (preco <= 0 || !produto) return { margem: 0, lucro: 0 };
    const lucro = preco - produto.custoInsumos - preco * imposto - preco * (taxa / 100);
    const margem = (lucro / preco) * 100;
    return { margem, lucro };
  }, [produto?.custoInsumos, imposto]);

  // Calcular preço necessário para atingir CMV em um canal
  const calcularPrecoParaCMV = useCallback((cmvAlvo: number, taxaCanal: number): number | null => {
    if (!produto || cmvAlvo <= 0 || cmvAlvo >= 100) return null;
    const cmv = cmvAlvo / 100;
    const taxa = taxaCanal / 100;
    const fatorReceita = 1 - taxa;
    if (fatorReceita <= 0) return null;
    return produto.custoInsumos / (cmv * fatorReceita);
  }, [produto?.custoInsumos]);

  // Resultados atuais por canal (usa preço específico de cada canal)
  const resultadosAtuais = useMemo(() => {
    if (!produto) return [];
    try {
      return canais.map(canal => {
        const precoCanal = getPrecoCanal(canal.id);
        return {
          ...canal,
          preco: precoCanal,
          ...calcularResultado(precoCanal, canal.taxa)
        };
      });
    } catch (e) {
      console.error('Erro ao calcular resultados atuais:', e);
      return [];
    }
  }, [canais, getPrecoCanal, calcularResultado, produto]);

  // Resultados da simulação por CMV - preço diferente por canal!
  const resultadosSimulacaoCMV = useMemo(() => {
    if (!produto) return [];
    try {
      return canais.map(canal => {
        const precoCalculado = calcularPrecoParaCMV(cmvDesejado, canal.taxa);
        // Usar preço editável se existir, senão usar calculado
        const precoEditavel = precosEditaveis[canal.id];
        const precoFinal = precoEditavel ? parseFloat(precoEditavel.replace(',', '.')) || 0 : (precoCalculado ?? 0);
        const resultado = precoFinal > 0 ? calcularResultado(precoFinal, canal.taxa) : { margem: 0, lucro: 0 };
        return {
          ...canal,
          precoCalculado,
          precoFinal,
          ...resultado
        };
      });
    } catch (e) {
      console.error('Erro ao calcular simulação CMV:', e);
      return [];
    }
  }, [canais, cmvDesejado, precosEditaveis, calcularPrecoParaCMV, calcularResultado, produto]);

  const quadInfo = useMemo(() => {
    if (!produto) return null;
    return getQuadranteInfo(produto.quadrante);
  }, [produto?.quadrante]);

  // Retornar null se não houver produto ou se ainda está carregando
  if (!produto || !quadInfo) return null;

  // Tratamento de erro para evitar travamento
  if (error) {
    console.error('Erro no drawer de precificação:', error);
  }

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
    // Não fecha o drawer para permitir editar outros canais sem sair
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
            Custo: {formatCurrency(produto.custoInsumos)}
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
          {resultadosAtuais.map(canal => {
            const receitaLiquida = canal.preco * (1 - canal.taxa / 100);
            const cmvCanal = receitaLiquida > 0 ? (produto.custoInsumos / receitaLiquida) * 100 : 0;
            
            return (
              <div 
                key={canal.id} 
                className={cn(
                  "p-2.5 rounded-lg border space-y-1.5",
                  canal.destaque ? "border-primary/30 bg-primary/5" : "bg-muted/30"
                )}
              >
                {/* Header: nome + taxa */}
                <div className="flex items-center gap-1.5">
                  {canal.icone}
                  <span className="text-xs font-semibold truncate">{canal.nome}</span>
                  {canal.taxa > 0 && (
                    <Badge variant="secondary" className="text-[9px] px-1 h-4 ml-auto">
                      {canal.taxa}%
                    </Badge>
                  )}
                </div>
                {/* Linha 1: Preço */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Preço</span>
                  <span className="text-base font-extrabold text-foreground">{formatCurrency(canal.preco)}</span>
                </div>
                {/* Linha 2: Margem + Lucro */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Margem</span>
                  <span className={cn("text-sm font-semibold", getCorMargem(canal.margem))}>
                    {formatPercent(canal.margem)} <span className="text-xs font-normal">({formatCurrency(canal.lucro)})</span>
                  </span>
                </div>
                {/* Linha 3: CMV */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">CMV</span>
                  <span className={cn(
                    "text-xs font-medium",
                    cmvCanal > (config?.cmv_alvo || 35) + 10 ? "text-destructive" :
                    cmvCanal > (config?.cmv_alvo || 35) ? "text-amber-600" : "text-emerald-600"
                  )}>
                    {formatPercent(cmvCanal)}
                  </span>
                </div>
              </div>
            );
          })}
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

        {/* Aplicar canal individual (inline) */}
        {canalParaAplicar && (
          <Button
            size="lg"
            variant="secondary"
            className="w-full gap-2 font-semibold"
            onClick={() => {
              const canal = resultadosSimulacaoCMV.find(c => c.id === canalParaAplicar);
              if (canal?.precoFinal > 0) handleAplicar(canal.precoFinal, canal.id);
            }}
            disabled={isAplicando}
          >
            Aplicar só em {resultadosSimulacaoCMV.find(c => c.id === canalParaAplicar)?.nome}
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
          isBalcao: c.destaque,
          precoCanal: getPrecoCanal(c.id),
        }))}
        impostoPercentual={config?.imposto_medio_sobre_vendas || 0}
      />
    </div>
  );

  const rodapeFixo = (
    <div className="border-t bg-background p-3 flex gap-2">
      <Button
        size="lg"
        className="flex-1 gap-2"
        onClick={() => {
          resultadosSimulacaoCMV.forEach(canal => {
            if (canal.precoFinal > 0) {
              handleAplicar(canal.precoFinal, canal.id);
            }
          });
        }}
        disabled={isAplicando || resultadosSimulacaoCMV.every(c => c.precoFinal <= 0)}
      >
        <Zap className="h-4 w-4" />
        Aplicar Todos
      </Button>
      <Button size="lg" variant="outline" onClick={onClose}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[92vh] flex flex-col">
          <DrawerHeader className="flex items-center justify-between border-b pb-3 shrink-0">
            <DrawerTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Simulador de Preço
            </DrawerTitle>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1">
            {conteudoDrawer}
          </div>
          {rodapeFixo}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simulador de Preço
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1">
          {conteudoDrawer}
        </div>
        {rodapeFixo}
      </DialogContent>
    </Dialog>
  );
};

export default ProdutoDetalheDrawer;