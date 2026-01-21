import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  GraduationCap,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Target,
  Flame,
  History,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Venda {
  id: string;
  valor_total: number;
  quantidade: number;
  canal: string | null;
  data_venda: string;
  produto_id: string | null;
  produto_nome?: string;
  produto_categoria?: string;
  produto_preco_venda?: number;
  custo_insumos?: number;
}

interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  categoria: string | null;
  fichas_tecnicas?: Array<{
    quantidade: number;
    insumo_id: string;
    insumos?: {
      id: string;
      nome: string;
      custo_unitario: number;
    };
  }>;
}

interface TaxaApp {
  nome_app: string;
  taxa_percentual: number;
}

interface Config {
  margem_desejada_padrao?: number;
  imposto_medio_sobre_vendas?: number;
  cmv_alvo?: number;
  faturamento_mensal?: number;
}

interface CustoFixo {
  valor_mensal: number;
}

interface HistoricoPreco {
  insumo_id: string;
  preco_anterior: number | null;
  preco_novo: number;
  variacao_percentual: number | null;
  created_at: string;
  insumos?: {
    nome: string;
  };
}

interface BusinessCoachProps {
  vendas: Venda[] | null;
  produtos: Produto[] | null;
  taxasApps: TaxaApp[] | null;
  config: Config | null;
  custosFixos: CustoFixo[] | null;
  historicoPrecos: HistoricoPreco[] | null;
  periodo: 'hoje' | 'semana' | 'mes' | 'ultimos30';
  formatCurrency: (value: number) => string;
}

type CoachStatus = 'success' | 'warning' | 'alert' | 'neutral';

interface CoachMessage {
  status: CoachStatus;
  headline: string;
  detail: string;
  tipo?: string;
  action?: {
    label: string;
    route: string;
  };
  priority: number;
}

interface CoachHistoricoItem {
  id: string;
  tipo: string;
  status: string;
  headline: string;
  detail: string;
  prioridade: number;
  created_at: string;
}

export const BusinessCoach: React.FC<BusinessCoachProps> = ({
  vendas,
  produtos,
  taxasApps,
  config,
  custosFixos,
  historicoPrecos,
  periodo,
  formatCurrency,
}) => {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const [insightsPopoverOpen, setInsightsPopoverOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [lastSavedHeadline, setLastSavedHeadline] = useState<string | null>(null);
  
  const margemMeta = config?.margem_desejada_padrao ?? 30;
  const impostoPercent = config?.imposto_medio_sobre_vendas ?? 10;
  const custoFixoMensal = custosFixos?.reduce((sum, c) => sum + Number(c.valor_mensal), 0) || 0;

  const coachAnalysis = useMemo(() => {
    const messages: CoachMessage[] = [];
    
    if (!vendas || vendas.length === 0) {
      return {
        status: 'neutral' as CoachStatus,
        headline: 'Comece registrando suas primeiras vendas',
        detail: 'Assim que você tiver dados de vendas, vou analisar seu negócio e dar dicas personalizadas para melhorar seus resultados.',
        action: { label: 'Registrar vendas', route: '/vendas' },
      };
    }

    const hoje = new Date();
    const receitaTotal = vendas.reduce((sum, v) => sum + Number(v.valor_total), 0);
    
    // 1. ANÁLISE DE META MENSAL
    if (custoFixoMensal > 0 && (periodo === 'mes' || periodo === 'ultimos30')) {
      const metaMensal = custoFixoMensal / 0.20;
      const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
      const diaAtual = hoje.getDate();
      const diasRestantes = diasNoMes - diaAtual;
      
      const progressoEsperado = (diaAtual / diasNoMes) * 100;
      const progressoReal = (receitaTotal / metaMensal) * 100;
      const faltaParaMeta = metaMensal - receitaTotal;
      const mediaDiariaAtual = diaAtual > 0 ? receitaTotal / diaAtual : 0;
      const mediaNecessaria = diasRestantes > 0 ? faltaParaMeta / diasRestantes : 0;
      
      if (faltaParaMeta <= 0) {
        messages.push({
          status: 'success',
          headline: '🎉 Meta do mês atingida!',
          detail: `Você já faturou ${formatCurrency(receitaTotal)} e ultrapassou sua meta. Continue assim!`,
          priority: 10,
        });
      } else if (progressoReal < progressoEsperado - 15) {
        messages.push({
          status: 'alert',
          headline: 'Atenção: ritmo abaixo do esperado',
          detail: `Para bater a meta, você precisa aumentar para ${formatCurrency(mediaNecessaria)}/dia. Considere fazer uma promoção.`,
          action: { label: 'Ver precificação', route: '/precificacao' },
          priority: 9,
        });
      } else if (progressoReal >= progressoEsperado + 10) {
        messages.push({
          status: 'success',
          headline: 'Ótimo ritmo de vendas!',
          detail: `Com média de ${formatCurrency(mediaDiariaAtual)}/dia, você deve bater a meta antes do fim do mês.`,
          priority: 7,
        });
      }
    }
    
    // 2. ANÁLISE DE MARGEM
    if (produtos && produtos.length > 0) {
      let produtosAbaixoMeta = 0;
      let produtoMaisCritico: { nome: string; margem: number; ajuste: number } | null = null;
      
      produtos.forEach((produto) => {
        const custoInsumos = produto.fichas_tecnicas?.reduce((sum, ft) => {
          return sum + (Number(ft.quantidade) * Number(ft.insumos?.custo_unitario || 0));
        }, 0) || 0;
        
        if (custoInsumos === 0 || produto.preco_venda === 0) return;
        
        const margemAtual = ((produto.preco_venda - custoInsumos) / produto.preco_venda) * 100;
        const diferenca = margemMeta - margemAtual;
        
        if (diferenca > 5) {
          produtosAbaixoMeta++;
          const precoSugerido = custoInsumos / (1 - margemMeta / 100);
          const ajuste = precoSugerido - produto.preco_venda;
          
          if (!produtoMaisCritico || diferenca > (margemMeta - produtoMaisCritico.margem)) {
            produtoMaisCritico = { nome: produto.nome, margem: margemAtual, ajuste };
          }
        }
      });
      
      if (produtosAbaixoMeta > 0 && produtoMaisCritico) {
        messages.push({
          status: 'warning',
          headline: `${produtosAbaixoMeta} produto${produtosAbaixoMeta > 1 ? 's' : ''} com margem baixa`,
          detail: `${produtoMaisCritico.nome} está com ${produtoMaisCritico.margem.toFixed(0)}% de margem. Aumente ${formatCurrency(produtoMaisCritico.ajuste)} para atingir a meta.`,
          action: { label: 'Ajustar preços', route: '/precificacao' },
          priority: 8,
        });
      }
    }
    
    // 3. TENDÊNCIA SEMANAL
    const inicioSemanaAtual = new Date(hoje);
    inicioSemanaAtual.setDate(hoje.getDate() - hoje.getDay());
    
    const inicioSemanaAnterior = new Date(inicioSemanaAtual);
    inicioSemanaAnterior.setDate(inicioSemanaAnterior.getDate() - 7);

    let receitaSemanaAtual = 0;
    let receitaSemanaAnterior = 0;

    vendas.forEach((venda) => {
      const dataVenda = new Date(venda.data_venda + 'T12:00:00');
      
      if (dataVenda >= inicioSemanaAtual) {
        receitaSemanaAtual += Number(venda.valor_total);
      } else if (dataVenda >= inicioSemanaAnterior && dataVenda < inicioSemanaAtual) {
        receitaSemanaAnterior += Number(venda.valor_total);
      }
    });

    if (receitaSemanaAnterior > 0) {
      const variacao = ((receitaSemanaAtual - receitaSemanaAnterior) / receitaSemanaAnterior) * 100;
      
      if (variacao < -20) {
        messages.push({
          status: 'alert',
          headline: 'Vendas em queda esta semana',
          detail: `Queda de ${Math.abs(variacao).toFixed(0)}% vs semana passada. Hora de impulsionar as vendas!`,
          action: { label: 'Criar promoção', route: '/precificacao' },
          priority: 8,
        });
      } else if (variacao > 20) {
        messages.push({
          status: 'success',
          headline: 'Semana excelente! 📈',
          detail: `Crescimento de ${variacao.toFixed(0)}% em relação à semana passada. Você está arrasando!`,
          priority: 6,
        });
      }
    }
    
    // 4. ANÁLISE DE CANAL
    const lucroPorCanal: Record<string, { lucro: number; receita: number; vendas: number }> = {};
    
    vendas.forEach((venda) => {
      const canal = venda.canal || 'Balcão';
      const canalLower = canal.toLowerCase();
      const custoUnitario = Number(venda.custo_insumos) || 0;
      const precoVenda = Number(venda.produto_preco_venda) || 0;
      const valorTotal = Number(venda.valor_total) || 0;
      
      let unidadesReais = Number(venda.quantidade) || 1;
      if (precoVenda > 0) {
        unidadesReais = valorTotal / precoVenda;
      }
      
      const taxaApp = taxasApps?.find(t => 
        t.nome_app && (canalLower.includes(t.nome_app.toLowerCase()) || 
        t.nome_app.toLowerCase().includes(canalLower))
      );
      const taxaValor = taxaApp ? (valorTotal * Number(taxaApp.taxa_percentual) / 100) : 0;
      
      const lucroVenda = valorTotal - (custoUnitario * unidadesReais) - taxaValor;
      
      if (!lucroPorCanal[canal]) {
        lucroPorCanal[canal] = { lucro: 0, receita: 0, vendas: 0 };
      }
      lucroPorCanal[canal].lucro += lucroVenda;
      lucroPorCanal[canal].receita += valorTotal;
      lucroPorCanal[canal].vendas += 1;
    });

    const canais = Object.entries(lucroPorCanal)
      .filter(([_, d]) => d.receita > 0)
      .map(([canal, dados]) => ({
        canal,
        ...dados,
        margem: dados.receita > 0 ? (dados.lucro / dados.receita) * 100 : 0,
      }))
      .sort((a, b) => b.margem - a.margem);

    if (canais.length >= 2) {
      const melhor = canais[0];
      const pior = canais[canais.length - 1];
      const diferencaMargem = melhor.margem - pior.margem;
      
      if (diferencaMargem > 15 && pior.vendas >= 3) {
        messages.push({
          status: 'warning',
          headline: `${pior.canal} está corroendo sua margem`,
          detail: `A margem no ${pior.canal} é ${pior.margem.toFixed(0)}%, enquanto no ${melhor.canal} é ${melhor.margem.toFixed(0)}%. Considere ajustar preços por canal.`,
          action: { label: 'Ver configurações', route: '/configuracoes' },
          priority: 7,
        });
      }
    }
    
    // 5. PRODUTO PROMO (oportunidade)
    if (produtos && produtos.length > 0 && messages.filter(m => m.status === 'success').length < 2) {
      const produtosPromo = produtos
        .map((produto) => {
          const custoInsumos = produto.fichas_tecnicas?.reduce((sum, ft) => {
            return sum + (Number(ft.quantidade) * Number(ft.insumos?.custo_unitario || 0));
          }, 0) || 0;
          
          if (custoInsumos === 0) return null;
          
          const margem = produto.preco_venda > 0 
            ? ((produto.preco_venda - custoInsumos) / produto.preco_venda) * 100 
            : 0;
          
          const vendasProduto = vendas.filter(v => v.produto_id === produto.id).length;
          
          return { ...produto, margem, vendasProduto };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null && p.margem >= 40 && p.vendasProduto <= 2);
      
      if (produtosPromo.length > 0) {
        const melhor = produtosPromo.sort((a, b) => b.margem - a.margem)[0];
        messages.push({
          status: 'neutral',
          headline: `💡 Dica: promova "${melhor.nome}"`,
          detail: `Com ${melhor.margem.toFixed(0)}% de margem, você pode dar desconto e ainda lucrar bem.`,
          action: { label: 'Ver produto', route: '/precificacao' },
          priority: 4,
        });
      }
    }
    
    // 6. INSUMOS COM CUSTO SUBINDO (histórico de preços)
    if (historicoPrecos && historicoPrecos.length > 0) {
      // Agrupar por insumo e calcular variação total recente
      const variacaoPorInsumo: Record<string, { 
        nome: string; 
        variacaoTotal: number; 
        alteracoes: number;
        ultimoPreco: number;
      }> = {};
      
      // Filtrar apenas últimos 30 dias
      const trintaDiasAtras = new Date();
      trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
      
      historicoPrecos
        .filter(h => new Date(h.created_at) >= trintaDiasAtras && h.variacao_percentual && h.variacao_percentual > 0)
        .forEach((h) => {
          const insumoId = h.insumo_id;
          const nomeInsumo = h.insumos?.nome || 'Insumo';
          
          if (!variacaoPorInsumo[insumoId]) {
            variacaoPorInsumo[insumoId] = { 
              nome: nomeInsumo, 
              variacaoTotal: 0, 
              alteracoes: 0,
              ultimoPreco: h.preco_novo,
            };
          }
          
          variacaoPorInsumo[insumoId].variacaoTotal += Number(h.variacao_percentual);
          variacaoPorInsumo[insumoId].alteracoes += 1;
          variacaoPorInsumo[insumoId].ultimoPreco = h.preco_novo;
        });
      
      // Encontrar insumo com maior aumento
      const insumosSubindo = Object.entries(variacaoPorInsumo)
        .filter(([_, dados]) => dados.variacaoTotal >= 15) // Aumento de 15% ou mais
        .sort((a, b) => b[1].variacaoTotal - a[1].variacaoTotal);
      
      if (insumosSubindo.length > 0) {
        const [_, piorInsumo] = insumosSubindo[0];
        const totalInsumosSubindo = insumosSubindo.length;
        
        messages.push({
          status: 'alert',
          headline: `🔥 ${piorInsumo.nome} subiu ${piorInsumo.variacaoTotal.toFixed(0)}%`,
          detail: totalInsumosSubindo > 1 
            ? `Mais ${totalInsumosSubindo - 1} insumo${totalInsumosSubindo > 2 ? 's' : ''} também subiram. Revise preços dos produtos afetados.`
            : `O custo atual é ${formatCurrency(piorInsumo.ultimoPreco)}. Considere reajustar os produtos que usam este insumo.`,
          action: { label: 'Ver insumos', route: '/insumos' },
          priority: 8,
        });
      }
    }

    // Ordenar por prioridade e pegar a mensagem mais importante
    if (messages.length === 0) {
      return {
        status: 'success' as CoachStatus,
        headline: 'Tudo certo por aqui! ✨',
        detail: `Seu negócio está saudável com ${formatCurrency(receitaTotal)} de faturamento no período. Continue assim!`,
      };
    }
    
    const sorted = messages.sort((a, b) => b.priority - a.priority);
    const main = sorted[0];
    
    // Se tiver mais de uma mensagem, adicionar contexto
    const outros = sorted.slice(1).filter(m => m.priority >= 6);
    if (outros.length > 0) {
      return {
        ...main,
        secondaryCount: outros.length,
        secondaryMessages: outros,
      };
    }
    
    return main;
  }, [vendas, produtos, taxasApps, config, custosFixos, historicoPrecos, periodo, margemMeta, custoFixoMensal, formatCurrency]);

  // Query para buscar histórico
  const { data: coachHistorico } = useQuery({
    queryKey: ['coach-historico', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coach_historico')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as CoachHistoricoItem[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Mutation para salvar insight
  const saveMutation = useMutation({
    mutationFn: async (insight: { tipo: string; status: string; headline: string; detail: string; prioridade: number }) => {
      if (!usuario?.empresa_id) throw new Error('Empresa não encontrada');
      
      const { error } = await supabase
        .from('coach_historico')
        .insert({
          empresa_id: usuario.empresa_id,
          ...insight,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-historico'] });
    },
  });

  // Mutation para deletar histórico
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('coach_historico')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-historico'] });
    },
  });

  // Salvar insight quando mudar (apenas 1x por headline única)
  useEffect(() => {
    if (!coachAnalysis || !usuario?.empresa_id) return;
    if (coachAnalysis.headline === lastSavedHeadline) return;
    if (coachAnalysis.headline === 'Comece registrando suas primeiras vendas') return;
    
    // Determinar tipo baseado no conteúdo
    let tipo = 'geral';
    if (coachAnalysis.headline.includes('Meta')) tipo = 'meta_mensal';
    else if (coachAnalysis.headline.includes('margem')) tipo = 'margem';
    else if (coachAnalysis.headline.includes('Vendas') || coachAnalysis.headline.includes('ritmo')) tipo = 'tendencia';
    else if (coachAnalysis.headline.includes('canal') || coachAnalysis.headline.includes('corroendo')) tipo = 'canal';
    else if (coachAnalysis.headline.includes('promova') || coachAnalysis.headline.includes('Dica')) tipo = 'oportunidade';
    else if (coachAnalysis.headline.includes('subiu') || coachAnalysis.headline.includes('insumo')) tipo = 'insumos';
    
    saveMutation.mutate({
      tipo,
      status: coachAnalysis.status,
      headline: coachAnalysis.headline,
      detail: coachAnalysis.detail,
      prioridade: 'priority' in coachAnalysis ? (coachAnalysis as any).priority : 5,
    });
    
    setLastSavedHeadline(coachAnalysis.headline);
  }, [coachAnalysis?.headline, usuario?.empresa_id]);

  const getStatusStyles = (status: CoachStatus | string) => {
    switch (status) {
      case 'success':
        return {
          bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
          icon: CheckCircle,
          iconColor: 'text-green-600 dark:text-green-400',
          gradient: 'from-green-500/10 via-transparent to-emerald-500/10',
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
          icon: Target,
          iconColor: 'text-amber-600 dark:text-amber-400',
          gradient: 'from-amber-500/10 via-transparent to-orange-500/10',
        };
      case 'alert':
        return {
          bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
          icon: AlertCircle,
          iconColor: 'text-red-600 dark:text-red-400',
          gradient: 'from-red-500/10 via-transparent to-rose-500/10',
        };
      default:
        return {
          bg: 'bg-primary/5 border-primary/20',
          icon: GraduationCap,
          iconColor: 'text-primary',
          gradient: 'from-primary/10 via-transparent to-accent/10',
        };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <Target className="h-4 w-4 text-amber-500" />;
      case 'alert': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <GraduationCap className="h-4 w-4 text-primary" />;
    }
  };

  const styles = getStatusStyles(coachAnalysis.status);
  const StatusIcon = styles.icon;

  return (
    <Card className={`animate-fade-in border-2 ${styles.bg} bg-gradient-to-br ${styles.gradient} overflow-hidden`}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
            coachAnalysis.status === 'success' ? 'bg-green-100 dark:bg-green-900/50' :
            coachAnalysis.status === 'warning' ? 'bg-amber-100 dark:bg-amber-900/50' :
            coachAnalysis.status === 'alert' ? 'bg-red-100 dark:bg-red-900/50' :
            'bg-primary/10'
          }`}>
            <StatusIcon className={`h-6 w-6 ${styles.iconColor}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge 
                variant="outline" 
                className="bg-background/80 text-xs font-medium"
              >
                <GraduationCap className="h-3 w-3 mr-1" />
                Coach do Negócio
              </Badge>
              {'secondaryCount' in coachAnalysis && coachAnalysis.secondaryCount > 0 && (
                <Popover open={insightsPopoverOpen} onOpenChange={setInsightsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="focus:outline-none">
                      <Badge 
                        variant="secondary" 
                        className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                      >
                        +{coachAnalysis.secondaryCount} {coachAnalysis.secondaryCount === 1 ? 'insight' : 'insights'}
                      </Badge>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0 z-50" align="start">
                    <div className="p-3 border-b bg-background">
                      <h4 className="font-medium text-sm">Outros Insights</h4>
                      <p className="text-xs text-muted-foreground">Clique para navegar</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2 space-y-2">
                      {'secondaryMessages' in coachAnalysis && (coachAnalysis.secondaryMessages as CoachMessage[]).map((msg, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                            msg.status === 'success' ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' :
                            msg.status === 'warning' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' :
                            msg.status === 'alert' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' :
                            'bg-muted/30 border-border'
                          }`}
                          onClick={() => {
                            if (msg.action) {
                              navigate(msg.action.route);
                              setInsightsPopoverOpen(false);
                            }
                          }}
                        >
                          <div className="flex items-start gap-2">
                            {getStatusIcon(msg.status)}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm leading-tight">
                                {msg.headline}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {msg.detail}
                              </p>
                              {msg.action && (
                                <p className="text-xs text-primary mt-1 flex items-center">
                                  {msg.action.label}
                                  <ChevronRight className="h-3 w-3 ml-0.5" />
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              
              {/* Botão de Histórico */}
              <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <History className="h-3 w-3 mr-1" />
                    Histórico
                    {coachHistorico && coachHistorico.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                        {coachHistorico.length}
                      </Badge>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Histórico do Coach
                    </DialogTitle>
                  </DialogHeader>
                  <ScrollArea className="h-[60vh] pr-4">
                    {coachHistorico && coachHistorico.length > 0 ? (
                      <div className="space-y-3">
                        {coachHistorico.map((item) => (
                          <div
                            key={item.id}
                            className={`p-3 rounded-lg border ${
                              item.status === 'success' ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' :
                              item.status === 'warning' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800' :
                              item.status === 'alert' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' :
                              'bg-muted/50 border-border'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                {getStatusIcon(item.status)}
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-sm leading-tight truncate">
                                    {item.headline}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {item.detail}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-2">
                                    {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => deleteMutation.mutate(item.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhum insight registrado ainda.</p>
                        <p className="text-xs mt-1">Os insights serão salvos automaticamente.</p>
                      </div>
                    )}
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
            
            <h3 className="font-semibold text-lg text-foreground leading-tight">
              {coachAnalysis.headline}
            </h3>
            
            <p className="text-sm text-muted-foreground mt-1">
              {coachAnalysis.detail}
            </p>
            
            {coachAnalysis.action && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 h-8 px-0 text-primary hover:text-primary/80 hover:bg-transparent font-medium"
                onClick={() => navigate(coachAnalysis.action!.route)}
              >
                {coachAnalysis.action.label}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
          
          <div className="shrink-0 hidden sm:block">
            {coachAnalysis.status === 'success' && <TrendingUp className="h-5 w-5 text-green-500" />}
            {coachAnalysis.status === 'warning' && <Target className="h-5 w-5 text-amber-500" />}
            {coachAnalysis.status === 'alert' && <TrendingDown className="h-5 w-5 text-red-500" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BusinessCoach;
