import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Zap, 
  History,
  Package,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Calculator,
  Store,
  Smartphone,
  ChevronRight,
  ImageIcon
} from 'lucide-react';
import { ProdutoComMetricas, formatCurrency, formatPercent } from './types';

interface ProdutosListProps {
  produtos: ProdutoComMetricas[];
  categorias: string[];
  onSelectProduct: (produto: ProdutoComMetricas) => void;
  onApplyPrice: (produtoId: string, novoPreco: number, precoAnterior: number) => void;
  onApplySelected: (produtoIds: string[]) => void;
  onViewHistory: (produtoId: string) => void;
  isApplying?: boolean;
  isMobile?: boolean;
}

const ProdutosList: React.FC<ProdutosListProps> = ({
  produtos,
  categorias,
  onSelectProduct,
  onApplyPrice,
  onApplySelected,
  onViewHistory,
  isApplying,
  isMobile
}) => {
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const produtosFiltrados = produtos.filter(produto => {
    const matchCategoria = filtroCategoria === 'todas' || produto.categoria === filtroCategoria;
    const matchStatus = filtroStatus === 'todos' || produto.statusPreco === filtroStatus;
    const matchBusca = produto.nome.toLowerCase().includes(busca.toLowerCase());
    return matchCategoria && matchStatus && matchBusca;
  });

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === produtosFiltrados.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(produtosFiltrados.map(p => p.id)));
    }
  };

  const selectedAbaixo = produtosFiltrados.filter(
    p => selectedIds.has(p.id) && p.statusPreco === 'abaixo'
  );

  const handleApplySelected = () => {
    onApplySelected(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'abaixo':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      case 'acima':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-success" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Produtos ({produtosFiltrados.length})
          </CardTitle>
          
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
              </span>
              {selectedAbaixo.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleApplySelected}
                  disabled={isApplying}
                  className="gap-1.5"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Aplicar ({selectedAbaixo.length})
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-4">
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
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {categorias.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="abaixo">
                <span className="flex items-center gap-2">
                  <TrendingDown className="h-3 w-3 text-destructive" />
                  Abaixo
                </span>
              </SelectItem>
              <SelectItem value="ideal">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Ideal
                </span>
              </SelectItem>
              <SelectItem value="acima">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-blue-500" />
                  Acima
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Header de seleção */}
        {!isMobile && produtosFiltrados.length > 0 && (
          <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-lg">
            <Checkbox
              checked={selectedIds.size === produtosFiltrados.length && produtosFiltrados.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm text-muted-foreground">Selecionar todos</span>
          </div>
        )}

        {/* Lista de produtos */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {produtosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum produto encontrado</p>
              {busca && (
                <Button variant="link" onClick={() => setBusca('')}>
                  Limpar busca
                </Button>
              )}
            </div>
          ) : (
            produtosFiltrados.map((produto) => (
              <div
                key={produto.id}
                className={`group p-3 border rounded-lg transition-all hover:shadow-sm cursor-pointer ${
                  produto.statusPreco === 'abaixo' 
                    ? 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10' 
                    : produto.statusPreco === 'acima'
                      ? 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10'
                      : 'hover:bg-muted/50'
                }`}
                onClick={() => onSelectProduct(produto)}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox (desktop only) */}
                  {!isMobile && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(produto.id)}
                        onCheckedChange={() => toggleSelect(produto.id)}
                      />
                    </div>
                  )}

                  {/* Imagem */}
                  <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {produto.imagem_url ? (
                      <img
                        src={produto.imagem_url}
                        alt={produto.nome}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={produto.statusPreco} />
                      <p className="font-medium text-sm truncate">{produto.nome}</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
                      <span className="text-muted-foreground">
                        Atual: <span className="font-medium text-foreground">{formatCurrency(produto.preco_venda)}</span>
                      </span>
                      <span className={produto.margemLiquida < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                        Margem: <span className={`font-medium ${
                          produto.margemLiquida < 0 ? 'text-destructive' : 
                          produto.margemLiquida >= 20 ? 'text-success' : 'text-foreground'
                        }`}>{formatPercent(produto.margemLiquida)}</span>
                      </span>
                      {produto.statusPreco !== 'ideal' && (
                        <span className="text-success">
                          Sugerido: <span className="font-medium">{formatCurrency(produto.precoBalcao)}</span>
                        </span>
                      )}
                    </div>

                    {/* Preços por app (resumido) */}
                    {!isMobile && produto.precosApps.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {produto.precosApps.slice(0, 2).map(app => (
                          <Badge 
                            key={app.id} 
                            variant="secondary" 
                            className="text-[10px] px-1.5 py-0 h-5 gap-1"
                          >
                            <Smartphone className="h-2.5 w-2.5" />
                            {app.nome_app}: {formatCurrency(app.preco)}
                          </Badge>
                        ))}
                        {produto.precosApps.length > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                            +{produto.precosApps.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Ações rápidas */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {produto.statusPreco === 'abaixo' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onApplyPrice(produto.id, produto.precoBalcao, produto.preco_venda)}
                        disabled={isApplying}
                        className="h-8 px-2 gap-1"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        {!isMobile && 'Aplicar'}
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onViewHistory(produto.id)}
                      className="h-8 w-8"
                      title="Histórico"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProdutosList;
