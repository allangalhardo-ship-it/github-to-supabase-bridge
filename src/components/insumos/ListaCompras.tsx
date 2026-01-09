import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ShoppingCart, 
  Calendar, 
  Package, 
  TrendingUp, 
  AlertTriangle,
  Calculator,
  Printer,
  Copy,
  CheckCircle2,
  Info
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
  custo_unitario: number;
  estoque_atual: number;
  estoque_minimo: number;
  is_intermediario: boolean;
}

interface FichaTecnica {
  insumo_id: string;
  quantidade: number;
  produto_id: string;
}

interface Venda {
  produto_id: string | null;
  quantidade: number;
  data_venda: string;
}

interface ItemLista {
  insumo: Insumo;
  consumoDiario: number;
  estoqueAtual: number;
  diasEstoqueAtual: number;
  quantidadeComprar: number;
  custoEstimado: number;
  urgente: boolean;
}

const ListaCompras = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const [periodoGiro, setPeriodoGiro] = useState(30);
  const [diasEstoque, setDiasEstoque] = useState(7);
  const [dataCompra, setDataCompra] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [listaGerada, setListaGerada] = useState(false);

  // Buscar insumos simples (não intermediários)
  const { data: insumos, isLoading: loadingInsumos } = useQuery({
    queryKey: ['insumos-lista-compras', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .eq('is_intermediario', false)
        .order('nome');

      if (error) throw error;
      return data as Insumo[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar fichas técnicas
  const { data: fichasTecnicas, isLoading: loadingFichas } = useQuery({
    queryKey: ['fichas-tecnicas-lista', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fichas_tecnicas')
        .select('insumo_id, quantidade, produto_id');

      if (error) throw error;
      return data as FichaTecnica[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Buscar vendas do período
  const { data: vendas, isLoading: loadingVendas } = useQuery({
    queryKey: ['vendas-giro', usuario?.empresa_id, periodoGiro],
    queryFn: async () => {
      const dataInicio = format(subDays(new Date(), periodoGiro), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('vendas')
        .select('produto_id, quantidade, data_venda')
        .gte('data_venda', dataInicio)
        .not('produto_id', 'is', null);

      if (error) throw error;
      return data as Venda[];
    },
    enabled: !!usuario?.empresa_id,
  });

  // Calcular consumo diário por insumo baseado no giro
  const listaCompras = useMemo((): ItemLista[] => {
    if (!insumos || !fichasTecnicas || !vendas) return [];

    // Agrupar vendas por produto e calcular média diária
    const vendasPorProduto: Record<string, number> = {};
    vendas.forEach(v => {
      if (v.produto_id) {
        vendasPorProduto[v.produto_id] = (vendasPorProduto[v.produto_id] || 0) + Number(v.quantidade);
      }
    });

    // Calcular média diária de vendas por produto
    const mediaDiariaPorProduto: Record<string, number> = {};
    Object.entries(vendasPorProduto).forEach(([produtoId, totalVendido]) => {
      mediaDiariaPorProduto[produtoId] = totalVendido / periodoGiro;
    });

    // Calcular consumo diário por insumo
    const consumoDiarioPorInsumo: Record<string, number> = {};
    
    fichasTecnicas.forEach(ficha => {
      const mediaDiaria = mediaDiariaPorProduto[ficha.produto_id] || 0;
      const consumoInsumo = mediaDiaria * Number(ficha.quantidade);
      
      consumoDiarioPorInsumo[ficha.insumo_id] = 
        (consumoDiarioPorInsumo[ficha.insumo_id] || 0) + consumoInsumo;
    });

    // Montar lista de compras
    const itens: ItemLista[] = [];

    insumos.forEach(insumo => {
      const consumoDiario = consumoDiarioPorInsumo[insumo.id] || 0;
      const estoqueAtual = Number(insumo.estoque_atual);
      
      // Dias que o estoque atual dura
      const diasEstoqueAtual = consumoDiario > 0 ? estoqueAtual / consumoDiario : Infinity;
      
      // Quantidade necessária para os dias de estoque desejados
      const necessidadeTotal = consumoDiario * diasEstoque;
      
      // Quanto precisa comprar (necessidade - estoque atual)
      const quantidadeComprar = Math.max(0, necessidadeTotal - estoqueAtual);
      
      // Custo estimado
      const custoEstimado = quantidadeComprar * Number(insumo.custo_unitario);
      
      // É urgente se estoque está abaixo do mínimo ou dura menos que 3 dias
      const urgente = estoqueAtual <= Number(insumo.estoque_minimo) || diasEstoqueAtual < 3;

      // Só adiciona se tem consumo ou se tem urgência (estoque baixo)
      if (consumoDiario > 0 || urgente) {
        itens.push({
          insumo,
          consumoDiario,
          estoqueAtual,
          diasEstoqueAtual: diasEstoqueAtual === Infinity ? -1 : diasEstoqueAtual,
          quantidadeComprar,
          custoEstimado,
          urgente,
        });
      }
    });

    // Ordenar: urgentes primeiro, depois por quantidade a comprar
    return itens.sort((a, b) => {
      if (a.urgente && !b.urgente) return -1;
      if (!a.urgente && b.urgente) return 1;
      return b.quantidadeComprar - a.quantidadeComprar;
    });
  }, [insumos, fichasTecnicas, vendas, periodoGiro, diasEstoque]);

  // Filtrar apenas itens que precisam comprar
  const itensParaComprar = listaCompras.filter(item => item.quantidadeComprar > 0);

  // Totais
  const totalEstimado = itensParaComprar.reduce((sum, item) => sum + item.custoEstimado, 0);
  const itensUrgentes = itensParaComprar.filter(item => item.urgente).length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatNumber = (value: number, decimals = 2) => {
    return value.toFixed(decimals);
  };

  const handleGerarLista = () => {
    setListaGerada(true);
    toast({ title: 'Lista gerada!', description: `${itensParaComprar.length} itens para comprar.` });
  };

  const handleCopiarLista = () => {
    const texto = itensParaComprar.map(item => 
      `${item.insumo.nome}: ${formatNumber(item.quantidadeComprar)} ${item.insumo.unidade_medida} - ${formatCurrency(item.custoEstimado)}`
    ).join('\n');
    
    navigator.clipboard.writeText(texto);
    toast({ title: 'Lista copiada!', description: 'A lista foi copiada para a área de transferência.' });
  };

  const handleImprimir = () => {
    window.print();
  };

  const isLoading = loadingInsumos || loadingFichas || loadingVendas;

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-6">
      {/* Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Configurar Lista de Compras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="periodo">Período para giro médio (dias)</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Quantos dias de vendas usar para calcular a média de consumo dos insumos.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="periodo"
                type="number"
                min="1"
                max="365"
                value={periodoGiro}
                onChange={(e) => setPeriodoGiro(Number(e.target.value) || 30)}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="dias-estoque">Dias de estoque desejado</Label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Para quantos dias você quer ter estoque após esta compra.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="dias-estoque"
                type="number"
                min="1"
                max="90"
                value={diasEstoque}
                onChange={(e) => setDiasEstoque(Number(e.target.value) || 7)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="data-compra">Data prevista da compra</Label>
              <Input
                id="data-compra"
                type="date"
                value={dataCompra}
                onChange={(e) => setDataCompra(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={handleGerarLista} className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Gerar Lista
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      {listaGerada && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Itens para comprar</p>
                  <p className="text-2xl font-bold">{itensParaComprar.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Itens urgentes</p>
                  <p className="text-2xl font-bold text-destructive">{itensUrgentes}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Custo estimado</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalEstimado)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data da compra</p>
                  <p className="text-lg font-bold">
                    {format(new Date(dataCompra + 'T12:00:00'), "dd 'de' MMM", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista */}
      {listaGerada && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Lista de Compras
              {itensParaComprar.length > 0 && (
                <Badge variant="secondary">{itensParaComprar.length} itens</Badge>
              )}
            </CardTitle>
            {itensParaComprar.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopiarLista} className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copiar
                </Button>
                <Button variant="outline" size="sm" onClick={handleImprimir} className="gap-2">
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {itensParaComprar.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insumo</TableHead>
                    <TableHead className="text-center">Unidade</TableHead>
                    <TableHead className="text-right">Consumo/dia</TableHead>
                    <TableHead className="text-right">Estoque atual</TableHead>
                    <TableHead className="text-right">Dias restantes</TableHead>
                    <TableHead className="text-right">Qtd. comprar</TableHead>
                    <TableHead className="text-right">Custo unit.</TableHead>
                    <TableHead className="text-right">Custo total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensParaComprar.map((item) => (
                    <TableRow key={item.insumo.id} className={item.urgente ? 'bg-destructive/5' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.urgente && (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          )}
                          <span className="font-medium">{item.insumo.nome}</span>
                          {item.urgente && (
                            <Badge variant="destructive" className="text-xs">Urgente</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{item.insumo.unidade_medida}</TableCell>
                      <TableCell className="text-right">
                        {item.consumoDiario > 0 ? formatNumber(item.consumoDiario) : '-'}
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(item.estoqueAtual)}</TableCell>
                      <TableCell className="text-right">
                        {item.diasEstoqueAtual === -1 ? (
                          <span className="text-muted-foreground">∞</span>
                        ) : item.diasEstoqueAtual < 3 ? (
                          <span className="text-destructive font-medium">{formatNumber(item.diasEstoqueAtual, 1)}</span>
                        ) : (
                          formatNumber(item.diasEstoqueAtual, 1)
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(item.quantidadeComprar)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(item.insumo.custo_unitario)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.custoEstimado)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">Estoque em dia!</h3>
                <p className="text-muted-foreground">
                  Com base no consumo dos últimos {periodoGiro} dias, seu estoque atual é suficiente para {diasEstoque} dias.
                </p>
              </div>
            )}

            {itensParaComprar.length > 0 && (
              <div className="mt-4 pt-4 border-t flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total estimado da compra</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(totalEstimado)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Estado vazio */}
      {!listaGerada && (
        <Card className="p-12 text-center">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Lista de Compras Inteligente</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-4">
            Configure o período de análise, quantos dias de estoque você quer ter, 
            e a data da compra. O sistema calculará automaticamente o que você precisa comprar 
            baseado no giro médio dos seus produtos.
          </p>
        </Card>
      )}
    </div>
  );
};

export default ListaCompras;
