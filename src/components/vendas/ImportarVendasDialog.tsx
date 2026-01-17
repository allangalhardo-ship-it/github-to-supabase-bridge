import React, { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, AlertTriangle, Camera, ImageIcon, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { isNativePlatform, takePictureNative, pickImageNative } from '@/lib/cameraUtils';

interface ParsedRow {
  data: string;
  valor: number;
  canal: string;
  status: string;
  descricao?: string;
  selected: boolean;
  raw: Record<string, unknown>;
  isDuplicate?: boolean;
}

interface ColumnMapping {
  data: string;
  valor: string;
  canal: string;
  status: string;
  descricao: string;
}

// Mapeamentos conhecidos para diferentes plataformas
const KNOWN_MAPPINGS: Record<string, Partial<ColumnMapping>> = {
  ifood: {
    data: 'DATA E HORA DO PEDIDO',
    valor: 'VALOR LIQUIDO (R$)',
    canal: 'CANAL DE VENDA',
    status: 'STATUS FINAL DO PEDIDO',
    descricao: 'ID CURTO DO PEDIDO',
  },
  ifood_alt: {
    data: 'Data do Pedido',
    valor: 'Valor Líquido',
    canal: 'Canal',
    status: 'Status',
  },
  rappi: {
    data: 'Fecha',
    valor: 'Total',
    canal: 'Canal',
    status: 'Estado',
  },
  generic: {
    data: 'data',
    valor: 'valor',
    canal: 'canal',
    status: 'status',
  },
};

const STATUS_CONCLUIDO = ['concluído', 'concluido', 'completed', 'entregue', 'finalizado', 'delivered'];

const ImportarVendasDialog: React.FC = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    data: '',
    valor: '',
    canal: '',
    status: '',
    descricao: '',
  });
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [canalOverride, setCanalOverride] = useState('');
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  
  // Estados para importação por foto
  const [importMethod, setImportMethod] = useState<'csv' | 'foto'>('csv');
  const [filePreview, setFilePreview] = useState<{ url: string; name: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Fetch apps cadastrados
  const { data: taxasApps } = useQuery({
    queryKey: ['taxas_apps', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taxas_apps')
        .select('nome_app')
        .eq('ativo', true)
        .order('nome_app');
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id && open,
  });

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRawData([]);
    setMapping({ data: '', valor: '', canal: '', status: '', descricao: '' });
    setParsedRows([]);
    setCanalOverride('');
    setDuplicateCount(0);
    setCheckingDuplicates(false);
    setImportMethod('csv');
    setFilePreview(null);
    setSelectedFile(null);
    setIsProcessingAI(false);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // Funções para importação por foto
  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setFilePreview({ url: reader.result as string, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const clearFilePreview = () => {
    setFilePreview(null);
    setSelectedFile(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const processImageWithAI = async () => {
    if (!selectedFile && !filePreview) return;

    setIsProcessingAI(true);
    try {
      let base64 = filePreview?.url;
      
      if (selectedFile && !base64) {
        base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(selectedFile);
        });
      }

      const { data, error } = await supabase.functions.invoke('process-sales-image', {
        body: { content: base64 }
      });

      if (error) throw error;

      if (data.success && data.data?.itens?.length > 0) {
        // Converter para o formato ParsedRow
        const rows: ParsedRow[] = data.data.itens.map((item: any) => ({
          data: item.data || '',
          valor: parseFloat(item.valor) || 0,
          canal: item.canal || data.data.plataforma || '',
          status: item.status || 'Concluído',
          descricao: item.descricao || '',
          selected: (item.data || '') !== '' && (parseFloat(item.valor) || 0) > 0,
          raw: item,
          isDuplicate: false,
        }));

        // Verificar duplicatas
        const checkedRows = await checkDuplicates(rows);
        setParsedRows(checkedRows);
        setFileName(`Foto: ${data.data.plataforma || 'Relatório de Vendas'}`);
        
        if (data.data.plataforma) {
          setCanalOverride(data.data.plataforma);
        }
        
        setStep('preview');
        toast({ 
          title: 'Imagem processada!', 
          description: `${rows.length} vendas encontradas.` 
        });
        clearFilePreview();
      } else {
        toast({
          title: 'Erro ao processar imagem',
          description: data.message || 'Não foi possível extrair dados de vendas.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao processar imagem com IA.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Verificar duplicatas no banco de dados
  const checkDuplicates = async (rows: ParsedRow[]) => {
    if (!usuario?.empresa_id) return rows;
    
    setCheckingDuplicates(true);
    try {
      // Buscar vendas existentes da empresa
      const { data: existingVendas, error } = await supabase
        .from('vendas')
        .select('data_venda, valor_total, canal, descricao_produto')
        .eq('empresa_id', usuario.empresa_id);
      
      if (error) throw error;
      
      // Criar um Set com chaves únicas das vendas existentes
      const existingKeys = new Set(
        (existingVendas || []).map(v => 
          `${v.data_venda}|${v.valor_total}|${(v.canal || '').toLowerCase()}|${(v.descricao_produto || '').toLowerCase()}`
        )
      );
      
      let dupes = 0;
      const checkedRows = rows.map(row => {
        const key = `${row.data}|${row.valor}|${(row.canal || '').toLowerCase()}|${(row.descricao || '').toLowerCase()}`;
        const isDuplicate = existingKeys.has(key);
        if (isDuplicate) dupes++;
        
        return {
          ...row,
          isDuplicate,
          selected: row.selected && !isDuplicate, // Desmarcar duplicatas
        };
      });
      
      setDuplicateCount(dupes);
      return checkedRows;
    } catch (error) {
      console.error('Erro ao verificar duplicatas:', error);
      return rows;
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const detectMapping = useCallback((headers: string[]) => {
    const headerLower = headers.map(h => h.toLowerCase().trim());
    
    // Tentar cada mapeamento conhecido
    for (const [, knownMapping] of Object.entries(KNOWN_MAPPINGS)) {
      const matches: Partial<ColumnMapping> = {};
      let matchCount = 0;
      
      for (const [field, expectedHeader] of Object.entries(knownMapping)) {
        const idx = headers.findIndex(h => 
          h.toLowerCase().trim() === (expectedHeader as string).toLowerCase().trim() ||
          h.toLowerCase().includes((expectedHeader as string).toLowerCase())
        );
        if (idx !== -1) {
          matches[field as keyof ColumnMapping] = headers[idx];
          matchCount++;
        }
      }
      
      if (matchCount >= 2) {
        return matches as ColumnMapping;
      }
    }
    
    // Detecção genérica por palavras-chave
    const detected: Partial<ColumnMapping> = {};
    
    for (let i = 0; i < headers.length; i++) {
      const h = headerLower[i];
      if (!detected.data && (h.includes('data') || h.includes('date') || h.includes('fecha'))) {
        detected.data = headers[i];
      }
      if (!detected.valor && (h.includes('valor') || h.includes('total') || h.includes('liquido') || h.includes('value'))) {
        detected.valor = headers[i];
      }
      if (!detected.canal && (h.includes('canal') || h.includes('channel') || h.includes('plataforma'))) {
        detected.canal = headers[i];
      }
      if (!detected.status && (h.includes('status') || h.includes('estado') || h.includes('situação'))) {
        detected.status = headers[i];
      }
      if (!detected.descricao && (h.includes('pedido') || h.includes('order') || h.includes('id'))) {
        detected.descricao = headers[i];
      }
    }
    
    return detected as ColumnMapping;
  }, []);

  const parseFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { raw: false });
      
      if (jsonData.length === 0) {
        throw new Error('Arquivo vazio ou formato não reconhecido');
      }
      
      const fileHeaders = Object.keys(jsonData[0]);
      setHeaders(fileHeaders);
      setRawData(jsonData);
      setFileName(file.name);
      
      // Detectar mapeamento automaticamente
      const detectedMapping = detectMapping(fileHeaders);
      setMapping(prev => ({ ...prev, ...detectedMapping }));
      
      // Se detectou data e valor, pular para preview
      if (detectedMapping.data && detectedMapping.valor) {
        setStep('preview');
        processData(jsonData, detectedMapping);
      } else {
        setStep('mapping');
      }
      
      toast({ title: `Arquivo carregado: ${jsonData.length} linhas encontradas` });
    } catch (error) {
      toast({ 
        title: 'Erro ao ler arquivo', 
        description: error instanceof Error ? error.message : 'Formato não suportado',
        variant: 'destructive' 
      });
    }
  };

  const processData = (data: Record<string, unknown>[], currentMapping: ColumnMapping) => {
    const rows: ParsedRow[] = data.map(row => {
      // Parsear data
      let dataStr = '';
      const rawDate = row[currentMapping.data];
      if (rawDate) {
        try {
          // Tentar diferentes formatos
          const dateValue = rawDate instanceof Date ? rawDate : new Date(String(rawDate));
          if (!isNaN(dateValue.getTime())) {
            dataStr = dateValue.toISOString().split('T')[0];
          } else {
            // Tentar formato brasileiro DD/MM/YYYY
            const parts = String(rawDate).split(/[\/\-]/);
            if (parts.length === 3) {
              const [d, m, y] = parts;
              dataStr = `${y.length === 4 ? y : '20' + y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          }
        } catch {
          dataStr = '';
        }
      }
      
      // Parsear valor
      let valor = 0;
      const rawValor = row[currentMapping.valor];
      if (rawValor) {
        // Remover R$, espaços e converter vírgula para ponto
        const cleanValue = String(rawValor)
          .replace(/[R$\s]/g, '')
          .replace(/\./g, '')
          .replace(',', '.');
        valor = parseFloat(cleanValue) || 0;
      }
      
      // Canal
      const canal = currentMapping.canal ? String(row[currentMapping.canal] || '') : '';
      
      // Status
      const status = currentMapping.status ? String(row[currentMapping.status] || '') : 'Concluído';
      
      // Descrição
      const descricao = currentMapping.descricao ? String(row[currentMapping.descricao] || '') : '';
      
      // Só selecionar se for status concluído
      const isConcluido = !currentMapping.status || 
        STATUS_CONCLUIDO.some(s => status.toLowerCase().includes(s));
      
      return {
        data: dataStr,
        valor,
        canal,
        status,
        descricao,
        selected: isConcluido && dataStr !== '' && valor > 0,
        raw: row,
        isDuplicate: false,
      };
    });
    
    // Verificar duplicatas de forma assíncrona
    checkDuplicates(rows).then(checkedRows => {
      setParsedRows(checkedRows);
    });
    
    // Definir rows inicialmente para exibição rápida
    setParsedRows(rows);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
  };

  const handleMappingConfirm = () => {
    if (!mapping.data || !mapping.valor) {
      toast({ title: 'Selecione pelo menos Data e Valor', variant: 'destructive' });
      return;
    }
    processData(rawData, mapping);
    setStep('preview');
  };

  const toggleSelectAll = (checked: boolean) => {
    setParsedRows(prev => prev.map(row => ({ 
      ...row, 
      selected: checked && !row.isDuplicate // Não selecionar duplicatas
    })));
  };

  const toggleRow = (index: number) => {
    setParsedRows(prev => prev.map((row, i) => 
      i === index ? { ...row, selected: !row.selected } : row
    ));
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const selectedRows = parsedRows.filter(r => r.selected);
      if (selectedRows.length === 0) {
        throw new Error('Nenhuma linha selecionada');
      }

      const vendas = selectedRows.map(row => ({
        empresa_id: usuario!.empresa_id,
        data_venda: row.data,
        valor_total: row.valor,
        canal: canalOverride || row.canal || 'App',
        descricao_produto: row.descricao || null,
        quantidade: 1,
        origem: 'importacao',
        tipo_venda: 'app',
        produto_id: null,
        cliente_id: null,
      }));

      const { error } = await supabase.from('vendas').insert(vendas);
      if (error) throw error;
      
      return selectedRows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      toast({ title: `${count} vendas importadas com sucesso!` });
      setOpen(false);
      resetState();
    },
    onError: (error) => {
      toast({ title: 'Erro na importação', description: error.message, variant: 'destructive' });
    },
  });

  const selectedCount = parsedRows.filter(r => r.selected).length;
  const totalValor = parsedRows.filter(r => r.selected).reduce((sum, r) => sum + r.valor, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Relatório de Vendas
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <Tabs value={importMethod} onValueChange={(v) => setImportMethod(v as 'csv' | 'foto')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="csv" className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV/Excel
                </TabsTrigger>
                <TabsTrigger value="foto" className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Foto
                </TabsTrigger>
              </TabsList>

              <TabsContent value="csv" className="mt-4 space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Arraste ou selecione um arquivo</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Suporta arquivos Excel (.xlsx, .xls) e CSV do iFood, Rappi, 99Food e outros
                  </p>
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="max-w-xs mx-auto"
                  />
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Como exportar do iFood:
                  </h4>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
                    <li>Acesse o Portal do Parceiro iFood</li>
                    <li>Vá em Pedidos no menu lateral</li>
                    <li>Selecione o período desejado</li>
                    <li>Clique em "Exportar" → "Gerar Relatório"</li>
                    <li>O arquivo XLS será enviado para seu e-mail</li>
                  </ol>
                </div>
              </TabsContent>

              <TabsContent value="foto" className="mt-4 space-y-4">
                {!filePreview ? (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-lg font-medium mb-2">Tire uma foto ou selecione uma imagem</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        A IA extrairá automaticamente os dados de vendas da imagem
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                        {isNativePlatform() ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1"
                              disabled={isProcessingAI}
                              onClick={async () => {
                                try {
                                  const base64 = await takePictureNative();
                                  if (base64) {
                                    setFilePreview({ url: base64, name: 'camera-photo.jpg' });
                                    const blob = await fetch(base64).then(r => r.blob());
                                    const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
                                    setSelectedFile(file);
                                  }
                                } catch (error: any) {
                                  if (error.message !== 'User cancelled photos app') {
                                    toast({
                                      title: 'Erro',
                                      description: 'Não foi possível acessar a câmera.',
                                      variant: 'destructive',
                                    });
                                  }
                                }
                              }}
                            >
                              <Camera className="h-4 w-4 mr-2" />
                              Tirar Foto
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1"
                              disabled={isProcessingAI}
                              onClick={async () => {
                                try {
                                  const base64 = await pickImageNative();
                                  if (base64) {
                                    setFilePreview({ url: base64, name: 'gallery-photo.jpg' });
                                    const blob = await fetch(base64).then(r => r.blob());
                                    const file = new File([blob], 'gallery-photo.jpg', { type: 'image/jpeg' });
                                    setSelectedFile(file);
                                  }
                                } catch (error: any) {
                                  if (error.message !== 'User cancelled photos app') {
                                    toast({
                                      title: 'Erro',
                                      description: 'Não foi possível acessar a galeria.',
                                      variant: 'destructive',
                                    });
                                  }
                                }
                              }}
                            >
                              <ImageIcon className="h-4 w-4 mr-2" />
                              Galeria
                            </Button>
                          </>
                        ) : (
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleImageFileSelect}
                              disabled={isProcessingAI}
                              className="hidden"
                              id="camera-input-sales"
                            />
                            <label htmlFor="camera-input-sales" className="flex-1">
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full cursor-pointer"
                                disabled={isProcessingAI}
                                asChild
                              >
                                <span>
                                  <Camera className="h-4 w-4 mr-2" />
                                  Tirar Foto
                                </span>
                              </Button>
                            </label>
                            <input
                              ref={imageInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleImageFileSelect}
                              disabled={isProcessingAI}
                              className="hidden"
                              id="file-input-sales"
                            />
                            <label htmlFor="file-input-sales" className="flex-1">
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full cursor-pointer"
                                disabled={isProcessingAI}
                                asChild
                              >
                                <span>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Escolher Imagem
                                </span>
                              </Button>
                            </label>
                          </>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-4">
                        Formatos aceitos: JPG, PNG, WEBP
                      </p>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Dicas para melhores resultados:
                      </h4>
                      <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                        <li>Tire uma foto clara do relatório de vendas ou print de pedidos</li>
                        <li>Certifique-se de que todos os dados estão legíveis</li>
                        <li>Evite reflexos ou áreas escuras na imagem</li>
                        <li>Funciona com prints do iFood, Rappi, 99Food, etc</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Preview */}
                    <div className="border rounded-lg overflow-hidden bg-muted/50 max-w-2xl mx-auto">
                      <img 
                        src={filePreview.url} 
                        alt="Preview" 
                        className="max-h-64 w-auto mx-auto object-contain"
                      />
                      <div className="p-2 bg-muted flex items-center justify-between">
                        <span className="text-sm text-muted-foreground truncate max-w-xs">
                          {filePreview.name}
                        </span>
                        <Badge variant="outline">Imagem</Badge>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        onClick={processImageWithAI}
                        disabled={isProcessingAI}
                      >
                        {isProcessingAI ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Processando com IA...
                          </>
                        ) : (
                          <>
                            <Camera className="h-4 w-4 mr-2" />
                            Processar com IA
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={clearFilePreview}
                        disabled={isProcessingAI}
                      >
                        Trocar imagem
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Não conseguimos detectar todas as colunas automaticamente. 
              Por favor, mapeie as colunas do seu arquivo:
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do Pedido *</Label>
                <Select value={mapping.data} onValueChange={v => setMapping(m => ({ ...m, data: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Select value={mapping.valor} onValueChange={v => setMapping(m => ({ ...m, valor: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Canal/Plataforma</Label>
                <Select value={mapping.canal || "__none__"} onValueChange={v => setMapping(m => ({ ...m, canal: v === "__none__" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não usar</SelectItem>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={mapping.status || "__none__"} onValueChange={v => setMapping(m => ({ ...m, status: v === "__none__" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não usar</SelectItem>
                    {headers.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
              <Button onClick={handleMappingConfirm}>Continuar</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-sm">
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  {fileName}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedCount} de {parsedRows.length} linhas selecionadas
                </span>
                {duplicateCount > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {duplicateCount} duplicata{duplicateCount > 1 ? 's' : ''} encontrada{duplicateCount > 1 ? 's' : ''}
                  </Badge>
                )}
                {checkingDuplicates && (
                  <span className="text-sm text-muted-foreground animate-pulse">
                    Verificando duplicatas...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Canal para todas:</Label>
                <Select value={canalOverride || "__fromfile__"} onValueChange={v => setCanalOverride(v === "__fromfile__" ? "" : v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Do arquivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__fromfile__">Do arquivo</SelectItem>
                    {taxasApps?.map(app => (
                      <SelectItem key={app.nome_app} value={app.nome_app}>{app.nome_app}</SelectItem>
                    ))}
                    <SelectItem value="iFood">iFood</SelectItem>
                    <SelectItem value="Rappi">Rappi</SelectItem>
                    <SelectItem value="99Food">99Food</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectedCount === parsedRows.length}
                        onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                      />
                    </TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Válido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 100).map((row, idx) => {
                    const isValid = row.data !== '' && row.valor > 0;
                    const isDuplicate = row.isDuplicate;
                    return (
                      <TableRow 
                        key={idx} 
                        className={`${!isValid ? 'opacity-50' : ''} ${isDuplicate ? 'bg-amber-50/50' : ''}`}
                      >
                        <TableCell>
                          <Checkbox 
                            checked={row.selected}
                            onCheckedChange={() => toggleRow(idx)}
                            disabled={!isValid || isDuplicate}
                          />
                        </TableCell>
                        <TableCell>{row.data || '-'}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(row.valor)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{canalOverride || row.canal || 'App'}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.status || '-'}
                        </TableCell>
                        <TableCell>
                          {isDuplicate ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                              Duplicada
                            </Badge>
                          ) : isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {parsedRows.length > 100 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  Mostrando 100 de {parsedRows.length} linhas
                </p>
              )}
            </ScrollArea>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm">
                <span className="font-medium">Total selecionado: </span>
                <span className="text-lg font-bold text-primary">{formatCurrency(totalValor)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  Ajustar Mapeamento
                </Button>
                <Button 
                  onClick={() => importMutation.mutate()}
                  disabled={selectedCount === 0 || importMutation.isPending}
                >
                  {importMutation.isPending ? 'Importando...' : `Importar ${selectedCount} vendas`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportarVendasDialog;
