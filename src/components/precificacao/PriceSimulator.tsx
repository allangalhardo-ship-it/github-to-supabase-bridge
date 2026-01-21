import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Calculator,
  X,
  Store,
  Smartphone,
  Percent,
  DollarSign,
  PieChart,
  AlertTriangle,
  Zap,
  ImageIcon,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  TrendingUp
} from 'lucide-react';
import { ProdutoComMetricas, TaxaApp, CustosPercentuais, formatCurrency, formatPercent } from './types';
import MarketPriceSearch from '@/components/produtos/MarketPriceSearch';

interface PriceSimulatorProps {
  produto: ProdutoComMetricas | null;
  taxasApps: TaxaApp[];
  custosPercentuais: CustosPercentuais;
  margemDesejada: number;
  setMargemDesejada: (value: number) => void;
  appSelecionado: string;
  setAppSelecionado: (value: string) => void;
  precoManual: string;
  setPrecoManual: (value: string) => void;
  modoPreco: 'margem' | 'manual';
  setModoPreco: (value: 'margem' | 'manual') => void;
  onApply: () => void;
  onClose: () => void;
  isApplying?: boolean;
  isDrawer?: boolean;
}

const PriceSimulator: React.FC<PriceSimulatorProps> = ({
  produto,
  taxasApps,
  custosPercentuais,
  margemDesejada,
  setMargemDesejada,
  appSelecionado,
  setAppSelecionado,
  precoManual,
  setPrecoManual,
  modoPreco,
  setModoPreco,
  onApply,
  onClose,
  isApplying,
  isDrawer
}) => {
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showChannelComparison, setShowChannelComparison] = useState(false);

  // Calcular preço baseado nos parâmetros
  const calcs = useMemo(() => {
    if (!produto) return null;

    const { percCustoFixo, percImposto } = custosPercentuais;
    const taxaAppAtual = appSelecionado === 'balcao'
      ? 0
      : (taxasApps.find(a => a.id === appSelecionado)?.taxa_percentual || 0);

    const margem = margemDesejada / 100;
    const imposto = percImposto / 100;
    const custoFixo = percCustoFixo / 100;
    const taxaApp = taxaAppAtual / 100;

    const divisor = 1 - margem - imposto - custoFixo - taxaApp;
    const novoPreco = divisor > 0 ? produto.custoInsumos / divisor : produto.custoInsumos * 3;

    const valorImposto = novoPreco * imposto;
    const valorCustoFixo = novoPreco * custoFixo;
    const valorTaxaApp = novoPreco * taxaApp;
    const lucroLiquido = novoPreco - produto.custoInsumos - valorImposto - valorCustoFixo - valorTaxaApp;

    const isViavel = divisor > 0 && lucroLiquido > 0;

    // Preços por canal
    const precosCanais = [
      { 
        nome: 'Balcão', 
        taxa: 0, 
        preco: calcularPrecoCanal(produto.custoInsumos, 0),
        icone: Store
      },
      ...taxasApps.map(app => ({
        nome: app.nome_app,
        taxa: app.taxa_percentual,
        preco: calcularPrecoCanal(produto.custoInsumos, app.taxa_percentual),
        icone: Smartphone
      }))
    ];

    function calcularPrecoCanal(custo: number, taxa: number) {
      const div = 1 - margem - imposto - custoFixo - (taxa / 100);
      return div > 0 ? custo / div : custo * 3;
    }

    return {
      novoPreco,
      valorImposto,
      valorCustoFixo,
      valorTaxaApp,
      lucroLiquido,
      isViavel,
      percImposto,
      percCustoFixo,
      percTaxaApp: taxaAppAtual,
      precosCanais
    };
  }, [produto, margemDesejada, appSelecionado, custosPercentuais, taxasApps]);

  // Calcular margem reversa quando o preço é digitado manualmente
  const calcularMargemDoPreco = (preco: number) => {
    if (!produto || preco <= 0) return 0;
    const { percCustoFixo, percImposto } = custosPercentuais;
    const taxaAppAtual = appSelecionado === 'balcao'
      ? 0
      : (taxasApps.find(a => a.id === appSelecionado)?.taxa_percentual || 0);
    
    const custoFixoValor = preco * (percCustoFixo / 100);
    const impostoValor = preco * (percImposto / 100);
    const taxaAppValor = preco * (taxaAppAtual / 100);
    const lucro = preco - produto.custoInsumos - custoFixoValor - impostoValor - taxaAppValor;
    return (lucro / preco) * 100;
  };

  const precoFinal = modoPreco === 'manual' && precoManual
    ? parseFloat(precoManual) || 0
    : calcs?.novoPreco || 0;

  const margemCalculada = modoPreco === 'manual' && precoManual
    ? calcularMargemDoPreco(parseFloat(precoManual) || 0)
    : margemDesejada;

  const isPrecoViavel = modoPreco === 'manual'
    ? margemCalculada > 0
    : calcs?.isViavel;

  const lucroFinal = modoPreco === 'manual' && produto
    ? (precoFinal - produto.custoInsumos - (precoFinal * (calcs?.percCustoFixo || 0) / 100) - (precoFinal * (calcs?.percImposto || 0) / 100) - (precoFinal * (calcs?.percTaxaApp || 0) / 100))
    : calcs?.lucroLiquido || 0;

  if (!produto) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Calculator className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">Selecione um produto</p>
        <p className="text-xs">para simular preços</p>
      </div>
    );
  }

  const canalAtualNome = appSelecionado === 'balcao' 
    ? 'Balcão' 
    : taxasApps.find(a => a.id === appSelecionado)?.nome_app || 'Canal';

  return (
    <div className={`flex flex-col gap-3 ${isDrawer ? 'pb-4' : ''}`}>
      {/* Header: Produto selecionado - Compacto */}
      <div className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg border">
        <div className="w-10 h-10 rounded-md bg-background flex items-center justify-center overflow-hidden shrink-0 border">
          {produto.imagem_url ? (
            <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{produto.nome}</p>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>Custo: <span className="font-semibold text-foreground">{formatCurrency(produto.custoInsumos)}</span></span>
            <span>Atual: <span className="font-semibold text-foreground">{formatCurrency(produto.preco_venda)}</span></span>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Seletor de Canal - Inline com scroll */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <span className="text-xs text-muted-foreground shrink-0">Canal:</span>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant={appSelecionado === 'balcao' ? 'default' : 'outline'}
            onClick={() => setAppSelecionado('balcao')}
            className="h-7 px-2.5 text-xs gap-1"
          >
            <Store className="h-3 w-3" />
            Balcão
          </Button>
          {taxasApps.map(app => (
            <Button
              key={app.id}
              size="sm"
              variant={appSelecionado === app.id ? 'default' : 'outline'}
              onClick={() => setAppSelecionado(app.id)}
              className="h-7 px-2.5 text-xs gap-1 shrink-0"
            >
              <Smartphone className="h-3 w-3" />
              <span className="truncate max-w-[60px]">{app.nome_app}</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{app.taxa_percentual}%</Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* Toggle Modo - Mais compacto */}
      <div className="flex rounded-lg border p-0.5 bg-muted/30">
        <button
          onClick={() => setModoPreco('margem')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            modoPreco === 'margem' 
              ? 'bg-background shadow-sm text-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Percent className="h-4 w-4" />
          Definir Margem
        </button>
        <button
          onClick={() => setModoPreco('manual')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            modoPreco === 'manual' 
              ? 'bg-background shadow-sm text-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Digitar Preço
        </button>
      </div>

      {/* Input Area */}
      {modoPreco === 'margem' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Margem líquida desejada</Label>
            <div className="flex items-center gap-1 bg-primary/10 rounded-md px-2 py-1">
              <Input
                type="number"
                min={5}
                max={60}
                step={1}
                value={margemDesejada.toFixed(0)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 5 && val <= 60) {
                    setMargemDesejada(val);
                  }
                }}
                className="w-12 h-7 text-center font-bold text-primary border-0 bg-transparent p-0"
              />
              <span className="font-bold text-primary text-sm">%</span>
            </div>
          </div>
          <Slider
            value={[margemDesejada]}
            onValueChange={([value]) => setMargemDesejada(value)}
            min={5}
            max={60}
            step={1}
            className="py-1"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>5% mín</span>
            <span>30% ideal</span>
            <span>60% máx</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-sm">Preço de venda desejado</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={precoManual}
              onChange={(e) => setPrecoManual(e.target.value)}
              className="pl-10 text-lg font-semibold h-11"
            />
          </div>
        </div>
      )}

      {/* Resultado Principal - Card de destaque */}
      <div className={`rounded-xl p-4 ${isPrecoViavel ? 'bg-primary/5 border-2 border-primary/20' : 'bg-destructive/5 border-2 border-destructive/20'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {modoPreco === 'manual' ? 'Preço definido' : 'Preço sugerido'}
              <span className="mx-1">•</span>
              <span className="font-medium">{canalAtualNome}</span>
            </p>
            <p className={`text-3xl font-bold tracking-tight ${isPrecoViavel ? 'text-primary' : 'text-destructive'}`}>
              {formatCurrency(precoFinal)}
            </p>
          </div>
          <div className="text-right space-y-1">
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              margemCalculada >= 20 ? 'bg-emerald-500/10 text-emerald-600' :
              margemCalculada >= 10 ? 'bg-amber-500/10 text-amber-600' :
              margemCalculada > 0 ? 'bg-orange-500/10 text-orange-600' :
              'bg-destructive/10 text-destructive'
            }`}>
              <TrendingUp className="h-3 w-3" />
              {formatPercent(margemCalculada)} margem
            </div>
            <p className="text-xs text-muted-foreground">
              Lucro: <span className={`font-semibold ${lucroFinal > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {formatCurrency(lucroFinal)}
              </span>
            </p>
          </div>
        </div>

        {!isPrecoViavel && (
          <Alert variant="destructive" className="mt-3 py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {modoPreco === 'manual' ? 'Preço abaixo do custo mínimo!' : 'Margem inviável. Reduza a margem ou revise custos.'}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Accordions para detalhes */}
      <div className="space-y-2">
        {/* Decomposição de Custos */}
        <Collapsible open={showCostBreakdown} onOpenChange={setShowCostBreakdown}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2 text-sm font-medium">
                <PieChart className="h-4 w-4 text-muted-foreground" />
                Composição do preço
              </div>
              {showCostBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-1.5 text-sm p-3 rounded-lg border bg-background">
              <div className="flex justify-between py-1 items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Custo insumos
                </span>
                <span className="font-medium">{formatCurrency(produto.custoInsumos)}</span>
              </div>
              <div className="flex justify-between py-1 items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Custo fixo ({formatPercent(calcs?.percCustoFixo || 0)})
                </span>
                <span>{formatCurrency((precoFinal * (calcs?.percCustoFixo || 0)) / 100)}</span>
              </div>
              <div className="flex justify-between py-1 items-center">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Impostos ({formatPercent(calcs?.percImposto || 0)})
                </span>
                <span>{formatCurrency((precoFinal * (calcs?.percImposto || 0)) / 100)}</span>
              </div>
              {(calcs?.percTaxaApp || 0) > 0 && (
                <div className="flex justify-between py-1 items-center">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    Taxa {canalAtualNome} ({formatPercent(calcs?.percTaxaApp || 0)})
                  </span>
                  <span>{formatCurrency((precoFinal * (calcs?.percTaxaApp || 0)) / 100)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 items-center border-t mt-2 pt-2">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Lucro líquido ({formatPercent(margemCalculada)})
                </span>
                <span className={`font-semibold ${lucroFinal > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {formatCurrency(lucroFinal)}
                </span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Comparativo de Canais */}
        {calcs?.precosCanais && calcs.precosCanais.length > 1 && (
          <Collapsible open={showChannelComparison} onOpenChange={setShowChannelComparison}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  Ver preços em outros canais
                </div>
                {showChannelComparison ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="grid grid-cols-2 gap-2">
                {calcs.precosCanais.map((canal, idx) => {
                  const isSelected = (appSelecionado === 'balcao' && canal.taxa === 0) ||
                    (appSelecionado !== 'balcao' && taxasApps.find(a => a.id === appSelecionado)?.taxa_percentual === canal.taxa);
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border text-center transition-all ${
                        isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-muted bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
                        {canal.taxa === 0 ? <Store className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                        {canal.nome}
                        {canal.taxa > 0 && <span className="opacity-70">({canal.taxa}%)</span>}
                      </div>
                      <p className={`font-bold text-sm ${isSelected ? 'text-primary' : ''}`}>{formatCurrency(canal.preco)}</p>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* Pesquisa de mercado - Link discreto */}
      <MarketPriceSearch
        productName={produto.nome}
        category={produto.categoria}
        currentPrice={produto.preco_venda}
        trigger={
          <button className="flex items-center justify-center gap-2 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ExternalLink className="h-4 w-4" />
            Consultar preço de mercado
          </button>
        }
      />

      {/* Botão Aplicar - Fixo no final */}
      <Button
        onClick={onApply}
        disabled={isApplying || !isPrecoViavel}
        className="w-full gap-2 h-12 text-base font-semibold"
        size="lg"
      >
        <Zap className="h-5 w-5" />
        Aplicar {formatCurrency(precoFinal)}
      </Button>
    </div>
  );
};

export default PriceSimulator;
