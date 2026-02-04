import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePrecosCanais } from '@/hooks/usePrecosCanais';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatCurrencyBRL } from '@/lib/format';
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
} from 'recharts';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Package,
  Smartphone,
  Store,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface MargensRelatorioProps {
  onBack: () => void;
}

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

const formatCurrency = formatCurrencyBRL;
const formatPercent = (value: number) => `${value.toFixed(1)}%`;
const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

export const MargensRelatorio: React.FC<MargensRelatorioProps> = ({ onBack }) => {
  const { usuario } = useAuth();
  const isMobile = useIsMobile();
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [ordenacao, setOrdenacao] = useState<string>('margem-desc');

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

  const { canaisConfigurados } = usePrecosCanais();

  const custosPercentuais = useMemo(() => {
    const faturamento = config?.faturamento_mensal || 0;
    const totalCustosFixos = custosFixos?.reduce((acc, cf) => acc + cf.valor_mensal, 0) || 0;
    
    const percCustoFixo = faturamento > 0 ? (totalCustosFixos / faturamento) * 100 : 0;
    const percImposto = config?.imposto_medio_sobre_vendas || 0;
    const margemDesejada = config?.margem_desejada_padrao || 30;
    
    return { percCustoFixo, percImposto, margemDesejada };
  }, [config, custosFixos]);

  const analise = useMemo(() => {
    if (!produtos) return null;

    const produtosComFicha = produtos.filter(p => p.fichas_tecnicas && p.fichas_tecnicas.length > 0);
    
    const produtosAnalisados = produtosComFicha.map(produto => {
      const custoInsumos = produto.fichas_tecnicas?.reduce((acc, ft) => {
        return acc + (ft.quantidade * ft.insumos.custo_unitario);
      }, 0) || 0;
      
      const precoVenda = produto.preco_venda || 0;
      const { percCustoFixo, percImposto } = custosPercentuais;
      
      const custoFixoValor = precoVenda * (percCustoFixo / 100);
      const impostoValor = precoVenda * (percImposto / 100);
      const lucroBalcao = precoVenda - custoInsumos - custoFixoValor - impostoValor;
      const margemBalcao = precoVenda > 0 ? (lucroBalcao / precoVenda) * 100 : 0;
      
      const margensPorCanal = canaisConfigurados?.map(canal => {
        const taxaCanalValor = precoVenda * (canal.taxa / 100);
        const lucroCanal = precoVenda - custoInsumos - custoFixoValor - impostoValor - taxaCanalValor;
        const margemCanal = precoVenda > 0 ? (lucroCanal / precoVenda) * 100 : 0;
        
        return {
          canalId: canal.id,
          canalNome: canal.nome,
          taxa: canal.taxa,
          lucro: lucroCanal,
          margem: margemCanal,
        };
      }) || [];
      
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
        margensPorCanal,
        statusMargem: margemBalcao >= custosPercentuais.margemDesejada ? 'ideal' : 
                      margemBalcao > 0 ? 'baixa' : 'negativa',
      };
    });

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

    const produtosFiltrados = filtroCategoria === 'todas' 
      ? produtosOrdenados 
      : produtosOrdenados.filter(p => p.categoria === filtroCategoria);

    const totalProdutos = produtosFiltrados.length;
    const margemMedia = produtosFiltrados.reduce((acc, p) => acc + p.margemBalcao, 0) / totalProdutos || 0;
    const lucroMedio = produtosFiltrados.reduce((acc, p) => acc + p.lucroBalcao, 0) / totalProdutos || 0;
    const produtosIdeais = produtosFiltrados.filter(p => p.statusMargem === 'ideal').length;
    const produtosBaixos = produtosFiltrados.filter(p => p.statusMargem === 'baixa').length;
    const produtosNegativos = produtosFiltrados.filter(p => p.statusMargem === 'negativa').length;

    const dadosMargensProdutos = produtosFiltrados.slice(0, 15).map(p => ({
      nome: p.nome.length > 15 ? p.nome.substring(0, 15) + '...' : p.nome,
      nomeCompleto: p.nome,
      margem: parseFloat(p.margemBalcao.toFixed(1)),
      lucro: parseFloat(p.lucroBalcao.toFixed(2)),
      meta: custosPercentuais.margemDesejada,
    }));

    const dadosComparacaoCanais = produtosFiltrados.slice(0, 10).map(p => {
      const dados: Record<string, unknown> = {
        nome: p.nome.length > 12 ? p.nome.substring(0, 12) + '...' : p.nome,
        nomeCompleto: p.nome,
        'Balcão': parseFloat(p.margemBalcao.toFixed(1)),
      };
      
      p.margensPorCanal.forEach(canal => {
        dados[canal.canalNome] = parseFloat(canal.margem.toFixed(1));
      });
      
      return dados;
    });

    const dadosStatusPizza = [
      { name: 'Ideal', value: produtosIdeais, color: '#10b981' },
      { name: 'Baixa', value: produtosBaixos, color: '#f59e0b' },
      { name: 'Negativa', value: produtosNegativos, color: '#ef4444' },
    ].filter(d => d.value > 0);

    const categorias = [...new Set(produtosFiltrados.map(p => p.categoria))];

    const resumoPorCanal = [
      {
        canal: 'Balcão',
        icone: Store,
        taxa: 0,
        margemMedia: margemMedia,
        lucroMedio: lucroMedio,
      },
      ...(canaisConfigurados?.filter(c => !c.isBalcao).map(canal => {
        const margemMediaCanal = produtosFiltrados.reduce((acc, p) => {
          const margemCanal = p.margensPorCanal.find(m => m.canalId === canal.id)?.margem || 0;
          return acc + margemCanal;
        }, 0) / totalProdutos || 0;
        
        const lucroMedioCanal = produtosFiltrados.reduce((acc, p) => {
          const lucroCanal = p.margensPorCanal.find(m => m.canalId === canal.id)?.lucro || 0;
          return acc + lucroCanal;
        }, 0) / totalProdutos || 0;
        
        return {
          canal: canal.nome,
          icone: Smartphone,
          taxa: canal.taxa,
          margemMedia: margemMediaCanal,
          lucroMedio: lucroMedioCanal,
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
      },
      resumoPorCanal,
      categorias,
    };
  }, [produtos, custosPercentuais, canaisConfigurados, filtroCategoria, ordenacao]);

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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Análise de Margens</h1>
            <p className="text-muted-foreground">Análise de margens e lucros por produto e canal</p>
          </div>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Análise de Margens e Precificação</h1>
            <p className="text-muted-foreground">
              Análise de margens e lucros por produto e canal
            </p>
          </div>
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
              return (
                <Card key={idx} className={isBalcao ? 'border-primary/30 bg-primary/5' : ''}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{canal.canal}</span>
                      {canal.taxa > 0 && (
                        <Badge variant="outline" className="text-xs ml-auto">
                          -{canal.taxa}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-lg font-bold">{formatPercent(canal.margemMedia)}</p>
                    <p className="text-xs text-muted-foreground">Lucro médio: {formatCurrency(canal.lucroMedio)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Margens por Produto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 15 Produtos por Margem</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={analise.graficos.margensProdutos} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={75} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'meta') return [`${value}%`, 'Meta'];
                    return [`${value}%`, 'Margem'];
                  }}
                />
                <Bar dataKey="margem" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saúde do Cardápio</CardTitle>
            <CardDescription>Distribuição de produtos por margem</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={analise.graficos.statusPizza}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                >
                  {analise.graficos.statusPizza.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Produtos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por Produto</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {analise.produtos.map((produto) => (
                <div 
                  key={produto.id} 
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      produto.statusMargem === 'ideal' ? 'bg-success' :
                      produto.statusMargem === 'baixa' ? 'bg-amber-500' : 'bg-destructive'
                    }`} />
                    <div>
                      <p className="font-medium">{produto.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        CMV: {formatPercent(produto.cmv)} | Custo: {formatCurrency(produto.custoInsumos)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${
                      produto.statusMargem === 'ideal' ? 'text-success' :
                      produto.statusMargem === 'baixa' ? 'text-amber-500' : 'text-destructive'
                    }`}>
                      {formatPercent(produto.margemBalcao)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Lucro: {formatCurrency(produto.lucroBalcao)}
                    </p>
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
