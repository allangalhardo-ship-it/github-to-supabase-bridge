import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { formatCurrencyBRL } from '@/lib/format';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Info, Loader2, TrendingDown, DollarSign, Package } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExtratoPedido {
  numero_retirada: string;
  documento_id: string;
  data_pedido: string;
  horario: string;
  metodo_entrega: string;
  forma_pagamento: string;
  preco_itens: number;
  taxa_pedido_minimo: number;
  taxa_entrega_loja: number;
  investimento_loja_itens: number;
  contribuicao_99_itens: number;
  investimento_loja_logistica: number;
  contribuicao_99_logistica: number;
  investimento_loja_entrega: number;
  contribuicao_99_entrega: number;
  base_comissao: number;
  comissao_percentual: string;
  custos_comissao_distribuicao: number;
  recompensa_comissao: number;
  taxa_processamento: number;
  custos_logisticos: number;
  deducao_reembolso: number;
  ganhos_pedido: number;
  valor_cobranca: number;
  selected: boolean;
  isDuplicate?: boolean;
  duplicateReason?: string;
}

interface ItemVendido {
  nome: string;
  quantidade: number;
  data: string;
}

interface Props {
  onImportComplete?: () => void;
}

const parseDecimal = (val: unknown): number => {
  if (val === null || val === undefined || val === '') return 0;
  const str = String(val).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(str) || 0;
};

const Importar99FoodTab: React.FC<Props> = ({ onImportComplete }) => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [extratoFile, setExtratoFile] = useState<File | null>(null);
  const [itensFile, setItensFile] = useState<File | null>(null);
  const [pedidos, setPedidos] = useState<ExtratoPedido[]>([]);
  const [itensVendidos, setItensVendidos] = useState<ItemVendido[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [parsing, setParsing] = useState(false);

  const { data: canaisConfigurados } = useQuery({
    queryKey: ['canais-configurados-v2', usuario?.empresa_id],
    queryFn: async () => {
      const { data: canaisData, error: canaisError } = await supabase.from('canais_venda').select('*').eq('ativo', true);
      if (canaisError) throw canaisError;
      const { data: taxasData, error: taxasError } = await supabase.from('taxas_canais').select('*');
      if (taxasError) throw taxasError;
      return (canaisData || []).map(canal => {
        const taxas = (taxasData || []).filter(t => t.canal_id === canal.id);
        const taxaTotal = taxas.reduce((sum, t) => sum + Number(t.percentual), 0);
        return { ...canal, taxaTotal };
      });
    },
    enabled: !!usuario?.empresa_id,
  });

  const canal99 = canaisConfigurados?.find(c => {
    const n = c.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return n.includes('99') || n.includes('99food');
  });

  const parseExtrato = (workbook: XLSX.WorkBook): ExtratoPedido[] => {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false });
    
    return rows
      .filter(row => {
        const tipo = String(row['Tipo de documento'] || '');
        return tipo.includes('Ganhos') || tipo === '';
      })
      .map(row => {
        // Parse date
        let dataPedido = '';
        const rawDate = row['Data do pedido'];
        if (rawDate) {
          const parts = String(rawDate).split('/');
          if (parts.length === 3) {
            dataPedido = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else {
            try {
              const d = new Date(String(rawDate));
              if (!isNaN(d.getTime())) dataPedido = d.toISOString().split('T')[0];
            } catch { /* ignore */ }
          }
        }

        return {
          numero_retirada: String(row['Nº de retirada'] || ''),
          documento_id: String(row['Documento de identidade'] || ''),
          data_pedido: dataPedido,
          horario: String(row['Horário do pedido'] || ''),
          metodo_entrega: String(row['Método de entrega'] || ''),
          forma_pagamento: String(row['Forma de pagamento'] || ''),
          preco_itens: parseDecimal(row['Preço total dos itens sem as ofertas']),
          taxa_pedido_minimo: parseDecimal(row['Taxa de pedido mínimo']),
          taxa_entrega_loja: parseDecimal(row['Taxa de entrega da loja']),
          investimento_loja_itens: Math.abs(parseDecimal(row['Investimento da loja em itens em oferta'])),
          contribuicao_99_itens: Math.abs(parseDecimal(row['Contribuição 99 em itens em oferta'])),
          investimento_loja_logistica: Math.abs(parseDecimal(row['Investimento da loja em custos logísticos de ofertas'])),
          contribuicao_99_logistica: Math.abs(parseDecimal(row['Contribuição 99 em custos logísticos de ofertas'])),
          investimento_loja_entrega: Math.abs(parseDecimal(row['Investimento da loja em custos de entrega'])),
          contribuicao_99_entrega: Math.abs(parseDecimal(row['Contribuição 99 em custos de entrega'])),
          base_comissao: parseDecimal(row['Base da comissão']),
          comissao_percentual: String(row['Comissão do pedido'] || ''),
          custos_comissao_distribuicao: Math.abs(parseDecimal(row['Custos com comissão e distribuição'])),
          recompensa_comissao: Math.abs(parseDecimal(row['Recompensa de comissão (da 99) para a loja'])),
          taxa_processamento: Math.abs(parseDecimal(row['Taxa de processamento de pagamento'])),
          custos_logisticos: Math.abs(parseDecimal(row['Custos Logísticos'])),
          deducao_reembolso: Math.abs(parseDecimal(row['Valor da dedução/reembolso'])),
          ganhos_pedido: parseDecimal(row['Ganhos do pedido']),
          valor_cobranca: parseDecimal(row['Valor da cobrança']),
          selected: true,
          isDuplicate: false,
        };
      })
      .filter(p => p.data_pedido && p.preco_itens > 0);
  };

  const parseItens = (workbook: XLSX.WorkBook): ItemVendido[] => {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false });
    
    return rows
      .map(row => ({
        nome: String(row['Nome do item'] || ''),
        quantidade: parseInt(String(row['Volume de vendas do item'] || '0')) || 0,
        data: String(row['Data'] || ''),
      }))
      .filter(i => i.nome && i.quantidade > 0);
  };

  const checkDuplicates = async (orders: ExtratoPedido[]): Promise<ExtratoPedido[]> => {
    if (!usuario?.empresa_id) return orders;
    try {
      const { data: existing } = await supabase
        .from('vendas')
        .select('numero_pedido_externo, plataforma, data_venda, subtotal')
        .eq('empresa_id', usuario.empresa_id)
        .ilike('plataforma', '%99%');

      if (!existing || existing.length === 0) return orders;

      return orders.map(order => {
        const dup = existing.find(v =>
          v.numero_pedido_externo === order.numero_retirada ||
          (v.data_venda === order.data_pedido && Math.abs(Number(v.subtotal || 0) - order.preco_itens) < 0.01)
        );
        if (dup) {
          return { ...order, isDuplicate: true, duplicateReason: `Pedido ${order.numero_retirada} já importado`, selected: false };
        }
        return order;
      });
    } catch {
      return orders;
    }
  };

  const handleProcessFiles = async () => {
    if (!extratoFile) {
      toast({ title: 'Selecione o arquivo de extrato', variant: 'destructive' });
      return;
    }

    setParsing(true);
    try {
      // Parse extrato
      const extratoBuffer = await extratoFile.arrayBuffer();
      const extratoWb = XLSX.read(extratoBuffer, { type: 'array' });
      const orders = parseExtrato(extratoWb);

      if (orders.length === 0) {
        toast({ title: 'Nenhum pedido encontrado no extrato', description: 'Verifique se é o arquivo correto.', variant: 'destructive' });
        setParsing(false);
        return;
      }

      // Check duplicates
      const checkedOrders = await checkDuplicates(orders);
      setPedidos(checkedOrders);

      // Parse itens (optional)
      if (itensFile) {
        const itensBuffer = await itensFile.arrayBuffer();
        const itensWb = XLSX.read(itensBuffer, { type: 'array' });
        const items = parseItens(itensWb);
        setItensVendidos(items);
      }

      setStep('preview');
      const dupeCount = checkedOrders.filter(o => o.isDuplicate).length;
      toast({
        title: `${orders.length} pedido(s) encontrado(s)!`,
        description: dupeCount > 0 ? `⚠️ ${dupeCount} possível(is) duplicata(s) desmarcada(s).` : undefined,
      });
    } catch (error) {
      toast({ title: 'Erro ao processar arquivos', description: error instanceof Error ? error.message : 'Formato não reconhecido', variant: 'destructive' });
    } finally {
      setParsing(false);
    }
  };

  const selectedPedidos = pedidos.filter(p => p.selected);
  const totalSubtotal = selectedPedidos.reduce((s, p) => s + p.preco_itens, 0);
  const totalComissao = selectedPedidos.reduce((s, p) => s + p.custos_comissao_distribuicao, 0);
  const totalTaxaProc = selectedPedidos.reduce((s, p) => s + p.taxa_processamento, 0);
  const totalLogisticos = selectedPedidos.reduce((s, p) => s + p.custos_logisticos, 0);
  const totalInvestLoja = selectedPedidos.reduce((s, p) => s + p.investimento_loja_itens + p.investimento_loja_entrega + p.investimento_loja_logistica, 0);
  const totalGanhos = selectedPedidos.reduce((s, p) => s + p.ganhos_pedido, 0);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!usuario?.empresa_id || selectedPedidos.length === 0) throw new Error('Dados inválidos');

      const vendas = selectedPedidos.map(p => ({
        empresa_id: usuario.empresa_id,
        data_venda: p.data_pedido,
        valor_total: p.preco_itens + p.taxa_pedido_minimo,
        canal: canal99?.nome || '99Food',
        descricao_produto: `Pedido #${p.numero_retirada}`,
        quantidade: 1,
        origem: 'importacao_99food',
        tipo_venda: 'app',
        produto_id: null,
        cliente_id: null,
        numero_pedido_externo: p.numero_retirada,
        subtotal: p.preco_itens + p.taxa_pedido_minimo,
        taxa_entrega: p.investimento_loja_entrega,
        taxa_servico: p.taxa_processamento,
        incentivo_plataforma: p.contribuicao_99_itens + p.contribuicao_99_entrega + p.contribuicao_99_logistica,
        incentivo_loja: p.investimento_loja_itens + p.investimento_loja_logistica,
        comissao_plataforma: p.custos_comissao_distribuicao,
        valor_liquido: p.ganhos_pedido,
        plataforma: '99Food',
      }));

      const { error } = await supabase.from('vendas').insert(vendas);
      if (error) throw error;

      // Caixa movements
      const caixaMovimentos: any[] = [];

      for (const p of selectedPedidos) {
        // Entrada: ganhos do pedido (já líquido)
        if (p.ganhos_pedido > 0) {
          caixaMovimentos.push({
            empresa_id: usuario.empresa_id,
            tipo: 'entrada',
            categoria: 'Venda',
            descricao: `99Food #${p.numero_retirada} - Ganho líquido`,
            valor: p.ganhos_pedido,
            data_movimento: p.data_pedido,
            origem: 'importacao_99food',
          });
        }

        // Saída: comissão
        if (p.custos_comissao_distribuicao > 0) {
          caixaMovimentos.push({
            empresa_id: usuario.empresa_id,
            tipo: 'saida',
            categoria: 'Comissão App',
            descricao: `99Food #${p.numero_retirada} - Comissão (${p.comissao_percentual})`,
            valor: p.custos_comissao_distribuicao,
            data_movimento: p.data_pedido,
            origem: 'importacao_99food',
          });
        }

        // Saída: custos logísticos
        if (p.custos_logisticos > 0) {
          caixaMovimentos.push({
            empresa_id: usuario.empresa_id,
            tipo: 'saida',
            categoria: 'Taxas Plataforma',
            descricao: `99Food #${p.numero_retirada} - Custos logísticos`,
            valor: p.custos_logisticos,
            data_movimento: p.data_pedido,
            origem: 'importacao_99food',
          });
        }

        // Saída: taxa processamento
        if (p.taxa_processamento > 0) {
          caixaMovimentos.push({
            empresa_id: usuario.empresa_id,
            tipo: 'saida',
            categoria: 'Taxas Plataforma',
            descricao: `99Food #${p.numero_retirada} - Taxa processamento`,
            valor: p.taxa_processamento,
            data_movimento: p.data_pedido,
            origem: 'importacao_99food',
          });
        }

        // Saída: investimento loja entrega
        if (p.investimento_loja_entrega > 0) {
          caixaMovimentos.push({
            empresa_id: usuario.empresa_id,
            tipo: 'saida',
            categoria: 'Descontos/Promoções',
            descricao: `99Food #${p.numero_retirada} - Subsídio entrega (loja)`,
            valor: p.investimento_loja_entrega,
            data_movimento: p.data_pedido,
            origem: 'importacao_99food',
          });
        }
      }

      if (caixaMovimentos.length > 0) {
        await supabase.from('caixa_movimentos').insert(caixaMovimentos);
      }

      return selectedPedidos.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      queryClient.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      toast({ title: `${count} pedidos importados da 99Food!` });
      onImportComplete?.();
    },
    onError: (error) => {
      toast({ title: 'Erro na importação', description: error.message, variant: 'destructive' });
    },
  });

  if (step === 'upload') {
    return (
      <div className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Info className="h-4 w-4" />
            Como importar da 99Food
          </h4>
          <p className="text-sm text-muted-foreground">
            A 99Food exporta os dados em dois arquivos separados. O <strong>Extrato</strong> (obrigatório) contém os dados financeiros de cada pedido. O arquivo de <strong>Itens</strong> (opcional) mostra quais produtos foram vendidos.
          </p>
        </div>

        <div className="space-y-3">
          <div className="border-2 border-dashed rounded-lg p-5">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <Label className="text-sm font-medium">Extrato Financeiro</Label>
                <span className="ml-2 text-xs text-destructive font-medium">Obrigatório</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Arquivo com colunas como "Ganhos do pedido", "Comissão do pedido", etc.
            </p>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setExtratoFile(e.target.files?.[0] || null)}
              className="max-w-sm"
            />
            {extratoFile && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {extratoFile.name}
              </p>
            )}
          </div>

          <div className="border-2 border-dashed rounded-lg p-5">
            <div className="flex items-center gap-3 mb-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Dados dos Itens</Label>
                <span className="ml-2 text-xs text-muted-foreground font-medium">Opcional</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Arquivo com "Nome do item" e "Volume de vendas do item". Usado para referência.
            </p>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setItensFile(e.target.files?.[0] || null)}
              className="max-w-sm"
            />
            {itensFile && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {itensFile.name}
              </p>
            )}
          </div>
        </div>

        <Button onClick={handleProcessFiles} disabled={!extratoFile || parsing} className="w-full">
          {parsing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" />Processar Arquivos</>
          )}
        </Button>
      </div>
    );
  }

  // Preview step
  return (
    <div className="space-y-4">
      {/* Financial summary */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 font-medium">
          <DollarSign className="h-4 w-4" />
          Resumo Financeiro ({selectedPedidos.length} pedido{selectedPedidos.length !== 1 ? 's' : ''})
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Subtotal itens</p>
            <p className="font-semibold">{formatCurrencyBRL(totalSubtotal)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />Comissão
            </p>
            <p className="font-semibold text-destructive">-{formatCurrencyBRL(totalComissao)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Taxa processamento</p>
            <p className="font-semibold text-destructive">-{formatCurrencyBRL(totalTaxaProc)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Custos logísticos</p>
            <p className="font-semibold text-destructive">-{formatCurrencyBRL(totalLogisticos)}</p>
          </div>
          {totalInvestLoja > 0 && (
            <div>
              <p className="text-muted-foreground text-xs">Investimento loja</p>
              <p className="font-semibold text-destructive">-{formatCurrencyBRL(totalInvestLoja)}</p>
            </div>
          )}
          <div className="col-span-2 sm:col-span-1 border-t pt-2 sm:border-t-0 sm:pt-0">
            <p className="text-muted-foreground text-xs font-medium">💰 Ganho líquido</p>
            <p className="font-bold text-lg text-primary">{formatCurrencyBRL(totalGanhos)}</p>
          </div>
        </div>
      </div>

      {/* Items summary */}
      {itensVendidos.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Itens vendidos no período
          </p>
          <div className="flex flex-wrap gap-2">
            {itensVendidos.map((item, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {item.quantidade}x {item.nome}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Orders table */}
      <ScrollArea className="max-h-[300px] border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={pedidos.every(p => p.selected || p.isDuplicate)}
                  onCheckedChange={(checked) =>
                    setPedidos(prev => prev.map(p => ({ ...p, selected: p.isDuplicate ? false : !!checked })))
                  }
                />
              </TableHead>
              <TableHead className="text-xs">Pedido</TableHead>
              <TableHead className="text-xs">Data/Hora</TableHead>
              <TableHead className="text-xs text-right">Subtotal</TableHead>
              <TableHead className="text-xs text-right">Comissão</TableHead>
              <TableHead className="text-xs text-right">Líquido</TableHead>
              <TableHead className="text-xs w-10">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidos.map((p, i) => (
              <TableRow key={i} className={`${!p.selected ? 'opacity-50' : ''} ${p.isDuplicate ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                <TableCell>
                  <Checkbox
                    checked={p.selected}
                    onCheckedChange={() => setPedidos(prev => prev.map((pp, ii) => ii === i ? { ...pp, selected: !pp.selected } : pp))}
                    disabled={p.isDuplicate}
                  />
                </TableCell>
                <TableCell className="text-xs font-mono">#{p.numero_retirada}</TableCell>
                <TableCell className="text-xs">{p.data_pedido} {p.horario}</TableCell>
                <TableCell className="text-xs text-right">{formatCurrencyBRL(p.preco_itens)}</TableCell>
                <TableCell className="text-xs text-right text-destructive">
                  -{formatCurrencyBRL(p.custos_comissao_distribuicao)}
                  <span className="text-muted-foreground ml-1">({p.comissao_percentual})</span>
                </TableCell>
                <TableCell className="text-xs text-right font-medium">{formatCurrencyBRL(p.ganhos_pedido)}</TableCell>
                <TableCell>
                  {p.isDuplicate ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="text-amber-600 text-[10px]">
                          <AlertTriangle className="h-3 w-3" />
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent><p>{p.duplicateReason}</p></TooltipContent>
                    </Tooltip>
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div>
          <span className="text-sm font-medium">Líquido: </span>
          <span className="text-lg font-bold text-primary">{formatCurrencyBRL(totalGanhos)}</span>
          <span className="text-sm text-muted-foreground ml-2">({selectedPedidos.length} pedidos)</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setStep('upload'); setPedidos([]); setItensVendidos([]); }}>
            Voltar
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending || selectedPedidos.length === 0}
          >
            {importMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importando...</>
            ) : (
              `Importar ${selectedPedidos.length} pedidos`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Importar99FoodTab;
