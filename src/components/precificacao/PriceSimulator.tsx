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
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CheckCircle2,
  XCircle,
  BarChart3
} from 'lucide-react';
import { ProdutoComMetricas, TaxaApp, CustosPercentuais, formatCurrency, formatPercent } from './types';
import MarketPriceSearch from '@/components/produtos/MarketPriceSearch';
import ChannelComparisonTable from './ChannelComparisonTable';

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
  cmvAlvo?: number;
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
  isDrawer,
  cmvAlvo = 35
}) => {
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showChannelComparison, setShowChannelComparison] = useState(false);

  // Calcular margem do preço atual
  // NOTA: SEM custo fixo - ele é coberto pelo volume de vendas
  const calcularMargemDoPreco = (preco: number) => {
    if (!produto || preco <= 0) return 0;
    const { percImposto } = custosPercentuais;
    const taxaAppAtual = appSelecionado === 'balcao'
      ? 0
      : (taxasApps.find(a => a.id === appSelecionado)?.taxa_percentual || 0);
    
    const impostoValor = preco * (percImposto / 100);
    const taxaAppValor = preco * (taxaAppAtual / 100);
    // Lucro de contribuição (sem custo fixo)
    const lucro = preco - produto.custoInsumos - impostoValor - taxaAppValor;
    return (lucro / preco) * 100;
  };

  // Margem e lucro do preço ATUAL
  const margemAtual = useMemo(() => {
    if (!produto) return 0;
    return calcularMargemDoPreco(produto.preco_venda);
  }, [produto, custosPercentuais, appSelecionado, taxasApps]);

  const lucroAtual = useMemo(() => {
    if (!produto || produto.preco_venda <= 0) return 0;
    const { percImposto } = custosPercentuais;
    const taxaAppAtual = appSelecionado === 'balcao'
      ? 0
      : (taxasApps.find(a => a.id === appSelecionado)?.taxa_percentual || 0);
    
    const preco = produto.preco_venda;
    // SEM custo fixo no cálculo do lucro por unidade
    return preco - produto.custoInsumos - (preco * percImposto / 100) - (preco * taxaAppAtual / 100);
  }, [produto, custosPercentuais, appSelecionado, taxasApps]);

  const cmvAtual = useMemo(() => {
    if (!produto || produto.preco_venda <= 0) return 0;
    return (produto.custoInsumos / produto.preco_venda) * 100;
  }, [produto]);

  // Calcular margem máxima viável para o canal
  // NOTA: SEM custo fixo - agora há mais espaço para margem
  const margemMaximaViavel = useMemo(() => {
    const { percImposto } = custosPercentuais;
    const taxaAppAtual = appSelecionado === 'balcao'
      ? 0
      : (taxasApps.find(a => a.id === appSelecionado)?.taxa_percentual || 0);
    
    // Margem máxima = 100% - impostos - taxa app - margem mínima para CMV (~5%)
    const espacoDisponivel = 100 - percImposto - taxaAppAtual;
    // Deixar 5% de "folga" para CMV mínimo viável
    return Math.max(0, espacoDisponivel - 5);
  }, [custosPercentuais, appSelecionado, taxasApps]);

  // Calcular preço baseado nos parâmetros
  // FÓRMULA CORRETA: SEM custo fixo no divisor
  const calcs = useMemo(() => {
    if (!produto) return null;

    const { percImposto, percCustoFixo } = custosPercentuais;
    const taxaAppAtual = appSelecionado === 'balcao'
      ? 0
      : (taxasApps.find(a => a.id === appSelecionado)?.taxa_percentual || 0);

    const margem = margemDesejada / 100;
    const imposto = percImposto / 100;
    const taxaApp = taxaAppAtual / 100;

    // SEM custo fixo no divisor
    const divisor = 1 - margem - imposto - taxaApp;
    
    // Se divisor <= 0, é matematicamente impossível
    const isViavel = divisor > 0.01; // Mínimo 1% para CMV
    const novoPreco = isViavel ? produto.custoInsumos / divisor : null;

    const valorImposto = novoPreco ? novoPreco * imposto : 0;
    const valorTaxaApp = novoPreco ? novoPreco * taxaApp : 0;
    // Lucro de contribuição (sem custo fixo)
    const lucroLiquido = novoPreco ? novoPreco - produto.custoInsumos - valorImposto - valorTaxaApp : 0;

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
      // SEM custo fixo no divisor
      const div = 1 - margem - imposto - (taxa / 100);
      return div > 0.01 ? custo / div : null;
    }

    // Calcular composição total dos custos percentuais (informativo)
    const totalCustosPercentuais = percImposto + taxaAppAtual;

    return {
      novoPreco,
      valorImposto,
      valorCustoFixo: 0,  // Não calculamos mais por unidade
      valorTaxaApp,
      lucroLiquido,
      isViavel,
      percImposto,
      percCustoFixo,  // Mantido para exibição informativa
      percTaxaApp: taxaAppAtual,
      precosCanais,
      totalCustosPercentuais,
      divisor: divisor * 100
    };
  }, [produto, margemDesejada, appSelecionado, custosPercentuais, taxasApps]);

  // Verificar se margem é viável
  const isMargemInviavel = !calcs?.isViavel && modoPreco === 'margem';

  const precoFinal = modoPreco === 'manual' && precoManual
    ? parseFloat(precoManual) || 0
    : calcs?.novoPreco || 0;

  const margemCalculada = modoPreco === 'manual' && precoManual
    ? calcularMargemDoPreco(parseFloat(precoManual) || 0)
    : margemDesejada;

  const isPrecoViavel = modoPreco === 'manual'
    ? margemCalculada > 0
    : calcs?.isViavel;

  // SEM custo fixo no cálculo do lucro
  const lucroFinal = modoPreco === 'manual' && produto
    ? (precoFinal - produto.custoInsumos - (precoFinal * (calcs?.percImposto || 0) / 100) - (precoFinal * (calcs?.percTaxaApp || 0) / 100))
    : calcs?.lucroLiquido || 0;

  const cmvNovo = precoFinal > 0 && produto ? (produto.custoInsumos / precoFinal) * 100 : 0;

  // Diferenças
  const diferencaPreco = produto && precoFinal ? precoFinal - produto.preco_venda : 0;
  const diferencaMargem = precoFinal ? margemCalculada - margemAtual : 0;
  const diferencaLucro = precoFinal ? lucroFinal - lucroAtual : 0;

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

  // Helper para cor do CMV
  const getCmvColor = (cmv: number) => {
    if (cmv <= cmvAlvo) return 'text-emerald-600';
    if (cmv <= cmvAlvo + 10) return 'text-amber-600';
    return 'text-destructive';
  };

  const getCmvBg = (cmv: number) => {
    if (cmv <= cmvAlvo) return 'bg-emerald-500/10';
    if (cmv <= cmvAlvo + 10) return 'bg-amber-500/10';
    return 'bg-destructive/10';
  };

  const isCmvSaudavel = cmvNovo <= cmvAlvo;

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
          <p className="text-xs text-muted-foreground">
            Custo: <span className="font-semibold text-foreground">{formatCurrency(produto.custoInsumos)}</span>
          </p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} className="h-7 w-7 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Comparação: Atual vs Novo - Card Visual */}
      <div className="grid grid-cols-[1fr,auto,1fr] gap-2 items-stretch">
        {/* Preço Atual */}
        <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Atual</p>
          <p className="text-lg font-bold">{formatCurrency(produto.preco_venda)}</p>
          <div className="flex flex-col gap-0.5 text-xs">
            <span className={`font-medium ${margemAtual >= 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
              {formatPercent(margemAtual)} margem
            </span>
            <span className={`${getCmvColor(cmvAtual)} text-[10px]`}>
              CMV: {formatPercent(cmvAtual)}
            </span>
          </div>
        </div>

        {/* Seta de transição */}
        <div className="flex items-center justify-center">
          <div className={`p-1.5 rounded-full ${diferencaPreco >= 0 ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
            <ArrowRight className={`h-4 w-4 ${diferencaPreco >= 0 ? 'text-emerald-600' : 'text-amber-600'}`} />
          </div>
        </div>

        {/* Preço Novo */}
        <div className={`p-3 rounded-lg border-2 space-y-1 ${isPrecoViavel ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}`}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            {modoPreco === 'manual' ? 'Novo' : 'Calculado'}
          </p>
          {isPrecoViavel && precoFinal ? (
            <>
              <p className="text-lg font-bold text-primary">
                {formatCurrency(precoFinal)}
              </p>
              <div className="flex flex-col gap-0.5 text-xs">
                <span className={`font-medium ${margemCalculada >= 20 ? 'text-emerald-600' : margemCalculada >= 10 ? 'text-amber-600' : margemCalculada > 0 ? 'text-orange-600' : 'text-destructive'}`}>
                  {formatPercent(margemCalculada)} margem
                </span>
                <span className={`${getCmvColor(cmvNovo)} text-[10px] flex items-center gap-1`}>
                  CMV: {formatPercent(cmvNovo)}
                  {isCmvSaudavel ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                </span>
              </div>
            </>
          ) : (
            <div className="text-center py-1">
              <p className="text-destructive font-bold text-sm">Inviável</p>
              <p className="text-[10px] text-muted-foreground">
                Máx: {formatPercent(margemMaximaViavel)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Resumo das diferenças - Grid responsivo para mobile */}
      {isPrecoViavel && precoFinal && precoFinal !== produto.preco_venda && (
        <div className="grid grid-cols-3 gap-2 py-2 px-2 rounded-lg bg-muted/30 text-xs">
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              {diferencaPreco >= 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-amber-600" />
              )}
              <span className={diferencaPreco >= 0 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                {diferencaPreco >= 0 ? '+' : ''}{formatCurrency(diferencaPreco)}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">preço</span>
          </div>
          <div className="flex flex-col items-center gap-0.5 border-x border-border/50 px-2">
            <span className={diferencaMargem >= 0 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
              {diferencaMargem >= 0 ? '+' : ''}{formatPercent(diferencaMargem)}
            </span>
            <span className="text-[10px] text-muted-foreground">margem</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <span className={diferencaLucro >= 0 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
              {diferencaLucro >= 0 ? '+' : ''}{formatCurrency(diferencaLucro)}
            </span>
            <span className="text-[10px] text-muted-foreground">lucro</span>
          </div>
        </div>
      )}

      {/* Seletor de Canal - Scroll horizontal com melhor touch */}
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Canal de venda:</span>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          <Button
            size="sm"
            variant={appSelecionado === 'balcao' ? 'default' : 'outline'}
            onClick={() => setAppSelecionado('balcao')}
            className="h-9 px-3 text-xs gap-1.5 shrink-0 touch-manipulation"
          >
            <Store className="h-3.5 w-3.5" />
            Balcão
          </Button>
          {taxasApps.map(app => (
            <Button
              key={app.id}
              size="sm"
              variant={appSelecionado === app.id ? 'default' : 'outline'}
              onClick={() => setAppSelecionado(app.id)}
              className="h-9 px-3 text-xs gap-1.5 shrink-0 touch-manipulation"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="truncate max-w-[70px]">{app.nome_app}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{app.taxa_percentual}%</Badge>
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
                max={Math.floor(margemMaximaViavel)}
                step={1}
                value={margemDesejada.toFixed(0)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 5 && val <= margemMaximaViavel) {
                    setMargemDesejada(val);
                  }
                }}
                className={`w-12 h-7 text-center font-bold border-0 bg-transparent p-0 ${
                  margemDesejada > margemMaximaViavel ? 'text-destructive' : 'text-primary'
                }`}
              />
              <span className={`font-bold text-sm ${margemDesejada > margemMaximaViavel ? 'text-destructive' : 'text-primary'}`}>%</span>
            </div>
          </div>
          <div className="relative">
            <Slider
              value={[margemDesejada]}
              onValueChange={([value]) => setMargemDesejada(value)}
              min={5}
              max={Math.floor(margemMaximaViavel)}
              step={1}
              className="py-1"
            />
            {/* O indicador visual agora não é necessário pois o slider usa margemMaximaViavel como max */}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>5% mín</span>
            <span>30% ideal</span>
            <span>{Math.floor(margemMaximaViavel)}% máx</span>
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

      {/* Alerta de viabilidade - mais informativo */}
      {!isPrecoViavel && modoPreco === 'margem' && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs space-y-1">
            <p className="font-medium">Margem de {formatPercent(margemDesejada)} é inviável neste canal</p>
            <p className="text-destructive/80">
              Custos totais: {formatPercent(calcs?.totalCustosPercentuais || 0)} 
              (Impostos {formatPercent(calcs?.percImposto || 0)} + 
              Fixos {formatPercent(calcs?.percCustoFixo || 0)} + 
              Taxa {formatPercent(calcs?.percTaxaApp || 0)})
            </p>
            <p>Margem máxima viável: <strong>{formatPercent(margemMaximaViavel)}</strong></p>
          </AlertDescription>
        </Alert>
      )}
      
      {!isPrecoViavel && modoPreco === 'manual' && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Preço abaixo do custo mínimo!
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta de CMV alto */}
      {isPrecoViavel && !isCmvSaudavel && (
        <Alert className="py-2 border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-xs text-amber-700">
            CMV de {formatPercent(cmvNovo)} está acima da meta de {formatPercent(cmvAlvo)}
          </AlertDescription>
        </Alert>
      )}

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
                  <span className={`w-2 h-2 rounded-full ${isCmvSaudavel ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                  CMV ({formatPercent(cmvNovo)})
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

        {/* Comparativo de Canais - Novo componente com mesma margem/mesmo preço */}
        {taxasApps.length > 0 && (
          <Collapsible open={showChannelComparison} onOpenChange={setShowChannelComparison}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Comparar canais de venda
                </div>
                {showChannelComparison ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <ChannelComparisonTable
                produto={produto}
                taxasApps={taxasApps}
                percImposto={calcs?.percImposto || 0}
                cmvAlvo={cmvAlvo}
                margemReferencia={margemAtual > 0 ? margemAtual : undefined}
                precoReferencia={produto.preco_venda}
              />
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

      {/* Botão Aplicar - Touch friendly */}
      <Button
        onClick={onApply}
        disabled={isApplying || !isPrecoViavel || !precoFinal}
        className="w-full gap-2 h-12 text-base font-semibold touch-manipulation active:scale-[0.98] transition-transform"
        size="lg"
      >
        <Zap className="h-5 w-5" />
        {isPrecoViavel && precoFinal ? `Aplicar ${formatCurrency(precoFinal)}` : 'Margem inviável'}
      </Button>
    </div>
  );
};

export default PriceSimulator;
