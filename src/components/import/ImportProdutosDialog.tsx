import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  downloadTemplate,
  parseExcelFile,
  PRODUTOS_TEMPLATE,
  normalizeString,
} from '@/lib/importUtils';

interface ImportProdutoData {
  nome: string;
  categoria: string;
  preco_venda: string;
}

interface ParsedProduto extends ImportProdutoData {
  status: 'valid' | 'duplicate' | 'error';
  message?: string;
  existingId?: string;
}

interface ImportProdutosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProdutos: { id: string; nome: string }[];
}

const ImportProdutosDialog = ({ open, onOpenChange, existingProdutos }: ImportProdutosDialogProps) => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<'upload' | 'review' | 'importing'>('upload');
  const [parsedData, setParsedData] = useState<ParsedProduto[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const handleDownloadTemplate = () => {
    downloadTemplate(PRODUTOS_TEMPLATE, 'modelo_produtos', 'Produtos');
    toast({ title: 'Template baixado!', description: 'Preencha a planilha e importe novamente.' });
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { data, errors } = await parseExcelFile<ImportProdutoData>(file, PRODUTOS_TEMPLATE);
      
      // Check for duplicates
      const processedData: ParsedProduto[] = data.map(item => {
        const normalizedName = normalizeString(item.nome);
        const existing = existingProdutos.find(
          p => normalizeString(p.nome) === normalizedName
        );

        if (existing) {
          return {
            ...item,
            status: 'duplicate' as const,
            message: 'Já existe um produto com este nome',
            existingId: existing.id,
          };
        }

        // Validate numeric fields
        const preco = parseFloat(item.preco_venda);
        if (isNaN(preco) || preco < 0) {
          return {
            ...item,
            status: 'error' as const,
            message: 'Preço de venda inválido',
          };
        }

        return {
          ...item,
          status: 'valid' as const,
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
  }, [existingProdutos, toast]);

  const handleImport = async () => {
    const validItems = parsedData.filter(item => item.status === 'valid');
    
    if (validItems.length === 0) {
      toast({ title: 'Nenhum item válido para importar', variant: 'destructive' });
      return;
    }

    setIsImporting(true);
    setStep('importing');

    try {
      const insertData = validItems.map(item => ({
        empresa_id: usuario!.empresa_id,
        nome: item.nome,
        categoria: item.categoria || null,
        preco_venda: parseFloat(item.preco_venda) || 0,
        ativo: true,
      }));

      const { error } = await supabase.from('produtos').insert(insertData);

      if (error) throw error;

      toast({ 
        title: 'Importação concluída!', 
        description: `${validItems.length} produtos importados com sucesso.` 
      });
      
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
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

  const validCount = parsedData.filter(i => i.status === 'valid').length;
  const duplicateCount = parsedData.filter(i => i.status === 'duplicate').length;
  const errorCount = parsedData.filter(i => i.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Produtos
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Baixe o modelo, preencha e importe sua planilha'}
            {step === 'review' && 'Revise os dados antes de importar'}
            {step === 'importing' && 'Importando produtos...'}
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
                <Label htmlFor="file-upload-produtos" className="cursor-pointer">
                  <div className="flex items-center justify-center gap-2 h-10 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors">
                    <Upload className="h-4 w-4" />
                    Enviar Planilha
                  </div>
                </Label>
                <Input
                  id="file-upload-produtos"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Dica:</strong> O modelo já vem com um exemplo preenchido. 
                Substitua pelo seus dados mantendo o formato das colunas.
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
                    {parseErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {parseErrors.length > 5 && (
                      <li>...e mais {parseErrors.length - 5} erros</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4 mb-4">
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {validCount} válidos
              </Badge>
              {duplicateCount > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {duplicateCount} duplicados
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((item, index) => (
                    <TableRow key={index} className={item.status !== 'valid' ? 'opacity-60' : ''}>
                      <TableCell>
                        {item.status === 'valid' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {item.status === 'duplicate' && (
                          <span title={item.message}>
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span title={item.message}>
                            <XCircle className="h-4 w-4 text-red-500" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.nome}
                        {item.message && (
                          <span className="block text-xs text-muted-foreground">{item.message}</span>
                        )}
                      </TableCell>
                      <TableCell>{item.categoria || '-'}</TableCell>
                      <TableCell className="text-right">R$ {parseFloat(item.preco_venda || '0').toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                Importar {validCount} Produtos
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Importando produtos...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportProdutosDialog;
