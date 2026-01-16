import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Copy, Search, ImageIcon, FileText } from 'lucide-react';
import FichaTecnicaDialog from './FichaTecnicaDialog';
import MarketPriceSearch from './MarketPriceSearch';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

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
  const qtdInsumos = produto.fichas_tecnicas?.length || 0;

  const lucroColor = lucro >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  const margemColor = margemPercent >= margemAlvo ? 'text-green-600 dark:text-green-400' : margemPercent >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const margemBarColor = margemPercent >= margemAlvo ? 'bg-green-500' : margemPercent >= 0 ? 'bg-amber-500' : 'bg-red-500';
  const cmvBarColor = cmvAtual <= cmvAlvo ? 'bg-green-500' : 'bg-amber-500';

  if (isMobile) {
    return (
      <Card className={`${!produto.ativo ? 'opacity-60' : ''} overflow-hidden`}>
        <CardContent className="p-4">
          {/* Header: Imagem + Info */}
          <div className="flex gap-3 mb-3">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              {produto.imagem_url ? (
                <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base leading-tight line-clamp-2">{produto.nome}</h3>
              {produto.categoria && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-1">
                  {produto.categoria}
                </Badge>
              )}
            </div>
          </div>

          {/* Preço + Lucro + Margem */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Preço</p>
              <p className="font-bold text-sm">{formatCurrency(precoVenda)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lucro</p>
              <p className={`font-bold text-sm ${lucroColor}`}>{formatCurrency(lucro)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Margem</p>
              <p className={`font-bold text-sm ${margemColor}`}>{margemPercent.toFixed(1)}%</p>
            </div>
          </div>

          {/* Rendimento se existir */}
          {produto.rendimento_padrao && produto.rendimento_padrao > 0 && (
            <p className="text-xs text-muted-foreground text-center mb-3">
              Rende <span className="font-medium text-foreground">{produto.rendimento_padrao}</span> unidades
            </p>
          )}

          {/* Botões */}
          <div className="flex gap-2">
            <FichaTecnicaDialog
              produtoId={produto.id}
              produtoNome={produto.nome}
              fichaTecnica={produto.fichas_tecnicas || []}
            />
            <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Editar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Desktop Layout
  return (
    <Card className={`${!produto.ativo ? 'opacity-60' : ''} overflow-hidden hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Imagem */}
          <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
            {produto.imagem_url ? (
              <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
            )}
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            {/* Nome + Categoria + Ações */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base truncate">{produto.nome}</h3>
                  <MarketPriceSearch
                    productName={produto.nome}
                    category={produto.categoria}
                    currentPrice={precoVenda}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                </div>
                {produto.categoria && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-0.5">
                    {produto.categoria}
                  </Badge>
                )}
              </div>
              
              {/* Ações rápidas */}
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {onDuplicate && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* KPIs em linha */}
            <div className="flex items-center gap-4 text-sm mb-3">
              <div>
                <span className="text-muted-foreground text-xs">Preço: </span>
                <span className="font-semibold">{formatCurrency(precoVenda)}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Custo: </span>
                <span className="font-medium">{formatCurrency(custoInsumos)}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Lucro: </span>
                <span className={`font-semibold ${lucroColor}`}>{formatCurrency(lucro)}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Margem: </span>
                <span className={`font-semibold ${margemColor}`}>{margemPercent.toFixed(1)}%</span>
              </div>
            </div>

            {/* Barras de indicadores */}
            {temFichaTecnica && (
              <div className="flex gap-6 mb-3">
                <div className="flex-1 max-w-[180px]">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                    <span>Margem {margemPercent.toFixed(0)}%</span>
                    <span>Meta {margemAlvo}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${margemBarColor}`} style={{ width: `${Math.min(Math.max(margemPercent, 0), 100)}%` }} />
                  </div>
                </div>
                <div className="flex-1 max-w-[180px]">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                    <span>CMV {cmvAtual.toFixed(0)}%</span>
                    <span>Meta {cmvAlvo}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${cmvBarColor}`} style={{ width: `${Math.min(cmvAtual, 100)}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Ficha técnica */}
            <FichaTecnicaDialog
              produtoId={produto.id}
              produtoNome={produto.nome}
              fichaTecnica={produto.fichas_tecnicas || []}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
