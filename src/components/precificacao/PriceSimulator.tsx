import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
  TrendingUp,
  ImageIcon,
  ExternalLink
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

  if (!produto) {
    return (
      <Card className="sticky top-4">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Simulador de Preço
          </CardTitle>
          <CardDescription>
            Simule diferentes margens e canais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Calculator className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selecione um produto para simular</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${isDrawer ? 'pb-4' : ''}`}>
      {/* Produto selecionado */}
      <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
        <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {produto.imagem_url ? (
            <img
              src={produto.imagem_url}
              alt={produto.nome}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm line-clamp-2">{produto.nome}</p>
          <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
            <span>Custo: <span className="font-medium text-foreground">{formatCurrency(produto.custoInsumos)}</span></span>
            <span>Atual: <span className="font-medium text-foreground">{formatCurrency(produto.preco_venda)}</span></span>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Pesquisa de Mercado */}
      <MarketPriceSearch
        productName={produto.nome}
        category={produto.categoria}
        currentPrice={produto.preco_venda}
        trigger={
          <Button variant="outline" size="sm" className="w-full gap-2">
            <ExternalLink className="h-4 w-4" />
            Consultar preço de mercado
          </Button>
        }
      />

      {/* Seletor de Canal */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Canal de Venda</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant={appSelecionado === 'balcao' ? 'default' : 'outline'}
            onClick={() => setAppSelecionado('balcao')}
            className="gap-1.5 h-9"
          >
            <Store className="h-4 w-4" />
            Balcão
          </Button>
          {taxasApps.map(app => (
            <Button
              key={app.id}
              size="sm"
              variant={appSelecionado === app.id ? 'default' : 'outline'}
              onClick={() => setAppSelecionado(app.id)}
              className="gap-1.5 h-9"
            >
              <Smartphone className="h-4 w-4" />
              <span className="truncate">{app.nome_app}</span>
              <span className="text-xs opacity-70">({app.taxa_percentual}%)</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Toggle Margem / Manual */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant={modoPreco === 'margem' ? 'default' : 'outline'}
          onClick={() => setModoPreco('margem')}
          className="gap-1.5 h-10"
        >
          <Percent className="h-4 w-4" />
          Por Margem
        </Button>
        <Button
          size="sm"
          variant={modoPreco === 'manual' ? 'default' : 'outline'}
          onClick={() => setModoPreco('manual')}
          className="gap-1.5 h-10"
        >
          <DollarSign className="h-4 w-4" />
          Digitar Preço
        </Button>
      </div>

      {/* Input de Margem ou Preço */}
      {modoPreco === 'margem' ? (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-sm">Margem Líquida</Label>
            <div className="flex items-center gap-2">
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
                className="w-16 h-9 text-center font-bold text-primary"
              />
              <span className="font-bold text-primary">%</span>
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
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5%</span>
            <span>30%</span>
            <span>60%</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Label className="text-sm">Digite o preço desejado</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={precoManual}
              onChange={(e) => setPrecoManual(e.target.value)}
              className="pl-9 text-lg font-semibold h-12"
            />
          </div>
          {precoManual && (
            <div className={`p-3 rounded-lg ${margemCalculada >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Margem resultante</span>
                <span className={`text-lg font-bold ${margemCalculada >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatPercent(margemCalculada)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <Separator />

      {/* Decomposição do preço */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <PieChart className="h-4 w-4" />
          Composição do Preço
        </h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between py-1.5 items-center">
            <span className="text-muted-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              Insumos
            </span>
            <span className="font-medium">{formatCurrency(produto.custoInsumos)}</span>
          </div>
          <div className="flex justify-between py-1.5 items-center">
            <span className="text-muted-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              C. Fixo ({formatPercent(calcs?.percCustoFixo || 0)})
            </span>
            <span>{formatCurrency(calcs?.valorCustoFixo || 0)}</span>
          </div>
          <div className="flex justify-between py-1.5 items-center">
            <span className="text-muted-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Imposto ({formatPercent(calcs?.percImposto || 0)})
            </span>
            <span>{formatCurrency(calcs?.valorImposto || 0)}</span>
          </div>
          {(calcs?.percTaxaApp || 0) > 0 && (
            <div className="flex justify-between py-1.5 items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                Taxa App ({formatPercent(calcs?.percTaxaApp || 0)})
              </span>
              <span>{formatCurrency(calcs?.valorTaxaApp || 0)}</span>
            </div>
          )}
          <div className="flex justify-between py-2 items-center border-t pt-3">
            <span className="text-muted-foreground flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              Lucro ({formatPercent(modoPreco === 'manual' ? margemCalculada : margemDesejada)})
            </span>
            <span className={`font-medium ${margemCalculada > 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(modoPreco === 'manual'
                ? (precoFinal - produto.custoInsumos - (precoFinal * (calcs?.percCustoFixo || 0) / 100) - (precoFinal * (calcs?.percImposto || 0) / 100) - (precoFinal * (calcs?.percTaxaApp || 0) / 100))
                : calcs?.lucroLiquido || 0)}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Preço Final */}
      <div className={`flex justify-between items-center p-4 rounded-lg ${
        isPrecoViavel ? 'bg-primary/10 border border-primary/30' : 'bg-destructive/10 border border-destructive/30'
      }`}>
        <div>
          <p className="text-xs text-muted-foreground">
            {modoPreco === 'manual' ? 'Preço Definido' : 'Preço Sugerido'}
          </p>
          <p className="text-sm text-muted-foreground">
            {appSelecionado === 'balcao' ? 'Venda direta' : taxasApps.find(a => a.id === appSelecionado)?.nome_app}
          </p>
        </div>
        <span className={`text-2xl font-bold ${isPrecoViavel ? 'text-primary' : 'text-destructive'}`}>
          {formatCurrency(precoFinal)}
        </span>
      </div>

      {!isPrecoViavel && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {modoPreco === 'manual'
              ? 'Preço muito baixo! A margem está negativa.'
              : 'Margem inviável! Reduza ou revise custos.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Comparativo de Canais */}
      {calcs?.precosCanais && calcs.precosCanais.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">Todos os Canais</h4>
          <div className="grid grid-cols-2 gap-2">
            {calcs.precosCanais.map((canal, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-lg border text-center ${
                  (appSelecionado === 'balcao' && canal.taxa === 0) ||
                  (appSelecionado !== 'balcao' && taxasApps.find(a => a.id === appSelecionado)?.taxa_percentual === canal.taxa)
                    ? 'border-primary bg-primary/5'
                    : 'border-muted'
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1">
                  {canal.taxa === 0 ? (
                    <Store className="h-3 w-3" />
                  ) : (
                    <Smartphone className="h-3 w-3" />
                  )}
                  {canal.nome}
                </div>
                <p className="font-bold text-sm">{formatCurrency(canal.preco)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão de Aplicar */}
      <Button
        onClick={onApply}
        disabled={isApplying || !isPrecoViavel}
        className="w-full gap-2 h-12"
        size="lg"
      >
        <Zap className="h-5 w-5" />
        Aplicar Preço de {formatCurrency(precoFinal)}
      </Button>
    </div>
  );
};

export default PriceSimulator;
