import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Search, 
  Zap, 
  ChevronRight,
  ImageIcon,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Store,
  Smartphone
} from 'lucide-react';
import { ProdutoAnalise, QuadranteMenu, ConfiguracoesPrecificacao, formatCurrency, formatPercent, getQuadranteInfo } from './types';
import { cn } from '@/lib/utils';
import { usePrecosCanais } from '@/hooks/usePrecosCanais';

interface ProdutoListaCompactaProps {
  produtos: ProdutoAnalise[];
  quadranteFiltro: QuadranteMenu | null;
  categorias: string[];
  onSelectProduto: (produto: ProdutoAnalise) => void;
  onAplicarPreco: (produtoId: string, novoPreco: number, precoAnterior: number) => void;
  isAplicando?: boolean;
  isMobile?: boolean;
  config?: ConfiguracoesPrecificacao;
}

const ProdutoListaCompacta: React.FC<ProdutoListaCompactaProps> = ({
  produtos,
  quadranteFiltro,
  categorias,
  onSelectProduto,
  onAplicarPreco,
  isAplicando,
  isMobile,
  config,
}) => {
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [filtroSaude, setFiltroSaude] = useState<string>('todos');
  
  const { canaisConfigurados } = usePrecosCanais();

  const imposto = (config?.imposto_medio_sobre_vendas || 0) / 100;

  // Calcular margem para um canal específico
  const calcularMargemCanal = (preco: number, custo: number, taxa: number) => {
    if (preco <= 0) return 0;
    const lucro = preco - custo - preco * imposto - preco * (taxa / 100);
    return (lucro / preco) * 100;
  };

  // Obter preço de um canal (customizado ou base)
  const getPrecoCanal = (produto: ProdutoAnalise, canalId: string) => {
    if (produto.precosCanais && produto.precosCanais[canalId] !== undefined) {
      return produto.precosCanais[canalId];
    }
    return produto.preco_venda; // fallback para preço base
  };

  // Montar lista de canais a partir do hook
  const canais = useMemo(() => {
    return (canaisConfigurados || []).map(canal => ({
      id: canal.id,
      nome: canal.nome,
      taxa: canal.taxa,
      icone: canal.isBalcao ? <Store className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />
    }));
  }, [canaisConfigurados]);

  const produtosFiltrados = useMemo(() => {
    return produtos.filter(produto => {
      const matchQuadrante = !quadranteFiltro || produto.quadrante === quadranteFiltro;
      const matchCategoria = filtroCategoria === 'todas' || produto.categoria === filtroCategoria;
      const matchSaude = filtroSaude === 'todos' || produto.saudeMargem === filtroSaude;
      const matchBusca = produto.nome.toLowerCase().includes(busca.toLowerCase());
      return matchQuadrante && matchCategoria && matchSaude && matchBusca;
    });
  }, [produtos, quadranteFiltro, filtroCategoria, filtroSaude, busca]);

  // Ordenar: críticos primeiro, depois por margem
  const produtosOrdenados = useMemo(() => {
    return [...produtosFiltrados].sort((a, b) => {
      // Críticos primeiro
      if (a.saudeMargem === 'critico' && b.saudeMargem !== 'critico') return -1;
      if (b.saudeMargem === 'critico' && a.saudeMargem !== 'critico') return 1;
      // Depois por margem (menor primeiro para mostrar os que precisam de atenção)
      return a.margemContribuicao - b.margemContribuicao;
    });
  }, [produtosFiltrados]);

  const getSaudeIcon = (saude: 'critico' | 'atencao' | 'saudavel') => {
    switch (saude) {
      case 'critico':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'atencao':
        return <TrendingDown className="h-4 w-4 text-amber-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    }
  };

  const quadranteAtivo = quadranteFiltro ? getQuadranteInfo(quadranteFiltro) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            {quadranteAtivo ? (
              <>
                <span>{quadranteAtivo.icone}</span>
                <span className={quadranteAtivo.cor}>{quadranteAtivo.label}</span>
                <Badge variant="secondary">{produtosFiltrados.length}</Badge>
              </>
            ) : (
              <>
                📦 Todos os Produtos
                <Badge variant="secondary">{produtosFiltrados.length}</Badge>
              </>
            )}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {categorias.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroSaude} onValueChange={setFiltroSaude}>
            <SelectTrigger className="w-full sm:w-[130px]">
              <SelectValue placeholder="Saúde" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="critico">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  Crítico
                </span>
              </SelectItem>
              <SelectItem value="atencao">
                <span className="flex items-center gap-2">
                  <TrendingDown className="h-3 w-3 text-amber-500" />
                  Atenção
                </span>
              </SelectItem>
              <SelectItem value="saudavel">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Saudável
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {produtosOrdenados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum produto encontrado</p>
              {busca && (
                <Button variant="link" onClick={() => setBusca('')} className="mt-2">
                  Limpar busca
                </Button>
              )}
            </div>
          ) : (
            produtosOrdenados.map((produto) => {
              const quadInfo = getQuadranteInfo(produto.quadrante);
              const precisaAjuste = produto.preco_venda < produto.precoSugerido * 0.95;
              const diferencaPreco = produto.precoSugerido - produto.preco_venda;

              return (
                <div
                  key={produto.id}
                  className={cn(
                    "group p-3 border rounded-lg transition-all hover:shadow-sm cursor-pointer",
                    produto.saudeMargem === 'critico' && "border-destructive/30 bg-destructive/5",
                    produto.saudeMargem === 'atencao' && "border-amber-500/30 bg-amber-500/5",
                    produto.saudeMargem === 'saudavel' && "hover:bg-muted/50"
                  )}
                  onClick={() => onSelectProduto(produto)}
                >
                  <div className="flex items-center gap-3">
                    {/* Imagem */}
                    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {produto.imagem_url ? (
                        <img
                          src={produto.imagem_url}
                          alt={produto.nome}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-lg">{quadInfo.icone}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getSaudeIcon(produto.saudeMargem)}
                        <p className="font-medium text-sm truncate">{produto.nome}</p>
                        {precisaAjuste && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500 text-amber-600 shrink-0 hidden sm:inline-flex">
                            Defasado
                          </Badge>
                        )}
                      </div>

                      {/* Verificar se tem preços customizados */}
                      {/* Layout sempre mostra preços por canal */}
                      <div className="mt-2 space-y-1.5">
                        <div className="text-[10px] text-muted-foreground font-medium">
                          Preços por canal:
                        </div>
                        <div className="grid gap-1">
                          {canais.map(canal => {
                            const precoCanal = getPrecoCanal(produto, canal.id);
                            const margem = calcularMargemCanal(precoCanal, produto.custoInsumos, canal.taxa);
                            const temPrecoCustom = produto.precosCanais && produto.precosCanais[canal.id] !== undefined;
                            const isCritico = margem < 0;
                            const isAtencao = margem >= 0 && margem < 15;
                            
                            return (
                              <Tooltip key={canal.id}>
                                <TooltipTrigger asChild>
                                  <div 
                                    className={cn(
                                      "flex items-center justify-between px-2 py-1 rounded-md border text-xs",
                                      isCritico && "bg-destructive/5 border-destructive/20",
                                      isAtencao && "bg-amber-500/5 border-amber-500/20",
                                      !isCritico && !isAtencao && "bg-emerald-500/5 border-emerald-500/20"
                                    )}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      {canal.icone}
                                      <span className="font-medium truncate max-w-[60px]">{canal.nome}</span>
                                      {canal.taxa > 0 && (
                                        <span className="text-[10px] text-muted-foreground">({canal.taxa}%)</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold">{formatCurrency(precoCanal)}</span>
                                      <span className={cn(
                                        "text-[10px] font-medium",
                                        isCritico && "text-destructive",
                                        isAtencao && "text-amber-600",
                                        !isCritico && !isAtencao && "text-emerald-600"
                                      )}>
                                        {margem.toFixed(0)}%
                                      </span>
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <p className="font-medium">{canal.nome}</p>
                                  <p>Preço: {formatCurrency(precoCanal)} {temPrecoCustom ? '✓' : '(base)'}</p>
                                  <p>Margem: {formatPercent(margem)} <span className="text-muted-foreground">(líq. impostos)</span></p>
                                  {canal.taxa > 0 && <p className="text-muted-foreground">Taxa: {canal.taxa}%</p>}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Custo: {formatCurrency(produto.custoInsumos)}
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {precisaAjuste && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onAplicarPreco(produto.id, produto.precoSugerido, produto.preco_venda)}
                          disabled={isAplicando}
                          className="h-8 px-2 gap-1"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          {!isMobile && 'Aplicar'}
                        </Button>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProdutoListaCompacta;
