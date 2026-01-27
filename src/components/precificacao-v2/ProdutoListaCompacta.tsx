import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Zap, 
  ChevronRight,
  ImageIcon,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { ProdutoAnalise, QuadranteMenu, formatCurrency, formatPercent, getQuadranteInfo } from './types';
import { cn } from '@/lib/utils';

interface ProdutoListaCompactaProps {
  produtos: ProdutoAnalise[];
  quadranteFiltro: QuadranteMenu | null;
  categorias: string[];
  onSelectProduto: (produto: ProdutoAnalise) => void;
  onAplicarPreco: (produtoId: string, novoPreco: number, precoAnterior: number) => void;
  isAplicando?: boolean;
  isMobile?: boolean;
}

const ProdutoListaCompacta: React.FC<ProdutoListaCompactaProps> = ({
  produtos,
  quadranteFiltro,
  categorias,
  onSelectProduto,
  onAplicarPreco,
  isAplicando,
  isMobile,
}) => {
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [filtroSaude, setFiltroSaude] = useState<string>('todos');

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
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                        <span>
                          Atual: <span className="font-semibold text-foreground">{formatCurrency(produto.preco_venda)}</span>
                        </span>
                        <span className={cn(
                          "font-medium",
                          produto.margemContribuicao < 0 ? "text-destructive" :
                          produto.margemContribuicao < 15 ? "text-amber-600" : "text-emerald-600"
                        )}>
                          {formatPercent(produto.margemContribuicao)}
                        </span>
                        {produto.quantidadeVendida > 0 && (
                          <span className="text-muted-foreground">
                            {produto.quantidadeVendida} vendas
                          </span>
                        )}
                      </div>

                      {/* Sugestão de preço */}
                      {precisaAjuste && (
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-emerald-600">
                          <TrendingUp className="h-3 w-3" />
                          <span>Sugerido: {formatCurrency(produto.precoSugerido)}</span>
                          <span className="text-muted-foreground">
                            (+{formatCurrency(diferencaPreco)})
                          </span>
                        </div>
                      )}
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
