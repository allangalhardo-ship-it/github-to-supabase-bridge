import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  FileText,
  ImageIcon,
  Pencil,
  Trash2,
  Zap,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCurrencyBRL } from '@/lib/format';
import { calcularPrecoSugerido, ConfiguracaoPrecificacao } from '@/lib/precificacaoUtils';
import FichaTecnicaDialog from "./FichaTecnicaDialog";
import DuplicarProdutoDialog from "./DuplicarProdutoDialog";
import MissingFichaBadge from "./MissingFichaBadge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    observacoes_ficha?: string | null;
    fichas_tecnicas?: FichaTecnicaItem[];
  };
  config?: {
    margem_desejada_padrao?: number;
    cmv_alvo?: number;
    imposto_medio_sobre_vendas?: number;
    faturamento_mensal?: number;
  } | null;
  onEdit: () => void;
  onDelete: () => void;
  onApplyPrice?: (produtoId: string, novoPreco: number) => void;
  isApplyingPrice?: boolean;
  onDuplicateSuccess?: (novoProdutoId: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  produto,
  config,
  onEdit,
  onDelete,
  onApplyPrice,
  isApplyingPrice,
  onDuplicateSuccess,
}) => {
  const { usuario } = useAuth();
  const isMobile = useIsMobile();
  const [showDuplicar, setShowDuplicar] = useState(false);

  const formatCurrency = formatCurrencyBRL;

  // Não precisamos mais buscar custos fixos para o cálculo do preço
  // O custo fixo é verificado no Dashboard, não no preço unitário

  const custoInsumos = useMemo(() => {
    if (!produto.fichas_tecnicas || produto.fichas_tecnicas.length === 0) return 0;
    const custo = produto.fichas_tecnicas.reduce((sum, ft) => {
      const quantidade = Number(ft.quantidade) || 0;
      const custoUnitario = Number(ft.insumos?.custo_unitario) || 0;
      return sum + quantidade * custoUnitario;
    }, 0);
    return custo;
  }, [produto.fichas_tecnicas]);

  const precoVenda = Number(produto.preco_venda) || 0;
  const lucro = precoVenda - custoInsumos;
  const cmvAtual = precoVenda > 0 ? (custoInsumos / precoVenda) * 100 : 0;

  // Custo por unidade
  const rendimento = Number(produto.rendimento_padrao) || 0;
  const custoPorUnidade = rendimento > 0 && custoInsumos > 0 ? custoInsumos / rendimento : 0;

  const cmvAlvo = Number(config?.cmv_alvo ?? 35);
  const margemDesejada = Number(config?.margem_desejada_padrao ?? 30);

  const margemBruta = precoVenda > 0 ? ((precoVenda - custoInsumos) / precoVenda) * 100 : 0;

  // Cálculo do preço sugerido
  // FÓRMULA CORRETA: SEM custo fixo no divisor
  // O custo fixo é coberto pelo volume de vendas (verificado no Dashboard)
  const { precoSugerido, precoSugeridoValido, precoAbaixoSugerido } = useMemo(() => {
    if (custoInsumos <= 0) {
      return { precoSugerido: 0, precoSugeridoValido: false, precoAbaixoSugerido: false };
    }
    
    const configPrecificacao: ConfiguracaoPrecificacao = {
      margem_desejada_padrao: config?.margem_desejada_padrao || 30,
      imposto_medio_sobre_vendas: config?.imposto_medio_sobre_vendas || 0,
    };

    const resultado = calcularPrecoSugerido(custoInsumos, configPrecificacao, 0);
    const valido = Number.isFinite(resultado.preco) && resultado.preco > 0 && resultado.viavel;
    const abaixo = valido && precoVenda < resultado.preco;

    return { 
      precoSugerido: resultado.preco, 
      precoSugeridoValido: valido, 
      precoAbaixoSugerido: abaixo 
    };
  }, [custoInsumos, config, precoVenda]);

  const temFichaTecnica = (produto.fichas_tecnicas?.length || 0) > 0;
  const qtdInsumos = produto.fichas_tecnicas?.length || 0;

  const lucroTextClass = lucro >= 0 ? "text-success" : "text-destructive";
  
  const margemTextClass =
    margemBruta < 0
      ? "text-destructive"
      : margemBruta >= margemDesejada
        ? "text-success"
        : "text-warning";

  const margemBarClass =
    margemBruta < 0
      ? "bg-destructive"
      : margemBruta >= margemDesejada
        ? "bg-success"
        : "bg-warning";

  const cmvBarClass = cmvAtual <= cmvAlvo ? "bg-success" : "bg-warning";

  const productImage = (
    <div className="bg-muted rounded-md flex items-center justify-center shrink-0 overflow-hidden">
      {produto.imagem_url ? (
        <img
          src={produto.imagem_url}
          alt={produto.nome}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <ImageIcon className="text-muted-foreground/50" />
      )}
    </div>
  );

  // Mobile: foco em foto, nome, preço, lucro e margem
  if (isMobile) {
    return (
      <>
        <Card className={`${!produto.ativo ? "opacity-60" : ""} overflow-hidden`}>
          <CardContent className="p-3">
            <div className="flex gap-3">
              <div className="w-14 h-14">{React.cloneElement(productImage, {
                className:
                  "w-14 h-14 bg-muted rounded-md flex items-center justify-center shrink-0 overflow-hidden",
                children: produto.imagem_url ? (
                  <img
                    src={produto.imagem_url}
                    alt={produto.nome}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                ),
              })}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm leading-tight line-clamp-2">{produto.nome}</h3>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {produto.categoria && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                          {produto.categoria}
                        </Badge>
                      )}
                      {!temFichaTecnica && <MissingFichaBadge />}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">Preço</p>
                    <p className="font-bold text-sm">{formatCurrency(precoVenda)}</p>
                  </div>
                </div>

                {temFichaTecnica ? (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span className={`${lucroTextClass} font-medium`}>
                      Lucro: <span className="font-bold">{formatCurrency(lucro)}</span>
                    </span>
                    <span className={`${margemTextClass} font-medium`}>
                      Margem: <span className="font-bold">{margemBruta.toFixed(0)}%</span>
                    </span>
                    {precoAbaixoSugerido && (
                      <span className="text-warning">
                        Sugerido: <span className="font-medium">{formatCurrency(precoSugerido)}</span>
                      </span>
                    )}
                    {custoPorUnidade > 0 && (
                      <span className="text-muted-foreground">
                        Custo/un: <span className="font-medium text-foreground">{formatCurrency(custoPorUnidade)}</span>
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground italic">
                    Adicione ingredientes para ver custos e lucros
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              {temFichaTecnica && precoSugerido > 0 && precoAbaixoSugerido && onApplyPrice && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="h-8 px-2 text-xs gap-1.5"
                      onClick={() => onApplyPrice(produto.id, precoSugerido)}
                      disabled={isApplyingPrice}
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Aplicar
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Aplicar preço sugerido: {formatCurrency(precoSugerido)}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <FichaTecnicaDialog
                produtoId={produto.id}
                produtoNome={produto.nome}
                fichaTecnica={produto.fichas_tecnicas || []}
                rendimentoPadrao={produto.rendimento_padrao}
                observacoesFicha={produto.observacoes_ficha}
                trigger={
                  <Button variant="secondary" size="sm" className="h-8 px-2 text-xs flex-1 gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Ficha ({qtdInsumos})
                  </Button>
                }
              />
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setShowDuplicar(true)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <DuplicarProdutoDialog
          open={showDuplicar}
          onOpenChange={setShowDuplicar}
          produto={produto}
          onSuccess={onDuplicateSuccess}
        />
      </>
    );
  }

  // Desktop: compacto, com detalhes sob demanda
  return (
    <>
      <Card className={`${!produto.ativo ? "opacity-60" : ""} overflow-hidden hover:shadow-sm transition-shadow`}>
        <CardContent className="p-3">
          <div className="flex gap-3">
            <div className="w-16 h-20 shrink-0">
              <div className="w-16 h-20 bg-muted rounded-md flex items-center justify-center overflow-hidden">
                {produto.imagem_url ? (
                  <img
                    src={produto.imagem_url}
                    alt={produto.nome}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="mb-1">
                <h3 className="font-medium text-sm leading-tight line-clamp-2">{produto.nome}</h3>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {produto.categoria && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                      {produto.categoria}
                    </Badge>
                  )}
                  {!temFichaTecnica && <MissingFichaBadge />}
                </div>
              </div>

              {temFichaTecnica ? (
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Preço </span>
                    <span className="font-bold text-sm">{formatCurrency(precoVenda)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lucro </span>
                    <span className={`font-bold text-sm ${lucroTextClass}`}>{formatCurrency(lucro)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Margem </span>
                    <span className={`font-bold text-sm ${margemTextClass}`}>{margemBruta.toFixed(1)}%</span>
                  </div>
                  {precoAbaixoSugerido && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Sugerido </span>
                      <span className="font-bold text-sm text-warning">
                        {formatCurrency(precoSugerido)}
                      </span>
                      {onApplyPrice && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-5 px-1.5 text-[10px] gap-0.5 text-primary border-primary hover:bg-primary/10"
                              onClick={() => onApplyPrice(produto.id, precoSugerido)}
                              disabled={isApplyingPrice}
                            >
                              <Zap className="h-3 w-3" />
                              Aplicar
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Aplicar preço sugerido de {formatCurrency(precoSugerido)}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  )}
                  {custoPorUnidade > 0 && (
                    <div className="text-muted-foreground">
                      Custo/un <span className="font-medium text-foreground">{formatCurrency(custoPorUnidade)}</span>
                      <span className="text-[10px] ml-1">(rende {rendimento})</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-baseline gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Preço </span>
                    <span className="font-bold text-sm">{formatCurrency(precoVenda)}</span>
                  </div>
                  <p className="text-muted-foreground italic">
                    Adicione ingredientes para ver custos
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 pt-2 border-t flex items-center gap-1">
            <FichaTecnicaDialog
              produtoId={produto.id}
              produtoNome={produto.nome}
              fichaTecnica={produto.fichas_tecnicas || []}
              rendimentoPadrao={produto.rendimento_padrao}
              observacoesFicha={produto.observacoes_ficha}
              trigger={
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  Ficha ({qtdInsumos})
                </Button>
              }
            />

            <div className="flex-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7" 
                  onClick={() => setShowDuplicar(true)} 
                  title="Duplicar"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Duplicar produto</TooltipContent>
            </Tooltip>

            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {temFichaTecnica && (
            <details className="mt-3 pt-2 border-t">
              <summary className="cursor-pointer select-none text-xs text-muted-foreground">
                Detalhes
              </summary>

              <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                <div className="bg-muted/50 rounded-md p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Custo insumos</p>
                  <p className="font-semibold">{formatCurrency(custoInsumos)}</p>
                </div>
                <div className="bg-muted/50 rounded-md p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">CMV</p>
                  <p className="font-semibold">{cmvAtual.toFixed(1)}%</p>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Margem Bruta</span>
                    <span>Meta {margemDesejada}%</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${margemBarClass}`}
                      style={{ width: `${Math.min(Math.max((margemBruta / Math.max(margemDesejada, 1)) * 100, 0), 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>CMV</span>
                    <span>Meta {cmvAlvo}%</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${cmvBarClass}`} style={{ width: `${Math.min(cmvAtual, 100)}%` }} />
                  </div>
                </div>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <DuplicarProdutoDialog
        open={showDuplicar}
        onOpenChange={setShowDuplicar}
        produto={produto}
        onSuccess={onDuplicateSuccess}
      />
    </>
  );
};

export default ProductCard;
