import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Copy, Search, ImageIcon } from 'lucide-react';
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

  const lucroColor = lucro >= 0 ? 'text-green-600' : 'text-red-600';
  const margemColor = margemPercent >= margemAlvo ? 'text-green-600' : 'text-amber-600';
  const margemBarColor = margemPercent >= margemAlvo ? 'bg-green-500' : 'bg-amber-500';
  const cmvBarColor = cmvAtual <= cmvAlvo ? 'bg-green-500' : 'bg-amber-500';

  // Mobile Layout - Compacto
  if (isMobile) {
    return (
      <Card className={`${!produto.ativo ? 'opacity-60' : ''}`}>
        <CardContent className="p-3">
          <div className="flex gap-3">
            {/* Imagem pequena */}
            <div className="w-14 h-14 bg-muted rounded-md flex items-center justify-center shrink-0 overflow-hidden">
              {produto.imagem_url ? (
                <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
              )}
            </div>
            
            {/* Info compacta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <h3 className="font-medium text-sm leading-tight truncate">{produto.nome}</h3>
                  {produto.categoria && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 mt-0.5">
                      {produto.categoria}
                    </Badge>
                  )}
                </div>
                <span className="font-bold text-sm shrink-0">{formatCurrency(precoVenda)}</span>
              </div>
              
              {/* Lucro e Margem em linha */}
              <div className="flex gap-3 mt-1.5 text-xs">
                <span className={lucroColor}>Lucro: <b>{formatCurrency(lucro)}</b></span>
                <span className={margemColor}>Margem: <b>{margemPercent.toFixed(0)}%</b></span>
              </div>
            </div>
          </div>

          {/* Ações compactas */}
          <div className="flex gap-1.5 mt-2 pt-2 border-t">
            <FichaTecnicaDialog
              produtoId={produto.id}
              produtoNome={produto.nome}
              fichaTecnica={produto.fichas_tecnicas || []}
            />
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Desktop Layout - Compacto
  return (
    <Card className={`${!produto.ativo ? 'opacity-60' : ''} hover:shadow-sm transition-shadow`}>
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* Imagem */}
          <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center shrink-0 overflow-hidden">
            {produto.imagem_url ? (
              <img src={produto.imagem_url} alt={produto.nome} className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
            )}
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            {/* Header: Nome + Ações */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0">
                <h3 className="font-medium text-sm leading-tight truncate">{produto.nome}</h3>
                {produto.categoria && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 mt-0.5">
                    {produto.categoria}
                  </Badge>
                )}
              </div>
              <div className="flex items-center shrink-0">
                <MarketPriceSearch
                  productName={produto.nome}
                  category={produto.categoria}
                  currentPrice={precoVenda}
                  trigger={
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Search className="h-3 w-3" />
                    </Button>
                  }
                />
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
                  <Pencil className="h-3 w-3" />
                </Button>
                {onDuplicate && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDuplicate}>
                    <Copy className="h-3 w-3" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* KPIs em linha compacta */}
            <div className="flex items-baseline gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">Preço </span>
                <span className="font-semibold text-sm">{formatCurrency(precoVenda)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Custo </span>
                <span className="font-medium">{formatCurrency(custoInsumos)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Lucro </span>
                <span className={`font-semibold ${lucroColor}`}>{formatCurrency(lucro)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Margem </span>
                <span className={`font-semibold ${margemColor}`}>{margemPercent.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Barras + Ficha Técnica */}
        <div className="flex items-center gap-3 mt-2 pt-2 border-t">
          {temFichaTecnica && (
            <>
              <div className="flex-1 flex gap-3">
                <div className="flex-1 max-w-[140px]">
                  <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                    <span>Margem {margemPercent.toFixed(0)}%</span>
                    <span>Meta {margemAlvo}%</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${margemBarColor}`} style={{ width: `${Math.min(Math.max(margemPercent, 0), 100)}%` }} />
                  </div>
                </div>
                <div className="flex-1 max-w-[140px]">
                  <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                    <span>CMV {cmvAtual.toFixed(0)}%</span>
                    <span>Meta {cmvAlvo}%</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${cmvBarColor}`} style={{ width: `${Math.min(cmvAtual, 100)}%` }} />
                  </div>
                </div>
              </div>
            </>
          )}
          <FichaTecnicaDialog
            produtoId={produto.id}
            produtoNome={produto.nome}
            fichaTecnica={produto.fichas_tecnicas || []}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
