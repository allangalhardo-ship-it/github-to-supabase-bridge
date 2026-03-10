import React, { useState } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedCardContainer, StaggeredCard } from '@/components/ui/animated-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DashboardInsights } from '@/components/dashboard/DashboardInsights';
import { SmartInsights } from '@/components/dashboard/SmartInsights';
import { PontoEquilibrioCard } from '@/components/dashboard/PontoEquilibrioCard';
import { BusinessCoach } from '@/components/dashboard/BusinessCoach';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, DollarSign, Percent,
  Package, AlertTriangle, Receipt, HelpCircle,
  ChevronDown, Lightbulb, CalendarIcon, Store,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrencyBRL } from '@/lib/format';
import WelcomeChecklist from '@/components/dashboard/WelcomeChecklist';
import AlertasInteligentes from '@/components/dashboard/AlertasInteligentes';
import MargemEvolutionChart from '@/components/dashboard/MargemEvolutionChart';
import { AlertaVencimento } from '@/components/producao/AlertaVencimento';

type PeriodoType = 'hoje' | 'semana' | 'mes' | 'ultimos30' | 'personalizado';

const Dashboard = () => {
  const d = useDashboardData();
  const [showSmartInsights, setShowSmartInsights] = useState(true);
  const formatCurrency = formatCurrencyBRL;

  const renderDelta = (delta: number | null, invertColors = false) => {
    if (delta === null) return null;
    const isPositive = invertColors ? delta < 0 : delta > 0;
    return (
      <p className={`text-[10px] flex items-center gap-0.5 mt-0.5 ${isPositive ? 'text-green-600' : 'text-destructive'}`}>
        {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% vs anterior
      </p>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <WelcomeChecklist />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {d.empresa?.nome ? `Olá, ${d.empresa.nome}!` : 'Meu Negócio'}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Veja como está o seu negócio {
              d.periodo === 'hoje' ? 'hoje'
              : d.periodo === 'semana' ? 'esta semana'
              : d.periodo === 'mes' ? 'este mês'
              : d.periodo === 'personalizado' && d.customDateFrom && d.customDateTo
                ? `de ${format(d.customDateFrom, 'dd/MM/yyyy')} a ${format(d.customDateTo, 'dd/MM/yyyy')}`
                : 'nos últimos 30 dias'
            }
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={d.periodo} onValueChange={(v) => d.setPeriodo(v as PeriodoType)}>
            <SelectTrigger className="w-full sm:w-[180px] h-9 sm:h-10"><SelectValue placeholder="Selecione o período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semana">Esta semana</SelectItem>
              <SelectItem value="mes">Este mês</SelectItem>
              <SelectItem value="ultimos30">Últimos 30 dias</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {d.periodo === 'personalizado' && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 sm:h-10 justify-start text-left font-normal min-w-[130px]", !d.customDateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {d.customDateFrom ? format(d.customDateFrom, 'dd/MM/yyyy') : 'Início'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={d.customDateFrom} onSelect={d.setCustomDateFrom} disabled={(date) => date > new Date() || (d.customDateTo ? date > d.customDateTo : false)} initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-sm">a</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 sm:h-10 justify-start text-left font-normal min-w-[130px]", !d.customDateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {d.customDateTo ? format(d.customDateTo, 'dd/MM/yyyy') : 'Fim'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={d.customDateTo} onSelect={d.setCustomDateTo} disabled={(date) => date > new Date() || (d.customDateFrom ? date < d.customDateFrom : false)} initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <AnimatedCardContainer className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5" staggerDelay={0.08}>
        <StaggeredCard className="p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-medium">Receita Bruta</CardTitle>
            <div className="h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-primary/10 flex items-center justify-center"><DollarSign className="h-5 w-5 sm:h-4 sm:w-4 text-primary" /></div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {d.isLoading ? <Skeleton className="h-8 w-24" /> : (<><div className="text-2xl font-bold">{formatCurrency(d.receitaBruta)}</div>{renderDelta(d.deltaReceita)}</>)}
          </CardContent>
        </StaggeredCard>

        <StaggeredCard className="p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-medium">Ticket Médio</CardTitle>
            <div className="h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-purple-500/10 flex items-center justify-center"><Receipt className="h-5 w-5 sm:h-4 sm:w-4 text-purple-600" /></div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {d.isLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(d.ticketMedio)}</div>
                <p className="text-xs text-muted-foreground mt-1 mb-2">{d.totalVendas} {d.totalVendas === 1 ? 'venda' : 'vendas'} no período</p>
                {d.ticketPorCanal.length > 0 && (
                  <div className="pt-2 border-t overflow-hidden">
                    <table className="w-full text-xs table-fixed"><tbody>
                      {d.ticketPorCanal.map((item) => (
                        <tr key={item.canal}>
                          <td className="text-muted-foreground py-0.5 truncate max-w-[60px] overflow-hidden">{item.canal}</td>
                          <td className="text-right font-medium py-0.5 whitespace-nowrap">{formatCurrency(item.ticketMedio)}</td>
                          <td className="text-right text-muted-foreground py-0.5 w-8 whitespace-nowrap">({item.quantidade})</td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </StaggeredCard>

        <StaggeredCard className="p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-medium">CMV</CardTitle>
            <div className="h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-amber-500/10 flex items-center justify-center"><Percent className="h-5 w-5 sm:h-4 sm:w-4 text-amber-600" /></div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {d.isLoading ? <Skeleton className="h-8 w-24" /> : (
              <><div className="text-2xl font-bold">{d.cmvPercent.toFixed(1)}%</div><p className="text-xs sm:text-sm text-muted-foreground mt-1">{formatCurrency(d.cmvTotal)} em insumos</p></>
            )}
          </CardContent>
        </StaggeredCard>

        <StaggeredCard className="p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-medium">Lucro Bruto</CardTitle>
            <div className="h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-blue-500/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 sm:h-4 sm:w-4 text-blue-600" /></div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {d.isLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(d.margemContribuicao)}</div>
                {renderDelta(d.deltaLucroBruto)}
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Receita - CMV ({d.receitaBruta > 0 ? ((d.margemContribuicao / d.receitaBruta) * 100).toFixed(1) : 0}%)</p>
              </>
            )}
          </CardContent>
        </StaggeredCard>

        <StaggeredCard className="p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-6 sm:pt-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <CardTitle className="text-sm sm:text-base font-medium cursor-help flex items-center gap-1">
                  Lucro Estimado<HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                </CardTitle>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <div className="space-y-2 text-xs">
                  <p className="font-medium">Cálculo do Lucro Estimado:</p>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between"><span>Receita Bruta</span><span className="text-green-600">+{formatCurrency(d.receitaBruta)}</span></div>
                    <div className="flex justify-between"><span>CMV (insumos)</span><span className="text-red-500">-{formatCurrency(d.cmvTotal)}</span></div>
                    <div className="flex justify-between"><span>Custos fixos {d.periodo === 'mes' || d.periodo === 'ultimos30' ? '(mensal)' : '(proporcional)'}</span><span className="text-red-500">-{formatCurrency(d.custoFixoTotal)}</span></div>
                    {d.impostos > 0 && <div className="flex justify-between"><span>Impostos ({d.impostoPercent}%)</span><span className="text-red-500">-{formatCurrency(d.impostos)}</span></div>}
                    {d.taxaAppTotal > 0 && <div className="flex justify-between"><span>Taxas apps</span><span className="text-red-500">-{formatCurrency(d.taxaAppTotal)}</span></div>}
                    <div className="border-t pt-1 flex justify-between font-bold">
                      <span>Lucro Estimado</span>
                      <span className={d.lucroEstimado >= 0 ? 'text-green-600' : 'text-red-500'}>{formatCurrency(d.lucroEstimado)}</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-[10px] pt-1">
                    {d.periodo === 'mes' || d.periodo === 'ultimos30' ? 'Custo fixo mensal inteiro é deduzido, pois é o compromisso real a pagar.' : 'Custo fixo proporcional ao período selecionado.'}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
            <div className={`h-10 w-10 sm:h-8 sm:w-8 rounded-full flex items-center justify-center ${d.lucroEstimado >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
              {d.lucroEstimado >= 0 ? <TrendingUp className="h-5 w-5 sm:h-4 sm:w-4 text-green-600" /> : <TrendingDown className="h-5 w-5 sm:h-4 sm:w-4 text-destructive" />}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
            {d.isLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <div className={`text-2xl font-bold ${d.lucroEstimado >= 0 ? 'text-green-600' : 'text-destructive'}`}>{formatCurrency(d.lucroEstimado)}</div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {d.lucroEstimado < 0 && d.margemContribuicao < d.custoFixoMensal ? (
                    <span className="text-destructive">Falta {formatCurrency(d.custoFixoMensal - d.margemContribuicao)} de lucro bruto p/ cobrir CF</span>
                  ) : (
                    <>CF ({formatCurrency(d.custoFixoTotal)}){d.impostos > 0 ? ` + imp. (${formatCurrency(d.impostos)})` : ''}{d.taxaAppTotal > 0 ? ` + taxas (${formatCurrency(d.taxaAppTotal)})` : ''}</>
                  )}
                </p>
              </>
            )}
          </CardContent>
        </StaggeredCard>
      </AnimatedCardContainer>

      <PontoEquilibrioCard receitaBruta={d.receitaBruta} margemContribuicao={d.margemContribuicao} custoFixoMensal={d.custoFixoMensal} isLoading={d.isLoading} margemEstimada={d.margemContribuicaoEstimada} />

      {/* Platform taxes card */}
      {d.vendasFinanceiro && d.vendasFinanceiro.length > 0 && (() => {
        const totalTaxaServico = d.vendasFinanceiro.reduce((s, v) => s + Number(v.taxa_servico || 0), 0);
        const totalIncentivoLoja = d.vendasFinanceiro.reduce((s, v) => s + Number(v.incentivo_loja || 0), 0);
        const totalIncentivoPlataforma = d.vendasFinanceiro.reduce((s, v) => s + Number(v.incentivo_plataforma || 0), 0);
        const custoReal = totalTaxaServico + totalIncentivoLoja;
        if (custoReal <= 0) return null;
        return (
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader className="pb-2"><CardTitle className="text-sm sm:text-base flex items-center gap-2"><Store className="h-4 w-4 text-amber-600" />Taxas & Descontos do Período</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><p className="text-[10px] sm:text-xs text-muted-foreground">Taxa de Serviço</p><p className="text-sm sm:text-lg font-bold text-destructive">{formatCurrency(totalTaxaServico)}</p></div>
                <div><p className="text-[10px] sm:text-xs text-muted-foreground">Incentivo Loja</p><p className="text-sm sm:text-lg font-bold text-destructive">{formatCurrency(totalIncentivoLoja)}</p><p className="text-[9px] text-muted-foreground">Sai do seu bolso</p></div>
                <div><p className="text-[10px] sm:text-xs text-muted-foreground">Incentivo Plataforma</p><p className="text-sm sm:text-lg font-bold text-green-600">{formatCurrency(totalIncentivoPlataforma)}</p><p className="text-[9px] text-muted-foreground">Não sai do seu bolso</p></div>
                <div><p className="text-[10px] sm:text-xs text-muted-foreground">Custo Total Plataformas</p><p className="text-sm sm:text-lg font-bold text-destructive">{formatCurrency(custoReal)}</p><p className="text-[9px] text-muted-foreground">{d.receitaBruta > 0 ? `${((custoReal / d.receitaBruta) * 100).toFixed(1)}% da receita` : ''}</p></div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <BusinessCoach vendas={d.vendas as any} produtos={d.produtosAnalise as any} canaisConfigurados={d.canaisConfigurados as any} config={d.config} custosFixos={d.custosFixos as any} historicoPrecos={d.historicoPrecos as any} periodo={d.periodo} formatCurrency={formatCurrency} />

      <DashboardInsights produtosMargemNegativa={d.produtosMargemNegativa} impactoApps={d.impactoApps} melhorProduto={d.melhorProduto} lucroTotal={d.lucroEstimado} formatCurrency={formatCurrency} />

      <Collapsible open={showSmartInsights} onOpenChange={setShowSmartInsights}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-0 hover:bg-transparent text-muted-foreground hover:text-foreground transition-colors">
              <Lightbulb className="h-4 w-4" /><span className="text-sm font-medium">Smart Insights</span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showSmartInsights ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          {!showSmartInsights && <span className="text-xs text-muted-foreground">Clique para expandir análises detalhadas</span>}
        </div>
        <CollapsibleContent className="animate-accordion-down">
          <div className="pt-3">
            <SmartInsights vendas={d.vendas as any} produtos={d.produtosAnalise as any} canaisConfigurados={d.canaisConfigurados as any} config={d.config} custosFixos={d.custosFixos as any} periodo={d.periodo} formatCurrency={formatCurrency} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <AlertasInteligentes historicoPrecos={d.historicoPrecos} cmvAtual={d.cmvPercent} cmvAlvo={d.config?.cmv_alvo || 35} produtosDefasados={d.produtosDefasados} produtosMargemNegativa={d.qtdProdutosMargemNegativa} />

      <MargemEvolutionChart />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 animate-fade-in">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Top 5 Produtos por Lucro</CardTitle></CardHeader>
          <CardContent>
            {d.loadingTop ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : d.topProdutos && d.topProdutos.length > 0 ? (
              <div className="space-y-3">
                {d.topProdutos.map((produto, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg gap-2 overflow-hidden">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
                      <span className="text-sm sm:text-lg font-bold text-muted-foreground shrink-0">#{index + 1}</span>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="font-medium truncate text-sm sm:text-base">{produto.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{produto.quantidade}x vendidos</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-green-600 text-sm sm:text-base whitespace-nowrap">{formatCurrency(produto.lucro)}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">{formatCurrency(produto.receita)} receita</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-muted-foreground py-8">Nenhuma venda no período</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />Alertas de Estoque</CardTitle></CardHeader>
          <CardContent>
            {d.insumosAlerta && d.insumosAlerta.length > 0 ? (
              <div className="space-y-3">
                {d.insumosAlerta.slice(0, 5).map((insumo) => (
                  <div key={insumo.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg gap-2 overflow-hidden">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="font-medium truncate text-sm">{insumo.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">Mín: {insumo.estoque_minimo} {insumo.unidade_medida}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-amber-600 text-sm whitespace-nowrap">{Number(insumo.estoque_atual).toFixed(1)} {insumo.unidade_medida}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-center text-muted-foreground py-8">Todos os insumos com estoque adequado 👍</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
