import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2, HelpCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  downloadTemplate,
  parseExcelFile,
  FICHA_TECNICA_TEMPLATE,
  normalizeString,
  findBestMatch,
} from '@/lib/importUtils';

interface ImportFichaTecnicaData {
  produto_nome: string;
  insumo_nome: string;
  quantidade: string;
  unidade: string;
}

interface Produto {
  id: string;
  nome: string;
}

interface Insumo {
  id: string;
  nome: string;
  unidade_medida: string;
}

interface ParsedFichaTecnica extends ImportFichaTecnicaData {
  produtoMatch?: Produto;
  produtoMatchScore?: number;
  insumoMatch?: Insumo;
  insumoMatchScore?: number;
  selectedProdutoId?: string;
  selectedInsumoId?: string;
  status: 'matched' | 'partial' | 'unmatched' | 'error';
  message?: string;
}

interface ImportFichaTecnicaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ImportFichaTecnicaDialog = ({ 
  open, 
  onOpenChange, 
}: ImportFichaTecnicaDialogProps) => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing produtos
  const { data: existingProdutos = [] } = useQuery({
    queryKey: ['produtos', usuario?.empresa_id],
    queryFn: async () => {
      if (!usuario?.empresa_id) return [];
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome')
        .eq('empresa_id', usuario.empresa_id)
        .order('nome');
      if (error) throw error;
      return data as Produto[];
    },
    enabled: !!usuario?.empresa_id && open,
  });

  // Fetch existing insumos
  const { data: existingInsumos = [] } = useQuery({
    queryKey: ['insumos', usuario?.empresa_id],
    queryFn: async () => {
      if (!usuario?.empresa_id) return [];
      const { data, error } = await supabase
        .from('insumos')
        .select('id, nome, unidade_medida')
        .eq('empresa_id', usuario.empresa_id)
        .order('nome');
      if (error) throw error;
      return data as Insumo[];
    },
    enabled: !!usuario?.empresa_id && open,
  });
  const [step, setStep] = useState<'upload' | 'review' | 'importing'>('upload');
  const [parsedData, setParsedData] = useState<ParsedFichaTecnica[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const handleDownloadTemplate = () => {
    downloadTemplate(FICHA_TECNICA_TEMPLATE, 'modelo_ficha_tecnica', 'Ficha Técnica');
    toast({ title: 'Template baixado!', description: 'Preencha a planilha e importe novamente.' });
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { data, errors } = await parseExcelFile<ImportFichaTecnicaData>(file, FICHA_TECNICA_TEMPLATE);
      
      // Match products and insumos
      const processedData: ParsedFichaTecnica[] = data.map(item => {
        // Match produto
        const produtoMatch = findBestMatch(item.produto_nome, existingProdutos);
        
        // Match insumo
        const insumoMatch = findBestMatch(item.insumo_nome, existingInsumos);

        // Validate quantity
        const quantidade = parseFloat(item.quantidade);
        if (isNaN(quantidade) || quantidade <= 0) {
          return {
            ...item,
            status: 'error' as const,
            message: 'Quantidade inválida',
          };
        }

        // Determine status
        let status: 'matched' | 'partial' | 'unmatched' | 'error' = 'unmatched';
        
        if (produtoMatch && produtoMatch.score >= 80 && insumoMatch && insumoMatch.score >= 80) {
          status = 'matched';
        } else if (produtoMatch || insumoMatch) {
          status = 'partial';
        }

        return {
          ...item,
          produtoMatch: produtoMatch?.item,
          produtoMatchScore: produtoMatch?.score,
          insumoMatch: insumoMatch?.item,
          insumoMatchScore: insumoMatch?.score,
          selectedProdutoId: produtoMatch?.item?.id,
          selectedInsumoId: insumoMatch?.item?.id,
          status,
        };
      });

      setParsedData(processedData);
      setParseErrors(errors);
      setStep('review');
    } catch (error) {
      toast({
        title: 'Erro ao ler arquivo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }

    // Reset input
    e.target.value = '';
  }, [existingProdutos, existingInsumos, toast]);

  const handleProdutoChange = (index: number, produtoId: string) => {
    setParsedData(prev => prev.map((item, i) => {
      if (i !== index) return item;
      
      const produto = existingProdutos.find(p => p.id === produtoId);
      const hasInsumo = !!item.selectedInsumoId;
      
      return {
        ...item,
        selectedProdutoId: produtoId,
        produtoMatch: produto,
        status: produtoId && hasInsumo ? 'matched' : (produtoId || hasInsumo ? 'partial' : 'unmatched'),
      };
    }));
  };

  const handleInsumoChange = (index: number, insumoId: string) => {
    setParsedData(prev => prev.map((item, i) => {
      if (i !== index) return item;
      
      const insumo = existingInsumos.find(ins => ins.id === insumoId);
      const hasProduto = !!item.selectedProdutoId;
      
      return {
        ...item,
        selectedInsumoId: insumoId,
        insumoMatch: insumo,
        status: insumoId && hasProduto ? 'matched' : (insumoId || hasProduto ? 'partial' : 'unmatched'),
      };
    }));
  };

  const handleImport = async () => {
    const validItems = parsedData.filter(
      item => item.status === 'matched' && item.selectedProdutoId && item.selectedInsumoId
    );
    
    if (validItems.length === 0) {
      toast({ title: 'Nenhum item válido para importar', variant: 'destructive' });
      return;
    }

    setIsImporting(true);
    setStep('importing');

    try {
      // Group by produto to handle batch inserts
      const insertData = validItems.map(item => ({
        produto_id: item.selectedProdutoId!,
        insumo_id: item.selectedInsumoId!,
        quantidade: parseFloat(item.quantidade) || 0,
      }));

      // Check for existing entries to avoid duplicates
      const { data: existingFichas } = await supabase
        .from('fichas_tecnicas')
        .select('produto_id, insumo_id')
        .in('produto_id', [...new Set(insertData.map(i => i.produto_id))]);

      const existingSet = new Set(
        (existingFichas || []).map(f => `${f.produto_id}-${f.insumo_id}`)
      );

      const newItems = insertData.filter(
        item => !existingSet.has(`${item.produto_id}-${item.insumo_id}`)
      );

      if (newItems.length === 0) {
        toast({ 
          title: 'Nenhum item novo para importar', 
          description: 'Todos os itens já existem nas fichas técnicas.',
          variant: 'destructive' 
        });
        setStep('review');
        setIsImporting(false);
        return;
      }

      const { error } = await supabase.from('fichas_tecnicas').insert(newItems);

      if (error) throw error;

      toast({ 
        title: 'Importação concluída!', 
        description: `${newItems.length} itens importados para fichas técnicas.` 
      });
      
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['fichas-tecnicas'] });
      handleClose();
    } catch (error) {
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setStep('review');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setParsedData([]);
    setParseErrors([]);
    onOpenChange(false);
  };

  const matchedCount = parsedData.filter(i => i.status === 'matched').length;
  const partialCount = parsedData.filter(i => i.status === 'partial').length;
  const unmatchedCount = parsedData.filter(i => i.status === 'unmatched').length;
  const errorCount = parsedData.filter(i => i.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Fichas Técnicas
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Baixe o modelo, preencha e importe sua planilha'}
            {step === 'review' && 'Revise e ajuste as associações antes de importar'}
            {step === 'importing' && 'Importando fichas técnicas...'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6 py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="outline" className="flex-1" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Baixar Modelo
              </Button>
              
              <div className="flex-1">
                <Label htmlFor="file-upload-fichas" className="cursor-pointer">
                  <div className="flex items-center justify-center gap-2 h-10 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors">
                    <Upload className="h-4 w-4" />
                    Enviar Planilha
                  </div>
                </Label>
                <Input
                  id="file-upload-fichas"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            <Alert>
              <HelpCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Como funciona:</strong> O sistema tentará associar automaticamente 
                os produtos e insumos pelo nome. Na próxima tela você poderá revisar 
                e ajustar as associações antes de importar.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {step === 'review' && (
          <>
            {parseErrors.length > 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Erros encontrados:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {parseErrors.slice(0, 3).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {parseErrors.length > 3 && (
                      <li>...e mais {parseErrors.length - 3} erros</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {matchedCount} prontos
              </Badge>
              {partialCount > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {partialCount} parciais
                </Badge>
              )}
              {unmatchedCount > 0 && (
                <Badge variant="secondary">
                  <HelpCircle className="h-3 w-3 mr-1" />
                  {unmatchedCount} sem match
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  {errorCount} com erro
                </Badge>
              )}
            </div>

            <div className="flex-1 overflow-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Status</TableHead>
                    <TableHead>Produto (Planilha)</TableHead>
                    <TableHead>Associar a</TableHead>
                    <TableHead>Insumo (Planilha)</TableHead>
                    <TableHead>Associar a</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {item.status === 'matched' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {item.status === 'partial' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                        {item.status === 'unmatched' && <HelpCircle className="h-4 w-4 text-muted-foreground" />}
                        {item.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.produto_nome}
                        {item.produtoMatchScore && item.produtoMatchScore < 100 && (
                          <span className="text-xs text-muted-foreground block">
                            Match: {item.produtoMatchScore.toFixed(0)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.selectedProdutoId || ''}
                          onValueChange={(v) => handleProdutoChange(index, v)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {existingProdutos.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.insumo_nome}
                        {item.insumoMatchScore && item.insumoMatchScore < 100 && (
                          <span className="text-xs text-muted-foreground block">
                            Match: {item.insumoMatchScore.toFixed(0)}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.selectedInsumoId || ''}
                          onValueChange={(v) => handleInsumoChange(index, v)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {existingInsumos.map(i => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.nome} ({i.unidade_medida})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantidade} {item.unidade}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleImport} disabled={matchedCount === 0}>
                Importar {matchedCount} Itens
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Importando fichas técnicas...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportFichaTecnicaDialog;
