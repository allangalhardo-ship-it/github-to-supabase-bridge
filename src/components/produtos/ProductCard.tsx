import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Pencil, Trash2, Copy, Search, AlertCircle, ImageIcon } from 'lucide-react';
import FichaTecnicaDialog from './FichaTecnicaDialog';
import MarketPriceSearch from './MarketPriceSearch';

interface FichaTecnicaItem {
  id: string;
  quantidade: number;
  insumos: {
    id: string;
    nome: string;
    unidade_medida: string;
    custo_unitario: number;
  };
}

interface ProductCardProps {
  produto: {
    id: string;
    nome: string;
    categoria: string | null;
    preco_venda: number;
    ativo: boolean;
    rendimento_padrao?: number | null;
    imagem_url?: string | null;
    fichas_tecnicas?: FichaTecnicaItem[];
  };
  config?: {
    margem_desejada_padrao?: number;
    cmv_alvo?: number;
  } | null;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate?: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  produto,
  config,
  onEdit,
  onDelete,
  onDuplicate,
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calcular custo dos insumos
  const custoInsumos = React.useMemo(() => {
    if (!produto.fichas_tecnicas || produto.fichas_tecnicas.length === 0) return 0;
    return produto.fichas_tecnicas.reduce((sum, ft) => {
      const quantidade = Number(ft.quantidade) || 0;
      const custoUnitario = Number(ft.insumos?.custo_unitario) || 0;
      return sum + (quantidade * custoUnitario);
    }, 0);
  }, [produto.fichas_tecnicas]);

  const precoVenda = Number(produto.preco_venda) || 0;
  const lucro = precoVenda - custoInsumos;
  const margemPercent = precoVenda > 0 ? (lucro / precoVenda) * 100 : 0;
  const cmvAtual = precoVenda > 0 ? (custoInsumos / precoVenda) * 100 : 0;
  const cmvAlvo = config?.cmv_alvo || 35;
  const margemAlvo = config?.margem_desejada_padrao || 30;
  const temFichaTecnica = produto.fichas_tecnicas && produto.fichas_tecnicas.length > 0;

  // Cores baseadas em performance
  const lucroColor = lucro >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const margemColor = margemPercent >= margemAlvo ? 'text-green-600 dark:text-green-400' : margemPercent >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const cmvColor = cmvAtual <= cmvAlvo ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400';

  return (
    <Card className={`${!produto.ativo ? 'opacity-60' : ''} overflow-hidden transition-shadow hover:shadow-md`}>
      <CardContent className="p-0">
        {/* Desktop Layout */}
        <div className="hidden md:flex gap-4 p-4">
          {/* Imagem */}
          <div className="w-[120px] h-[120px] bg-muted rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
            {produto.imagem_url ? (
              <img 
                src={produto.imagem_url} 
                alt={produto.nome}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
            )}
          </div>

          {/* Informações principais */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {/* Header: Nome + Categoria */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-lg truncate">{produto.nome}</h3>
                {produto.categoria && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-1 font-normal">
                    {produto.categoria}
                  </Badge>
                )}
              </div>
              {/* Ações desktop */}
              <div className="flex items-center gap-1 shrink-0">
                <MarketPriceSearch
                  productName={produto.nome}
                  category={produto.categoria}
                  currentPrice={precoVenda}
                  trigger={
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Pesquisar preço de mercado">
                      <Search className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Preço Venda</p>
                <p className="font-bold text-lg text-foreground">{formatCurrency(precoVenda)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Custo Insumos</p>
                <p className="font-medium">{formatCurrency(custoInsumos)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Lucro</p>
                <p className={`font-bold text-lg ${lucroColor}`}>{formatCurrency(lucro)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Margem</p>
                <p className={`font-bold text-lg ${margemColor}`}>{margemPercent.toFixed(1)}%</p>
              </div>
            </div>

            {/* Indicadores visuais - apenas desktop */}
            {temFichaTecnica && (
              <div className="grid grid-cols-2 gap-4">
                {/* Margem Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] mb-1 text-muted-foreground">
                      <span>Margem: {margemPercent.toFixed(1)}%</span>
                      <span>Alvo: {margemAlvo}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${margemPercent >= margemAlvo ? 'bg-green-500' : margemPercent >= 0 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(Math.max(margemPercent, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                  {margemPercent < margemAlvo && (
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                </div>

                {/* CMV Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] mb-1 text-muted-foreground">
                      <span>CMV: {cmvAtual.toFixed(1)}%</span>
                      <span>Alvo: {cmvAlvo}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${cmvAtual <= cmvAlvo ? 'bg-green-500' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(cmvAtual, 100)}%` }}
                      />
                    </div>
                  </div>
                  {cmvAtual > cmvAlvo && (
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                </div>
              </div>
            )}

            {/* Botões Desktop */}
            <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/50">
              <FichaTecnicaDialog
                produtoId={produto.id}
                produtoNome={produto.nome}
                fichaTecnica={produto.fichas_tecnicas || []}
              />
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Editar
              </Button>
              {onDuplicate && (
                <Button variant="outline" size="sm" onClick={onDuplicate}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Duplicar
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive ml-auto" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Excluir
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden p-4 space-y-3">
          {/* Imagem centralizada */}
          <div className="w-full aspect-square max-w-[200px] mx-auto bg-muted rounded-lg flex items-center justify-center overflow-hidden">
            {produto.imagem_url ? (
              <img 
                src={produto.imagem_url} 
                alt={produto.nome}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
            )}
          </div>

          {/* Nome + Categoria */}
          <div className="text-center">
            <h3 className="font-semibold text-lg">{produto.nome}</h3>
            {produto.categoria && (
              <Badge variant="outline" className="text-[10px] px-2 py-0 mt-1 font-normal">
                {produto.categoria}
              </Badge>
            )}
          </div>

          {/* Preço destacado */}
          <div className="text-center">
            <p className="text-muted-foreground text-xs">Preço Venda</p>
            <p className="font-bold text-2xl text-foreground">{formatCurrency(precoVenda)}</p>
          </div>

          {/* KPIs principais - 2 colunas */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-muted-foreground text-xs">Lucro</p>
              <p className={`font-bold text-xl ${lucroColor}`}>{formatCurrency(lucro)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-muted-foreground text-xs">Margem</p>
              <p className={`font-bold text-xl ${margemColor}`}>{margemPercent.toFixed(1)}%</p>
            </div>
          </div>

          {/* Rendimento se existir */}
          {produto.rendimento_padrao && (
            <div className="text-center bg-muted/50 rounded-lg p-2">
              <p className="text-muted-foreground text-xs">Rendimento</p>
              <p className="font-semibold">{produto.rendimento_padrao} unidades</p>
            </div>
          )}

          {/* Botões Mobile */}
          <div className="flex gap-2 pt-2">
            <FichaTecnicaDialog
              produtoId={produto.id}
              produtoNome={produto.nome}
              fichaTecnica={produto.fichas_tecnicas || []}
            />
            <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Editar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
