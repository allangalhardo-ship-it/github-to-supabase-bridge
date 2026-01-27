import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  Store, 
  Smartphone,
  CheckCircle2,
  XCircle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Equal
} from 'lucide-react';
import { ProdutoComMetricas, CanalVenda, formatCurrency, formatPercent } from './types';

interface ChannelComparisonTableProps {
  produto: ProdutoComMetricas;
  canaisVenda: CanalVenda[];
  percImposto: number;
  cmvAlvo: number;
  margemReferencia?: number; // Margem a manter em todos os canais
  precoReferencia?: number;  // Preço atual para comparar
}

interface CanalInfo {
  id: string;
  nome: string;
  taxa: number;
  icone: React.ElementType;
}

const ChannelComparisonTable: React.FC<ChannelComparisonTableProps> = ({
  produto,
  canaisVenda,
  percImposto,
  cmvAlvo,
  margemReferencia,
  precoReferencia
}) => {
  const [viewMode, setViewMode] = useState<'mesma-margem' | 'mesmo-preco'>('mesma-margem');

  // Lista de canais disponíveis
  const canais: CanalInfo[] = useMemo(() => 
    canaisVenda.map(canal => ({
      id: canal.id,
      nome: canal.nome,
      taxa: canal.taxa,
      icone: canal.isBalcao ? Store : Smartphone
    }))
  , [canaisVenda]);

  // Calcular margem para um preço específico em um canal
  const calcularMargem = (preco: number, taxaApp: number): number => {
    if (preco <= 0) return 0;
    const impostoValor = preco * (percImposto / 100);
    const taxaAppValor = preco * (taxaApp / 100);
    const lucro = preco - produto.custoInsumos - impostoValor - taxaAppValor;
    return (lucro / preco) * 100;
  };

  // Calcular preço para atingir uma margem específica em um canal
  const calcularPreco = (margem: number, taxaApp: number): number | null => {
    const margemDec = margem / 100;
    const impostoDec = percImposto / 100;
    const taxaDec = taxaApp / 100;
    const divisor = 1 - margemDec - impostoDec - taxaDec;
    if (divisor <= 0.01) return null; // Inviável
    return produto.custoInsumos / divisor;
  };

  // Margem atual do produto (usando o primeiro canal como referência)
  const margemAtualPrimeiro = useMemo(() => {
    const primeiroCanal = canais[0];
    return primeiroCanal ? calcularMargem(produto.preco_venda, primeiroCanal.taxa) : 0;
  }, [produto, percImposto, canais]);

  // Usar margem de referência ou a margem atual do primeiro canal
  const margemBase = margemReferencia ?? margemAtualPrimeiro;
  const precoBase = precoReferencia ?? produto.preco_venda;

  // Dados para "Mesma Margem" - calcular preço em cada canal para manter a margem
  const dadosMesmaMargem = useMemo(() => {
    return canais.map(canal => {
      const preco = calcularPreco(margemBase, canal.taxa);
      const cmv = preco ? (produto.custoInsumos / preco) * 100 : 0;
      const diferenca = preco ? preco - precoBase : 0;
      
      return {
        ...canal,
        preco,
        margem: margemBase,
        cmv,
        diferenca,
        isViavel: preco !== null,
        isCmvSaudavel: cmv <= cmvAlvo
      };
    });
  }, [canais, margemBase, precoBase, produto, percImposto, cmvAlvo]);

  // Dados para "Mesmo Preço" - calcular margem em cada canal com o mesmo preço
  const dadosMesmoPreco = useMemo(() => {
    return canais.map(canal => {
      const margem = calcularMargem(precoBase, canal.taxa);
      const cmv = precoBase > 0 ? (produto.custoInsumos / precoBase) * 100 : 0;
      const diferencaMargem = margem - margemBase;
      
      return {
        ...canal,
        preco: precoBase,
        margem,
        cmv,
        diferencaMargem,
        isViavel: margem > 0,
        isCmvSaudavel: cmv <= cmvAlvo
      };
    });
  }, [canais, precoBase, margemBase, produto, percImposto, cmvAlvo]);

  const getMargemColor = (margem: number) => {
    if (margem >= 30) return 'text-emerald-600';
    if (margem >= 20) return 'text-emerald-500';
    if (margem >= 10) return 'text-amber-600';
    if (margem > 0) return 'text-orange-600';
    return 'text-destructive';
  };

  const getCmvColor = (cmv: number) => {
    if (cmv <= cmvAlvo) return 'text-emerald-600';
    if (cmv <= cmvAlvo + 10) return 'text-amber-600';
    return 'text-destructive';
  };

  return (
    <div className="space-y-3">
      {/* Header com margem de referência */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
        <div className="text-xs">
          <span className="text-muted-foreground">Referência: </span>
          <span className="font-medium">{formatCurrency(precoBase)}</span>
          <span className="text-muted-foreground"> com </span>
          <span className="font-semibold text-primary">{formatPercent(margemBase)}</span>
          <span className="text-muted-foreground"> margem</span>
        </div>
      </div>

      {/* Tabs para alternar entre visualizações */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
        <TabsList className="grid w-full grid-cols-2 h-9">
          <TabsTrigger value="mesma-margem" className="text-xs gap-1.5">
            <Equal className="h-3 w-3" />
            Mesma Margem
          </TabsTrigger>
          <TabsTrigger value="mesmo-preco" className="text-xs gap-1.5">
            <Equal className="h-3 w-3" />
            Mesmo Preço
          </TabsTrigger>
        </TabsList>

        {/* Mesma Margem - Mostra preços diferentes para manter a margem */}
        <TabsContent value="mesma-margem" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            Para manter <span className="font-semibold text-foreground">{formatPercent(margemBase)}</span> de margem em cada canal:
          </p>
          <div className="space-y-1.5">
            {dadosMesmaMargem.map((canal) => {
              const Icon = canal.icone;
              return (
                <div
                  key={canal.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    !canal.isViavel 
                      ? 'border-destructive/30 bg-destructive/5' 
                      : canal.taxa === 0
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{canal.nome}</p>
                      {canal.taxa > 0 && (
                        <p className="text-[10px] text-muted-foreground">Taxa: {canal.taxa}%</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {canal.isViavel ? (
                      <>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${canal.taxa === 0 ? 'text-primary' : ''}`}>
                            {formatCurrency(canal.preco!)}
                          </p>
                          <p className={`text-[10px] ${getCmvColor(canal.cmv)}`}>
                            CMV: {formatPercent(canal.cmv)}
                          </p>
                        </div>
                        {canal.diferenca !== 0 && (
                          <div className={`flex items-center gap-0.5 text-xs ${
                            canal.diferenca > 0 ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {canal.diferenca > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <span>{canal.diferenca > 0 ? '+' : ''}{formatCurrency(canal.diferenca)}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inviável
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* Mesmo Preço - Mostra margens diferentes com o mesmo preço */}
        <TabsContent value="mesmo-preco" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            Com o mesmo preço de <span className="font-semibold text-foreground">{formatCurrency(precoBase)}</span> em cada canal:
          </p>
          <div className="space-y-1.5">
            {dadosMesmoPreco.map((canal) => {
              const Icon = canal.icone;
              return (
                <div
                  key={canal.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    !canal.isViavel 
                      ? 'border-destructive/30 bg-destructive/5' 
                      : canal.taxa === 0
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{canal.nome}</p>
                      {canal.taxa > 0 && (
                        <p className="text-[10px] text-muted-foreground">Taxa: {canal.taxa}%</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {canal.isViavel ? (
                      <>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${getMargemColor(canal.margem)}`}>
                            {formatPercent(canal.margem)} margem
                          </p>
                          <p className={`text-[10px] ${getCmvColor(canal.cmv)}`}>
                            CMV: {formatPercent(canal.cmv)}
                          </p>
                        </div>
                        {canal.diferencaMargem !== 0 && (
                          <div className={`flex items-center gap-0.5 text-xs ${
                            canal.diferencaMargem > 0 ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {canal.diferencaMargem > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <span>{canal.diferencaMargem > 0 ? '+' : ''}{formatPercent(canal.diferencaMargem)}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        <XCircle className="h-3 w-3 mr-1" />
                        Prejuízo
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChannelComparisonTable;
