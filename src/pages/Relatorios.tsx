import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Package,
  Smartphone,
  Store,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  categoria: string | null;
  fichas_tecnicas?: {
    id: string;
    quantidade: number;
    insumos: {
      id: string;
      nome: string;
      custo_unitario: number;
    };
  }[];
}

interface Config {
  margem_desejada_padrao: number;
  faturamento_mensal: number;
  imposto_medio_sobre_vendas: number;
}

interface CustoFixo {
  id: string;
  nome: string;
  valor_mensal: number;
}

interface TaxaApp {
  id: string;
  nome_app: string;
  taxa_percentual: number;
  ativo: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

const Relatorios = () => {
  const { usuario } = useAuth();
  const isMobile = useIsMobile();
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [ordenacao, setOrdenacao] = useState<string>('margem-desc');

  // Buscar produtos com ficha técnica
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ['produtos-relatorio', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produtos')
        .select(`
          id,
          nome,
          preco_venda,
          categoria,
          fichas_tecnicas (
            id,
            quantidade,
            insumos (
              id,
              nome,
              custo_unitario
            )
          )
        `)
        .eq('empresa_id', usuario?.empresa_id)
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data as Produto[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar configurações
  const { data: config } = useQuery({
    queryKey: ['config-relatorio', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('margem_desejada_padrao, faturamento_mensal, imposto_medio_sobre_vendas')
        .eq('empresa_id', usuario?.empresa_id)
        .single();
      
      if (error) throw error;
      return data as Config;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar custos fixos
  const { data: custosFixos } = useQuery({
    queryKey: ['custos-fixos-relatorio', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custos_fixos')
        .select('id, nome, valor_mensal')
        .eq('empresa_id', usuario?.empresa_id);
      
      if (error) throw error;
      return data as CustoFixo[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar taxas de apps
  const { data: taxasApps } = useQuery({
    queryKey: ['taxas-apps-relatorio', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taxas_apps')
        .select('id, nome_app, taxa_percentual, ativo')
        .eq('empresa_id', usuario?.empresa_id)
        .eq('ativo', true);
      
      if (error) throw error;
      return data as TaxaApp[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Calcular percentuais de custos
  const custosPercentuais = useMemo(() => {
    const faturamento = config?.faturamento_mensal || 0;
    const totalCustosFixos = custosFixos?.reduce((acc, cf) => acc + cf.valor_mensal, 0) || 0;
    
    const percCustoFixo = faturamento > 0 ? (totalCustosFixos / faturamento) * 100 : 0;
    const percImposto = config?.imposto_medio_sobre_vendas || 0;
    const margemDesejada = config?.margem_desejada_padrao || 30;
    
    return { percCustoFixo, percImposto, margemDesejada };
  }, [config, custosFixos]);

  // Calcular métricas por produto e canal
  const analise = useMemo(() => {
    if (!produtos) return null;

    const produtosComFicha = produtos.filter(p => p.fichas_tecnicas && p.fichas_tecnicas.length > 0);
    
    const produtosAnalisados = produtosComFicha.map(produto => {
      const custoInsumos = produto.fichas_tecnicas?.reduce((acc, ft) => {
        return acc + (ft.quantidade * ft.insumos.custo_unitario);
      }, 0) || 0;
      
      const precoVenda = produto.preco_venda || 0;
      const { percCustoFixo, percImposto } = custosPercentuais;
      
      // Margem no balcão (sem taxa de app)
      const custoFixoValor = precoVenda * (percCustoFixo / 100);
      const impostoValor = precoVenda * (percImposto / 100);
      const lucroBalcao = precoVenda - custoInsumos - custoFixoValor - impostoValor;
      const margemBalcao = precoVenda > 0 ? (lucroBalcao / precoVenda) * 100 : 0;
      
      // Margem por app
      const margensPorApp = taxasApps?.map(app => {
        const taxaAppValor = precoVenda * (app.taxa_percentual / 100);
        const lucroApp = precoVenda - custoInsumos - custoFixoValor - impostoValor - taxaAppValor;
        const margemApp = precoVenda > 0 ? (lucroApp / precoVenda) * 100 : 0;
        
        return {
          appId: app.id,
          appNome: app.nome_app,
          taxa: app.taxa_percentual,
          lucro: lucroApp,
          margem: margemApp,
        };
      }) || [];
      
      // CMV
      const cmv = precoVenda > 0 ? (custoInsumos / precoVenda) * 100 : 0;
      
      return {
        id: produto.id,
        nome: produto.nome,
        categoria: produto.categoria || 'Sem categoria',
        precoVenda,
        custoInsumos,
        cmv,
        lucroBalcao,
        margemBalcao,
        margensPorApp,
        statusMargem: margemBalcao >= custosPercentuais.margemDesejada ? 'ideal' : 
                      margemBalcao > 0 ? 'baixa' : 'negativa',
      };
    });

    // Ordenar produtos
    const produtosOrdenados = [...produtosAnalisados].sort((a, b) => {
      switch (ordenacao) {
        case 'margem-desc': return b.margemBalcao - a.margemBalcao;
        case 'margem-asc': return a.margemBalcao - b.margemBalcao;
        case 'lucro-desc': return b.lucroBalcao - a.lucroBalcao;
        case 'lucro-asc': return a.lucroBalcao - b.lucroBalcao;
        case 'nome': return a.nome.localeCompare(b.nome);
        default: return 0;
      }
    });

    // Filtrar por categoria
    const produtosFiltrados = filtroCategoria === 'todas' 
      ? produtosOrdenados 
      : produtosOrdenados.filter(p => p.categoria === filtroCategoria);

    // Estatísticas gerais
    const totalProdutos = produtosFiltrados.length;
    const margemMedia = produtosFiltrados.reduce((acc, p) => acc + p.margemBalcao, 0) / totalProdutos || 0;
    const lucroMedio = produtosFiltrados.reduce((acc, p) => acc + p.lucroBalcao, 0) / totalProdutos || 0;
    const produtosIdeais = produtosFiltrados.filter(p => p.statusMargem === 'ideal').length;
    const produtosBaixos = produtosFiltrados.filter(p => p.statusMargem === 'baixa').length;
    const produtosNegativos = produtosFiltrados.filter(p => p.statusMargem === 'negativa').length;

    // Dados para gráfico de margens por produto
    const dadosMargensProdutos = produtosFiltrados.slice(0, 15).map(p => ({
      nome: p.nome.length > 15 ? p.nome.substring(0, 15) + '...' : p.nome,
      nomeCompleto: p.nome,
      margem: parseFloat(p.margemBalcao.toFixed(1)),
      lucro: parseFloat(p.lucroBalcao.toFixed(2)),
      meta: custosPercentuais.margemDesejada,
    }));

    // Dados para gráfico de comparação por canal
    const dadosComparacaoCanais = produtosFiltrados.slice(0, 10).map(p => {
      const dados: any = {
        nome: p.nome.length > 12 ? p.nome.substring(0, 12) + '...' : p.nome,
        nomeCompleto: p.nome,
        'Balcão': parseFloat(p.margemBalcao.toFixed(1)),
      };
      
      p.margensPorApp.forEach(app => {
        dados[app.appNome] = parseFloat(app.margem.toFixed(1));
      });
      
      return dados;
    });

    // Dados para gráfico de pizza - distribuição por status
    const dadosStatusPizza = [
      { name: 'Ideal', value: produtosIdeais, color: '#10b981' },
      { name: 'Baixa', value: produtosBaixos, color: '#f59e0b' },
      { name: 'Negativa', value: produtosNegativos, color: '#ef4444' },
    ].filter(d => d.value > 0);

    // Dados para gráfico de pizza - distribuição por categoria
    const categorias = [...new Set(produtosFiltrados.map(p => p.categoria))];
    const dadosCategoriaPizza = categorias.map((cat, i) => {
      const produtosCat = produtosFiltrados.filter(p => p.categoria === cat);
      const margemMediaCat = produtosCat.reduce((acc, p) => acc + p.margemBalcao, 0) / produtosCat.length;
      return {
        name: cat,
        value: produtosCat.length,
        margemMedia: margemMediaCat,
        color: COLORS[i % COLORS.length],
      };
    });

    // Resumo por canal
    const resumoPorCanal = [
      {
        canal: 'Balcão',
        icone: Store,
        taxa: 0,
        margemMedia: margemMedia,
        lucroMedio: lucroMedio,
      },
      ...(taxasApps?.map(app => {
        const margemMediaApp = produtosFiltrados.reduce((acc, p) => {
          const margemApp = p.margensPorApp.find(m => m.appId === app.id)?.margem || 0;
          return acc + margemApp;
        }, 0) / totalProdutos || 0;
        
        const lucroMedioApp = produtosFiltrados.reduce((acc, p) => {
          const lucroApp = p.margensPorApp.find(m => m.appId === app.id)?.lucro || 0;
          return acc + lucroApp;
        }, 0) / totalProdutos || 0;
        
        return {
          canal: app.nome_app,
          icone: Smartphone,
          taxa: app.taxa_percentual,
          margemMedia: margemMediaApp,
          lucroMedio: lucroMedioApp,
        };
      }) || []),
    ];

    return {
      produtos: produtosFiltrados,
      estatisticas: {
        totalProdutos,
        margemMedia,
        lucroMedio,
        produtosIdeais,
        produtosBaixos,
        produtosNegativos,
      },
      graficos: {
        margensProdutos: dadosMargensProdutos,
        comparacaoCanais: dadosComparacaoCanais,
        statusPizza: dadosStatusPizza,
        categoriaPizza: dadosCategoriaPizza,
      },
      resumoPorCanal,
      categorias,
    };
  }, [produtos, custosPercentuais, taxasApps, filtroCategoria, ordenacao]);

  const categorias = useMemo(() => {
    if (!produtos) return [];
    const cats = new Set(produtos.map(p => p.categoria).filter(Boolean));
    return Array.from(cats) as string[];
  }, [produtos]);

  if (loadingProdutos) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (!analise || analise.produtos.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Relatório de Rentabilidade</h1>
          <p className="text-muted-foreground">Análise de margens e lucros por produto e canal</p>
        </div>
        <Card className="p-8 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium mb-2">Nenhum produto com ficha técnica</h3>
          <p className="text-muted-foreground">
            Configure as fichas técnicas dos produtos para ver a análise de rentabilidade.
          </p>
        </Card>
      </div>
    );
  }

  const canaisKeys = ['Balcão', ...(taxasApps?.map(a => a.nome_app) || [])];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Relatório de Rentabilidade</h1>
          <p className="text-muted-foreground">
            Análise de margens e lucros por produto e canal
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {categorias.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ordenacao} onValueChange={setOrdenacao}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="margem-desc">Maior Margem</SelectItem>
              <SelectItem value="margem-asc">Menor Margem</SelectItem>
              <SelectItem value="lucro-desc">Maior Lucro</SelectItem>
              <SelectItem value="lucro-asc">Menor Lucro</SelectItem>
              <SelectItem value="nome">Nome A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10">
                <Percent className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margem Média</p>
                <p className="text-lg md:text-xl font-bold">{formatPercent(analise.estatisticas.margemMedia)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-success/10">
                <DollarSign className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro Médio</p>
                <p className="text-lg md:text-xl font-bold">{formatCurrency(analise.estatisticas.lucroMedio)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Produtos Ideais</p>
                <p className="text-lg md:text-xl font-bold text-success">{analise.estatisticas.produtosIdeais}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atenção</p>
                <p className="text-lg md:text-xl font-bold text-destructive">
                  {analise.estatisticas.produtosBaixos + analise.estatisticas.produtosNegativos}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo por Canal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Rentabilidade por Canal de Venda
          </CardTitle>
          <CardDescription>
            Compare as margens médias entre venda direta e apps de delivery
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {analise.resumoPorCanal.map((canal, idx) => {
              const Icon = canal.icone;
              const isBalcao = canal.taxa === 0;
              const diferenca = canal.margemMedia - analise.estatisticas.margemMedia;
              
              return (
                <div 
                  key={idx}
                  className={`p-4 rounded-lg border-2 ${isBalcao ? 'bg-primary/5 border-primary/30' : 'bg-purple-500/5 border-purple-500/30'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`h-5 w-5 ${isBalcao ? 'text-primary' : 'text-purple-500'}`} />
                    <span className="font-medium text-sm">{canal.canal}</span>
                    {canal.taxa > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        -{canal.taxa}%
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{formatPercent(canal.margemMedia)}</span>
                      {!isBalcao && diferenca !== 0 && (
                        <span className={`text-xs flex items-center ${diferenca < 0 ? 'text-destructive' : 'text-success'}`}>
                          {diferenca < 0 ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                          {formatPercent(Math.abs(diferenca))}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Lucro: {formatCurrency(canal.lucroMedio)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <Tabs defaultValue="barras" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="barras">Margens</TabsTrigger>
          <TabsTrigger value="canais">Por Canal</TabsTrigger>
          <TabsTrigger value="pizza">Distribuição</TabsTrigger>
        </TabsList>

        {/* Gráfico de Barras - Margem por Produto */}
        <TabsContent value="barras">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 15 Produtos - Margem vs Meta</CardTitle>
              <CardDescription>
                Linha pontilhada = meta de {formatPercent(custosPercentuais.margemDesejada)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={analise.graficos.margensProdutos}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: isMobile ? 80 : 120, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
                    <YAxis 
                      type="category" 
                      dataKey="nome" 
                      tick={{ fontSize: 11 }}
                      width={isMobile ? 70 : 110}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === 'margem') return [`${value.toFixed(1)}%`, 'Margem'];
                        if (name === 'meta') return [`${value}%`, 'Meta'];
                        return [value, name];
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.nomeCompleto;
                        }
                        return label;
                      }}
                    />
                    <Bar 
                      dataKey="margem" 
                      fill="hsl(var(--primary))"
                      radius={[0, 4, 4, 0]}
                    >
                      {analise.graficos.margensProdutos.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`}
                          fill={entry.margem >= custosPercentuais.margemDesejada 
                            ? 'hsl(var(--success))' 
                            : entry.margem > 0 
                              ? 'hsl(var(--warning))' 
                              : 'hsl(var(--destructive))'
                          }
                        />
                      ))}
                    </Bar>
                    <Line 
                      type="monotone" 
                      dataKey="meta" 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gráfico de Barras Agrupadas - Comparação por Canal */}
        <TabsContent value="canais">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparativo de Margem por Canal</CardTitle>
              <CardDescription>
                Veja como a margem varia entre venda direta e delivery
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analise.graficos.comparacaoCanais}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="nome" 
                      tick={{ fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tickFormatter={(v) => `${v}%`} />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Margem']}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return payload[0].payload.nomeCompleto;
                        }
                        return label;
                      }}
                    />
                    <Legend />
                    {canaisKeys.map((canal, idx) => (
                      <Bar 
                        key={canal}
                        dataKey={canal} 
                        fill={COLORS[idx % COLORS.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gráficos de Pizza */}
        <TabsContent value="pizza">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Pizza - Status das Margens */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Status das Margens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analise.graficos.statusPizza}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {analise.graficos.statusPizza.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-2">
                  {analise.graficos.statusPizza.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pizza - Por Categoria */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Produtos por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analise.graficos.categoriaPizza}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => 
                          name.length > 10 
                            ? `${name.substring(0, 10)}... ${(percent * 100).toFixed(0)}%`
                            : `${name} ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {analise.graficos.categoriaPizza.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string, props: any) => [
                          `${value} produtos (Margem média: ${formatPercent(props.payload.margemMedia)})`,
                          props.payload.name
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Tabela detalhada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento por Produto</CardTitle>
          <CardDescription>
            {analise.produtos.length} produtos analisados
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[400px]">
            <div className="divide-y">
              {analise.produtos.map(produto => (
                <div key={produto.id} className="p-3 sm:p-4 hover:bg-muted/50">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-medium truncate">{produto.nome}</h3>
                        <Badge 
                          variant={
                            produto.statusMargem === 'ideal' ? 'default' : 
                            produto.statusMargem === 'baixa' ? 'secondary' : 'destructive'
                          }
                          className={`text-[10px] ${produto.statusMargem === 'ideal' ? 'bg-success' : ''}`}
                        >
                          {produto.statusMargem === 'ideal' && <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                          {produto.statusMargem === 'baixa' && <Minus className="h-3 w-3 mr-0.5" />}
                          {produto.statusMargem === 'negativa' && <TrendingDown className="h-3 w-3 mr-0.5" />}
                          {formatPercent(produto.margemBalcao)}
                        </Badge>
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">
                        {formatCurrency(produto.precoVenda)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="bg-muted/50 rounded p-1.5 text-center">
                        <p className="text-muted-foreground">Custo</p>
                        <p className="font-medium">{formatCurrency(produto.custoInsumos)}</p>
                      </div>
                      <div className="bg-muted/50 rounded p-1.5 text-center">
                        <p className="text-muted-foreground">CMV</p>
                        <p className="font-medium">{formatPercent(produto.cmv)}</p>
                      </div>
                      <div className="bg-primary/10 rounded p-1.5 text-center">
                        <p className="text-muted-foreground">Balcão</p>
                        <p className="font-medium text-primary">{formatCurrency(produto.lucroBalcao)}</p>
                      </div>
                      {produto.margensPorApp[0] && (
                        <div className="bg-purple-500/10 rounded p-1.5 text-center">
                          <p className="text-muted-foreground truncate">{produto.margensPorApp[0].appNome}</p>
                          <p className="font-medium text-purple-600 dark:text-purple-400">
                            {formatCurrency(produto.margensPorApp[0].lucro)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default Relatorios;
