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
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, AlertTriangle, Camera, ImageIcon, Loader2, Plus, Trash2, DollarSign, TrendingDown, Info } from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/format';
import * as XLSX from 'xlsx';
import { isNativePlatform, takePictureNative, pickImageNative } from '@/lib/cameraUtils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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

interface ParsedItem {
  produto: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  produto_id?: string;
  selected: boolean;
  matchType?: 'saved' | 'auto' | 'manual' | 'none';
}

interface PhotoImportData {
  tipo: 'comanda' | 'relatorio';
  plataforma: string;
  data: string;
  numero_pedido: string | null;
  cliente: string | null;
  subtotal: number;
  taxa_entrega: number;
  taxa_servico: number;
  incentivos_plataforma: number;
  incentivos_loja: number;
  total_geral: number;
  itens: ParsedItem[];
  isDuplicate?: boolean;
  duplicateReason?: string;
}

interface ColumnMapping {
  data: string;
  valor: string;
  canal: string;
  status: string;
  descricao: string;
}

interface MultiImageState {
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  result?: PhotoImportData;
  error?: string;
}

const KNOWN_MAPPINGS: Record<string, Partial<ColumnMapping>> = {
  ifood: { data: 'DATA E HORA DO PEDIDO', valor: 'VALOR LIQUIDO (R$)', canal: 'CANAL DE VENDA', status: 'STATUS FINAL DO PEDIDO', descricao: 'ID CURTO DO PEDIDO' },
  ifood_alt: { data: 'Data do Pedido', valor: 'Valor Líquido', canal: 'Canal', status: 'Status' },
  rappi: { data: 'Fecha', valor: 'Total', canal: 'Canal', status: 'Estado' },
  generic: { data: 'data', valor: 'valor', canal: 'canal', status: 'status' },
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
  const [mapping, setMapping] = useState<ColumnMapping>({ data: '', valor: '', canal: '', status: '', descricao: '' });
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [canalOverride, setCanalOverride] = useState('');
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  
  const [importMethod, setImportMethod] = useState<'csv' | 'foto'>('csv');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const multiImageInputRef = useRef<HTMLInputElement>(null);
  
  // Multi-image states
  const [multiImages, setMultiImages] = useState<MultiImageState[]>([]);
  const [allPhotoResults, setAllPhotoResults] = useState<PhotoImportData[]>([]);
  const [photoStep, setPhotoStep] = useState<'upload' | 'items' | 'importing'>('upload');
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  // Fetch produtos para vincular
  const { data: produtos } = useQuery({
    queryKey: ['produtos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('produtos').select('id, nome, preco_venda').eq('ativo', true).order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id && open,
  });

  // Fetch mapeamentos salvos para auto-link
  const { data: mapeamentos } = useQuery({
    queryKey: ['produto-nome-externo', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('produto_nome_externo' as any).select('*');
      if (error) throw error;
      return data as any[];
    },
    enabled: !!usuario?.empresa_id && open,
  });

  const { data: canaisConfigurados } = useQuery({
    queryKey: ['canais-configurados', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase.from('canais_venda').select('*').eq('ativo', true).order('tipo').order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!usuario?.empresa_id && open,
  });

  const canaisDelivery = canaisConfigurados?.filter(c => c.tipo === 'app_delivery') || [];

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
    setIsProcessingAI(false);
    setMultiImages([]);
    setAllPhotoResults([]);
    setPhotoStep('upload');
    setCurrentResultIndex(0);
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;
    if (s1.includes(s2) || s2.includes(s1)) return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    let matchingWords = 0;
    for (const w1 of words1) {
      if (w1.length < 3) continue;
      for (const w2 of words2) {
        if (w2.length < 3) continue;
        if (w1.includes(w2) || w2.includes(w1)) { matchingWords++; break; }
      }
    }
    return matchingWords / Math.max(words1.filter(w => w.length >= 3).length, 1);
  };

  const findBestMatchingProduct = (itemName: string, plataforma?: string): { id: string; matchType: 'saved' | 'auto' } | undefined => {
    // First check saved mappings
    if (mapeamentos && mapeamentos.length > 0) {
      const saved = mapeamentos.find((m: any) => 
        m.nome_externo?.toLowerCase().trim() === itemName.toLowerCase().trim() &&
        (!plataforma || !m.plataforma || m.plataforma === plataforma)
      );
      if (saved) return { id: (saved as any).produto_id, matchType: 'saved' };
    }
    
    // Then try similarity matching
    if (!produtos || produtos.length === 0) return undefined;
    let bestMatch: { id: string; score: number } | null = null;
    for (const produto of produtos) {
      const score = calculateSimilarity(itemName, produto.nome);
      if (score >= 0.5 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { id: produto.id, score };
      }
    }
    if (bestMatch) return { id: bestMatch.id, matchType: 'auto' };
    return undefined;
  };

  // Multi-image handling
  const handleMultiImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newImages: MultiImageState[] = [];
    let loaded = 0;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        newImages.push({ file, preview: reader.result as string, status: 'pending' });
        loaded++;
        if (loaded === files.length) {
          setMultiImages(prev => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setMultiImages(prev => prev.filter((_, i) => i !== index));
  };

  const checkPhotoDuplicates = async (results: PhotoImportData[]): Promise<PhotoImportData[]> => {
    if (!usuario?.empresa_id || results.length === 0) return results;

    try {
      // Fetch existing sales for comparison
      const { data: existingVendas } = await supabase
        .from('vendas')
        .select('numero_pedido_externo, plataforma, data_venda, subtotal, valor_total')
        .eq('empresa_id', usuario.empresa_id);

      if (!existingVendas || existingVendas.length === 0) return results;

      return results.map(result => {
        // 1. Check by numero_pedido_externo + plataforma (most reliable)
        if (result.numero_pedido) {
          const byPedido = existingVendas.find(v =>
            v.numero_pedido_externo &&
            v.numero_pedido_externo === result.numero_pedido &&
            (v.plataforma || '').toLowerCase() === (result.plataforma || '').toLowerCase()
          );
          if (byPedido) {
            return { ...result, isDuplicate: true, duplicateReason: `Pedido ${result.numero_pedido} já importado` };
          }
        }

        // 2. Check by data + subtotal + plataforma (fallback for orders without number)
        const byValor = existingVendas.find(v =>
          v.data_venda === result.data &&
          Math.abs(Number(v.subtotal || v.valor_total) - result.subtotal) < 0.01 &&
          (v.plataforma || '').toLowerCase() === (result.plataforma || '').toLowerCase()
        );
        if (byValor) {
          return { ...result, isDuplicate: true, duplicateReason: `Venda com mesmo valor (${formatCurrency(result.subtotal)}) já existe em ${result.data}` };
        }

        // 3. Check within current batch for duplicates (same image uploaded twice)
        const duplicatesInBatch = results.filter(r =>
          r !== result &&
          r.numero_pedido && result.numero_pedido &&
          r.numero_pedido === result.numero_pedido &&
          r.plataforma === result.plataforma
        );
        if (duplicatesInBatch.length > 0) {
          return { ...result, isDuplicate: true, duplicateReason: 'Print duplicado nesta importação' };
        }

        return result;
      });
    } catch {
      return results;
    }
  };

  const processAllImages = async () => {
    if (multiImages.length === 0) return;
    setIsProcessingAI(true);
    
    const results: PhotoImportData[] = [];
    const updated = [...multiImages];

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === 'done') continue;
      updated[i].status = 'processing';
      setMultiImages([...updated]);

      try {
        const { data, error } = await supabase.functions.invoke('process-sales-image', {
          body: { content: updated[i].preview }
        });

        if (error) throw error;

        if (data.success && data.data?.itens?.length > 0) {
          const plataforma = data.data.plataforma || '';
          const itens: ParsedItem[] = data.data.itens.map((item: any) => {
            const match = findBestMatchingProduct(item.produto || '', plataforma);
            return {
              produto: item.produto || '',
              quantidade: item.quantidade || 1,
              valor_unitario: item.valor_unitario || 0,
              valor_total: item.valor_total || 0,
              produto_id: match?.id,
              selected: true,
              matchType: match ? match.matchType : 'none' as const,
            };
          });

          const result: PhotoImportData = {
            tipo: data.data.tipo || 'comanda',
            plataforma,
            data: data.data.data || new Date().toISOString().split('T')[0],
            numero_pedido: data.data.numero_pedido || null,
            cliente: data.data.cliente || null,
            subtotal: data.data.subtotal || 0,
            taxa_entrega: data.data.taxa_entrega || 0,
            taxa_servico: data.data.taxa_servico || 0,
            incentivos_plataforma: data.data.incentivos_plataforma || 0,
            incentivos_loja: data.data.incentivos_loja || 0,
            total_geral: data.data.total_geral || 0,
            itens,
          };

          updated[i].status = 'done';
          updated[i].result = result;
          results.push(result);
        } else {
          updated[i].status = 'error';
          updated[i].error = data.message || 'Não foi possível extrair itens';
        }
      } catch (error: any) {
        updated[i].status = 'error';
        updated[i].error = error.message || 'Erro ao processar';
      }
      
      setMultiImages([...updated]);
    }

    // Check for duplicates against DB and within batch
    const checkedResults = await checkPhotoDuplicates(results);
    const dupeCount = checkedResults.filter(r => r.isDuplicate).length;

    setAllPhotoResults(checkedResults);
    setIsProcessingAI(false);

    if (checkedResults.length > 0) {
      setPhotoStep('items');
      setCurrentResultIndex(0);
      const desc = dupeCount > 0
        ? `${checkedResults.reduce((sum, r) => sum + r.itens.length, 0)} itens encontrados. ⚠️ ${dupeCount} possível(is) duplicata(s).`
        : `${checkedResults.reduce((sum, r) => sum + r.itens.length, 0)} itens encontrados no total.`;
      toast({ 
        title: `${checkedResults.length} pedido(s) processado(s)!`,
        description: desc,
      });
    } else {
      toast({ title: 'Nenhum pedido extraído', description: 'Tente com imagens mais claras.', variant: 'destructive' });
    }
  };

  // Single image for native camera
  const handleSingleImage = async (base64: string, name: string) => {
    const blob = await fetch(base64).then(r => r.blob());
    const file = new File([blob], name, { type: 'image/jpeg' });
    setMultiImages(prev => [...prev, { file, preview: base64, status: 'pending' }]);
  };

  const handleLinkProduct = (resultIdx: number, itemIdx: number, produtoId: string) => {
    setAllPhotoResults(prev => prev.map((result, ri) => 
      ri === resultIdx ? {
        ...result,
        itens: result.itens.map((item, ii) => 
          ii === itemIdx ? { ...item, produto_id: produtoId === '__none__' ? undefined : produtoId, matchType: produtoId === '__none__' ? 'none' as const : 'manual' as const } : item
        )
      } : result
    ));
  };

  const handleToggleItem = (resultIdx: number, itemIdx: number) => {
    setAllPhotoResults(prev => prev.map((result, ri) => 
      ri === resultIdx ? {
        ...result,
        itens: result.itens.map((item, ii) => 
          ii === itemIdx ? { ...item, selected: !item.selected } : item
        )
      } : result
    ));
  };

  // Save product name mappings
  const saveMappings = async (items: { nome_externo: string; produto_id: string; plataforma: string }[]) => {
    if (!usuario?.empresa_id || items.length === 0) return;
    
    const mappingsToSave = items.map(item => ({
      empresa_id: usuario.empresa_id,
      nome_externo: item.nome_externo,
      produto_id: item.produto_id,
      plataforma: item.plataforma || null,
    }));

    // Upsert to handle duplicates
    for (const m of mappingsToSave) {
      await supabase.from('produto_nome_externo' as any).upsert(m, { onConflict: 'empresa_id,nome_externo,plataforma' });
    }
  };

  const importPhotoItemsMutation = useMutation({
    mutationFn: async () => {
      if (!usuario?.empresa_id || allPhotoResults.length === 0) throw new Error('Dados inválidos');

      let totalImported = 0;
      const newMappings: { nome_externo: string; produto_id: string; plataforma: string }[] = [];

      for (const result of allPhotoResults) {
        // Skip duplicates
        if (result.isDuplicate) continue;
        const selectedItems = result.itens.filter(i => i.selected && i.produto_id);
        if (selectedItems.length === 0) continue;

        // Calculate valor_liquido for this order
        const valorLiquido = result.subtotal - result.incentivos_loja;

        const vendas = selectedItems.map(item => ({
          empresa_id: usuario.empresa_id,
          data_venda: result.data,
          valor_total: item.valor_total,
          canal: canalOverride || result.plataforma || 'Venda Direta',
          descricao_produto: item.produto,
          quantidade: item.quantidade,
          origem: 'importacao_foto',
          tipo_venda: result.tipo === 'comanda' ? 'direta' : 'app',
          produto_id: item.produto_id,
          cliente_id: null,
          numero_pedido_externo: result.numero_pedido,
          subtotal: result.subtotal,
          taxa_entrega: result.taxa_entrega,
          taxa_servico: result.taxa_servico,
          incentivo_plataforma: result.incentivos_plataforma,
          incentivo_loja: result.incentivos_loja,
          valor_liquido: valorLiquido > 0 ? valorLiquido : result.total_geral,
          plataforma: result.plataforma || null,
        }));

        const { error } = await supabase.from('vendas').insert(vendas);
        if (error) throw error;

        // Generate caixa movements for taxes and incentives
        const caixaMovimentos: any[] = [];
        const plat = canalOverride || result.plataforma || 'Venda Direta';
        
        // Entry: valor líquido received
        const vliq = valorLiquido > 0 ? valorLiquido : result.total_geral;
        if (vliq > 0) {
          caixaMovimentos.push({
            empresa_id: usuario.empresa_id,
            tipo: 'entrada',
            categoria: 'Venda',
            descricao: `${plat}${result.numero_pedido ? ` #${result.numero_pedido}` : ''} - Valor líquido`,
            valor: vliq,
            data_movimento: result.data,
            origem: 'importacao_foto',
          });
        }
        
        // Exit: taxa de serviço
        if (result.taxa_servico > 0) {
          caixaMovimentos.push({
            empresa_id: usuario.empresa_id,
            tipo: 'saida',
            categoria: 'Taxas Plataforma',
            descricao: `${plat}${result.numero_pedido ? ` #${result.numero_pedido}` : ''} - Taxa de serviço`,
            valor: result.taxa_servico,
            data_movimento: result.data,
            origem: 'importacao_foto',
          });
        }
        
        // Exit: incentivo da loja
        if (result.incentivos_loja > 0) {
          caixaMovimentos.push({
            empresa_id: usuario.empresa_id,
            tipo: 'saida',
            categoria: 'Descontos/Promoções',
            descricao: `${plat}${result.numero_pedido ? ` #${result.numero_pedido}` : ''} - Incentivo da loja`,
            valor: result.incentivos_loja,
            data_movimento: result.data,
            origem: 'importacao_foto',
          });
        }
        
        if (caixaMovimentos.length > 0) {
          await supabase.from('caixa_movimentos').insert(caixaMovimentos);
        }

        totalImported += selectedItems.length;

        // Collect mappings to save
        selectedItems.forEach(item => {
          if (item.produto_id) {
            newMappings.push({
              nome_externo: item.produto,
              produto_id: item.produto_id,
              plataforma: result.plataforma || '',
            });
          }
        });
      }

      // Save product name mappings for future auto-link
      await saveMappings(newMappings);
      
      return totalImported;
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

  // CSV import functions (kept from original)
  const checkDuplicates = async (rows: ParsedRow[]) => {
    if (!usuario?.empresa_id) return rows;
    setCheckingDuplicates(true);
    try {
      const { data: existingVendas, error } = await supabase.from('vendas').select('data_venda, valor_total, canal, descricao_produto').eq('empresa_id', usuario.empresa_id);
      if (error) throw error;
      const existingKeys = new Set((existingVendas || []).map(v => `${v.data_venda}|${v.valor_total}|${(v.canal || '').toLowerCase()}|${(v.descricao_produto || '').toLowerCase()}`));
      let dupes = 0;
      const checkedRows = rows.map(row => {
        const key = `${row.data}|${row.valor}|${(row.canal || '').toLowerCase()}|${(row.descricao || '').toLowerCase()}`;
        const isDuplicate = existingKeys.has(key);
        if (isDuplicate) dupes++;
        return { ...row, isDuplicate, selected: row.selected && !isDuplicate };
      });
      setDuplicateCount(dupes);
      return checkedRows;
    } catch { return rows; } 
    finally { setCheckingDuplicates(false); }
  };

  const detectMapping = useCallback((headers: string[]) => {
    for (const [, knownMapping] of Object.entries(KNOWN_MAPPINGS)) {
      const matches: Partial<ColumnMapping> = {};
      let matchCount = 0;
      for (const [field, expectedHeader] of Object.entries(knownMapping)) {
        const idx = headers.findIndex(h => h.toLowerCase().trim() === (expectedHeader as string).toLowerCase().trim() || h.toLowerCase().includes((expectedHeader as string).toLowerCase()));
        if (idx !== -1) { matches[field as keyof ColumnMapping] = headers[idx]; matchCount++; }
      }
      if (matchCount >= 2) return matches as ColumnMapping;
    }
    const detected: Partial<ColumnMapping> = {};
    const headerLower = headers.map(h => h.toLowerCase().trim());
    for (let i = 0; i < headers.length; i++) {
      const h = headerLower[i];
      if (!detected.data && (h.includes('data') || h.includes('date'))) detected.data = headers[i];
      if (!detected.valor && (h.includes('valor') || h.includes('total') || h.includes('liquido'))) detected.valor = headers[i];
      if (!detected.canal && (h.includes('canal') || h.includes('channel'))) detected.canal = headers[i];
      if (!detected.status && (h.includes('status') || h.includes('estado'))) detected.status = headers[i];
      if (!detected.descricao && (h.includes('pedido') || h.includes('order'))) detected.descricao = headers[i];
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
      if (jsonData.length === 0) throw new Error('Arquivo vazio ou formato não reconhecido');
      const fileHeaders = Object.keys(jsonData[0]);
      setHeaders(fileHeaders);
      setRawData(jsonData);
      setFileName(file.name);
      const detectedMapping = detectMapping(fileHeaders);
      setMapping(prev => ({ ...prev, ...detectedMapping }));
      if (detectedMapping.data && detectedMapping.valor) {
        setStep('preview');
        processData(jsonData, detectedMapping);
      } else {
        setStep('mapping');
      }
      toast({ title: `Arquivo carregado: ${jsonData.length} linhas encontradas` });
    } catch (error) {
      toast({ title: 'Erro ao ler arquivo', description: error instanceof Error ? error.message : 'Formato não suportado', variant: 'destructive' });
    }
  };

  const processData = (data: Record<string, unknown>[], currentMapping: ColumnMapping) => {
    const rows: ParsedRow[] = data.map(row => {
      let dataStr = '';
      const rawDate = row[currentMapping.data];
      if (rawDate) {
        try {
          const dateValue = rawDate instanceof Date ? rawDate : new Date(String(rawDate));
          if (!isNaN(dateValue.getTime())) { dataStr = dateValue.toISOString().split('T')[0]; }
          else {
            const parts = String(rawDate).split(/[\/\-]/);
            if (parts.length === 3) { const [d, m, y] = parts; dataStr = `${y.length === 4 ? y : '20' + y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
          }
        } catch { dataStr = ''; }
      }
      let valor = 0;
      const rawValor = row[currentMapping.valor];
      if (rawValor) { const cleanValue = String(rawValor).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'); valor = parseFloat(cleanValue) || 0; }
      const canal = currentMapping.canal ? String(row[currentMapping.canal] || '') : '';
      const status = currentMapping.status ? String(row[currentMapping.status] || '') : 'Concluído';
      const descricao = currentMapping.descricao ? String(row[currentMapping.descricao] || '') : '';
      const isConcluido = !currentMapping.status || STATUS_CONCLUIDO.some(s => status.toLowerCase().includes(s));
      return { data: dataStr, valor, canal, status, descricao, selected: isConcluido && dataStr !== '' && valor > 0, raw: row, isDuplicate: false };
    });
    checkDuplicates(rows).then(checkedRows => setParsedRows(checkedRows));
    setParsedRows(rows);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) parseFile(file); };
  const handleMappingConfirm = () => { if (!mapping.data || !mapping.valor) { toast({ title: 'Selecione pelo menos Data e Valor', variant: 'destructive' }); return; } processData(rawData, mapping); setStep('preview'); };
  const toggleSelectAll = (checked: boolean) => setParsedRows(prev => prev.map(row => ({ ...row, selected: checked && !row.isDuplicate })));
  const toggleRow = (index: number) => setParsedRows(prev => prev.map((row, i) => i === index ? { ...row, selected: !row.selected } : row));

  const importMutation = useMutation({
    mutationFn: async () => {
      const selectedRows = parsedRows.filter(r => r.selected);
      if (selectedRows.length === 0) throw new Error('Nenhuma linha selecionada');
      const vendas = selectedRows.map(row => ({
        empresa_id: usuario!.empresa_id, data_venda: row.data, valor_total: row.valor,
        canal: canalOverride || row.canal || 'App', descricao_produto: row.descricao || null,
        quantidade: 1, origem: 'importacao', tipo_venda: 'app', produto_id: null, cliente_id: null,
      }));
      const { error } = await supabase.from('vendas').insert(vendas);
      if (error) throw error;
      return selectedRows.length;
    },
    onSuccess: (count) => { queryClient.invalidateQueries({ queryKey: ['vendas'] }); toast({ title: `${count} vendas importadas com sucesso!` }); setOpen(false); resetState(); },
    onError: (error) => { toast({ title: 'Erro na importação', description: error.message, variant: 'destructive' }); },
  });

  const selectedCount = parsedRows.filter(r => r.selected).length;
  const totalValor = parsedRows.filter(r => r.selected).reduce((sum, r) => sum + r.valor, 0);
  const formatCurrency = formatCurrencyBRL;

  // Current photo result for display
  const currentResult = allPhotoResults[currentResultIndex];
  const nonDuplicateResults = allPhotoResults.filter(r => !r.isDuplicate);
  const photoDuplicateCount = allPhotoResults.filter(r => r.isDuplicate).length;
  const totalPhotoItemsToImport = nonDuplicateResults.reduce((sum, r) => sum + r.itens.filter(i => i.selected && i.produto_id).length, 0);
  const totalPhotoValue = nonDuplicateResults.reduce((sum, r) => sum + r.itens.filter(i => i.selected && i.produto_id).reduce((s, i) => s + i.valor_total, 0), 0);

  // Financial breakdown component
  const FinancialBreakdown = ({ data }: { data: PhotoImportData }) => {
    const valorLiquido = data.subtotal - data.incentivos_loja;
    return (
      <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <DollarSign className="h-4 w-4" />
          Breakdown Financeiro
          {data.numero_pedido && <Badge variant="outline" className="text-xs">{data.numero_pedido}</Badge>}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Subtotal (itens)</span>
            <span className="font-medium">{formatCurrency(data.subtotal)}</span>
          </div>
          {data.taxa_entrega > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Taxa de entrega</span>
              <span>{formatCurrency(data.taxa_entrega)}</span>
            </div>
          )}
          {data.taxa_servico > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Taxa de serviço</span>
              <span>{formatCurrency(data.taxa_servico)}</span>
            </div>
          )}
          {data.incentivos_plataforma > 0 && (
            <div className="flex justify-between text-green-600">
              <span className="flex items-center gap-1">
                Incentivo {data.plataforma || 'plataforma'}
                <Tooltip>
                  <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                  <TooltipContent><p>A plataforma paga este desconto.<br/>NÃO sai do seu bolso.</p></TooltipContent>
                </Tooltip>
              </span>
              <span>-{formatCurrency(data.incentivos_plataforma)}</span>
            </div>
          )}
          {data.incentivos_loja > 0 && (
            <div className="flex justify-between text-destructive">
              <span className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                Incentivo da loja
                <Tooltip>
                  <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                  <TooltipContent><p>Este desconto SAI DO SEU BOLSO.<br/>Reduz o que você recebe.</p></TooltipContent>
                </Tooltip>
              </span>
              <span className="font-medium">-{formatCurrency(data.incentivos_loja)}</span>
            </div>
          )}
          <div className="border-t pt-1 flex justify-between">
            <span>Total pago pelo cliente</span>
            <span>{formatCurrency(data.total_geral)}</span>
          </div>
          <div className="border-t pt-1 flex justify-between font-bold text-primary">
            <span>💰 Valor Líquido (seu)</span>
            <span>{formatCurrency(valorLiquido > 0 ? valorLiquido : data.total_geral)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetState(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="mr-2 h-4 w-4" />Importar</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col overflow-y-auto">
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
                <TabsTrigger value="csv" className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />CSV/Excel</TabsTrigger>
                <TabsTrigger value="foto" className="flex items-center gap-2"><Camera className="h-4 w-4" />Foto</TabsTrigger>
              </TabsList>

              <TabsContent value="csv" className="mt-4 space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">Arraste ou selecione um arquivo</p>
                  <p className="text-sm text-muted-foreground mb-4">Suporta Excel (.xlsx, .xls) e CSV do iFood, Rappi, 99Food e outros</p>
                  <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="max-w-xs mx-auto" />
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2"><AlertCircle className="h-4 w-4" />Como exportar do iFood:</h4>
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
                {photoStep === 'upload' && (
                  <div className="space-y-4">
                    {/* Multi-image upload area */}
                    <div className="border-2 border-dashed rounded-lg p-6 text-center">
                      <Camera className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-lg font-medium mb-1">Importe prints dos pedidos</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Selecione uma ou várias fotos de uma vez — a IA extrai itens, taxas e incentivos automaticamente
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                        {isNativePlatform() ? (
                          <>
                            <Button type="button" variant="outline" className="flex-1" disabled={isProcessingAI}
                              onClick={async () => {
                                try { const base64 = await takePictureNative(); if (base64) handleSingleImage(base64, 'camera-photo.jpg'); }
                                catch (error: any) { if (error.message !== 'User cancelled photos app') toast({ title: 'Erro', description: 'Não foi possível acessar a câmera.', variant: 'destructive' }); }
                              }}>
                              <Camera className="h-4 w-4 mr-2" />Tirar Foto
                            </Button>
                            <Button type="button" variant="outline" className="flex-1" disabled={isProcessingAI}
                              onClick={async () => {
                                try { const base64 = await pickImageNative(); if (base64) handleSingleImage(base64, 'gallery-photo.jpg'); }
                                catch (error: any) { if (error.message !== 'User cancelled photos app') toast({ title: 'Erro', description: 'Não foi possível acessar a galeria.', variant: 'destructive' }); }
                              }}>
                              <ImageIcon className="h-4 w-4 mr-2" />Galeria
                            </Button>
                          </>
                        ) : (
                          <>
                            <input type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setMultiImages(prev => [...prev, { file: f, preview: r.result as string, status: 'pending' }]); r.readAsDataURL(f); } }} disabled={isProcessingAI} className="hidden" id="camera-input-sales" />
                            <label htmlFor="camera-input-sales" className="flex-1">
                              <Button type="button" variant="outline" className="w-full cursor-pointer" disabled={isProcessingAI} asChild><span><Camera className="h-4 w-4 mr-2" />Tirar Foto</span></Button>
                            </label>
                            <input ref={multiImageInputRef} type="file" accept="image/*" multiple onChange={handleMultiImageSelect} disabled={isProcessingAI} className="hidden" id="multi-file-input-sales" />
                            <label htmlFor="multi-file-input-sales" className="flex-1">
                              <Button type="button" variant="outline" className="w-full cursor-pointer" disabled={isProcessingAI} asChild><span><Plus className="h-4 w-4 mr-2" />Selecionar Imagens</span></Button>
                            </label>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Image previews grid */}
                    {multiImages.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{multiImages.length} imagem(ns) selecionada(s)</p>
                          <Button variant="ghost" size="sm" onClick={() => setMultiImages([])} disabled={isProcessingAI}>
                            <Trash2 className="h-4 w-4 mr-1" />Limpar
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {multiImages.map((img, idx) => (
                            <div key={idx} className="relative group border rounded-lg overflow-hidden aspect-square">
                              <img src={img.preview} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                              {img.status === 'processing' && (
                                <div className="absolute inset-0 bg-background/70 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                              )}
                              {img.status === 'done' && (
                                <div className="absolute top-1 right-1"><Badge className="bg-green-600 text-xs">✓</Badge></div>
                              )}
                              {img.status === 'error' && (
                                <div className="absolute top-1 right-1"><Badge variant="destructive" className="text-xs">✗</Badge></div>
                              )}
                              {img.status === 'pending' && !isProcessingAI && (
                                <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <Button onClick={processAllImages} disabled={isProcessingAI || multiImages.length === 0} className="w-full">
                          {isProcessingAI ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando {multiImages.filter(i => i.status === 'processing').length > 0 ? `${multiImages.filter(i => i.status === 'done').length + 1}/${multiImages.length}` : '...'}...</>
                          ) : (
                            <><Camera className="h-4 w-4 mr-2" />Processar {multiImages.length} imagem(ns) com IA</>
                          )}
                        </Button>
                      </div>
                    )}

                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2"><AlertCircle className="h-4 w-4" />Dicas para melhores resultados:</h4>
                      <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                        <li>Tire prints claros dos pedidos (iFood, 99, Rappi, etc)</li>
                        <li>Selecione várias fotos de uma vez para importação em lote</li>
                        <li>A IA extrai itens, taxas, incentivos e calcula o valor líquido</li>
                        <li>Produtos vinculados são salvos para auto-link futuro</li>
                      </ul>
                    </div>
                  </div>
                )}

                {photoStep === 'items' && allPhotoResults.length > 0 && currentResult && (
                  <div className="space-y-3">
                    {/* Navigation between orders */}
                    {allPhotoResults.length > 1 && (
                      <div className="flex items-center justify-between bg-muted/30 rounded-lg p-2">
                        <Button variant="ghost" size="sm" disabled={currentResultIndex === 0} onClick={() => setCurrentResultIndex(i => i - 1)}>← Anterior</Button>
                        <span className="text-sm font-medium">Pedido {currentResultIndex + 1} de {allPhotoResults.length}</span>
                        <Button variant="ghost" size="sm" disabled={currentResultIndex === allPhotoResults.length - 1} onClick={() => setCurrentResultIndex(i => i + 1)}>Próximo →</Button>
                      </div>
                    )}

                    {/* Duplicate warning */}
                    {currentResult.isDuplicate && (
                      <div className="flex items-center gap-2 p-3 border border-destructive/50 bg-destructive/10 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-destructive">Possível duplicata</p>
                          <p className="text-xs text-muted-foreground">{currentResult.duplicateReason}</p>
                        </div>
                      </div>
                    )}

                    {/* Header info */}
                    <div className={`flex flex-col gap-2 p-2 sm:p-3 rounded-lg ${currentResult.isDuplicate ? 'bg-destructive/5 border border-destructive/20' : 'bg-muted/50'}`}>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-xs">{currentResult.tipo === 'comanda' ? 'Comanda' : 'Relatório'}</Badge>
                          {currentResult.plataforma && <Badge variant="secondary" className="text-xs">{currentResult.plataforma}</Badge>}
                          {currentResult.numero_pedido && <Badge className="text-xs">{currentResult.numero_pedido}</Badge>}
                          {currentResult.isDuplicate && <Badge variant="destructive" className="text-xs">⚠️ Duplicata</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {currentResult.data}{currentResult.cliente && ` • ${currentResult.cliente}`}
                        </p>
                      </div>
                    </div>

                    {/* Financial Breakdown */}
                    <FinancialBreakdown data={currentResult} />

                    {/* Canal override */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                      <Label className="text-xs sm:text-sm">Canal para todas:</Label>
                      <Select value={canalOverride || "__fromfile__"} onValueChange={v => setCanalOverride(v === "__fromfile__" ? "" : v)}>
                        <SelectTrigger className="w-full sm:w-40 h-8 text-sm"><SelectValue placeholder="Do arquivo" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__fromfile__">Do arquivo</SelectItem>
                          {canaisDelivery.map(canal => (<SelectItem key={canal.id} value={canal.nome}>{canal.nome}</SelectItem>))}
                          <SelectItem value="Venda Direta">Venda Direta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Items */}
                    <div className="border rounded-lg">
                      <div className="p-2 sm:p-3 border-b bg-muted/30 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {currentResult.itens.length} itens • 
                            <span className="text-muted-foreground ml-1">
                              {currentResult.itens.filter(i => i.selected && i.produto_id).length} vinculados
                              {(() => {
                                const saved = currentResult.itens.filter(i => i.matchType === 'saved').length;
                                const auto = currentResult.itens.filter(i => i.matchType === 'auto').length;
                                const manual = currentResult.itens.filter(i => i.matchType === 'manual').length;
                                const none = currentResult.itens.filter(i => !i.produto_id || i.matchType === 'none').length;
                                const parts = [];
                                if (saved > 0) parts.push(`${saved} 🔗`);
                                if (auto > 0) parts.push(`${auto} ✨`);
                                if (manual > 0) parts.push(`${manual} ✋`);
                                if (none > 0) parts.push(`${none} sem vínculo`);
                                return parts.length > 0 ? ` (${parts.join(', ')})` : '';
                              })()}
                            </span>
                          </p>
                        </div>
                      </div>
                      <ScrollArea className="h-[200px] sm:h-[250px]">
                        <div className="p-2 space-y-2">
                          {currentResult.itens.map((item, idx) => (
                            <div key={idx} className={`p-2.5 border rounded-lg bg-background ${!item.selected ? 'opacity-50' : ''}`}>
                              <div className="flex items-start gap-2">
                                <Checkbox checked={item.selected} onCheckedChange={() => handleToggleItem(currentResultIndex, idx)} className="mt-0.5" />
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="font-medium text-sm truncate">{item.produto}</span>
                                      {item.matchType === 'saved' && (
                                        <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary border border-primary/20" title="Vinculado por mapeamento salvo anteriormente">
                                          🔗 Salvo
                                        </span>
                                      )}
                                      {item.matchType === 'auto' && (
                                        <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent text-accent-foreground border" title="Vinculado automaticamente por similaridade de nome">
                                          ✨ Auto
                                        </span>
                                      )}
                                      {item.matchType === 'manual' && (
                                        <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-secondary-foreground border" title="Vinculado manualmente por você">
                                          ✋ Manual
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-sm font-medium shrink-0">
                                      {item.quantidade > 1 && <span className="text-muted-foreground mr-1">{item.quantidade}×</span>}
                                      {formatCurrency(item.valor_total)}
                                    </span>
                                  </div>
                                  <Select value={item.produto_id || "__none__"} onValueChange={(v) => handleLinkProduct(currentResultIndex, idx, v)} disabled={!item.selected}>
                                    <SelectTrigger className="w-full h-8 text-xs">
                                      <SelectValue placeholder="Vincular ao produto..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">Não vincular</SelectItem>
                                      {produtos?.map(p => (<SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Summary and actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t">
                      <div className="text-sm">
                        <span className="font-medium">Total: </span>
                        <span className="text-base sm:text-lg font-bold text-primary">{formatCurrency(totalPhotoValue)}</span>
                        <span className="text-muted-foreground text-xs ml-1">
                          ({totalPhotoItemsToImport} vendas de {nonDuplicateResults.length} pedido(s))
                          {photoDuplicateCount > 0 && <span className="text-destructive"> • {photoDuplicateCount} duplicata(s) ignorada(s)</span>}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => { setPhotoStep('upload'); setAllPhotoResults([]); setMultiImages([]); }}>Voltar</Button>
                        <Button size="sm" className="flex-1 sm:flex-none" onClick={() => importPhotoItemsMutation.mutate()} disabled={importPhotoItemsMutation.isPending || totalPhotoItemsToImport === 0}>
                          {importPhotoItemsMutation.isPending ? 'Importando...' : `Importar ${totalPhotoItemsToImport} vendas`}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Não conseguimos detectar todas as colunas automaticamente. Por favor, mapeie as colunas do seu arquivo:</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do Pedido *</Label>
                <Select value={mapping.data} onValueChange={v => setMapping(m => ({ ...m, data: v }))}><SelectTrigger><SelectValue placeholder="Selecione a coluna" /></SelectTrigger><SelectContent>{headers.map(h => (<SelectItem key={h} value={h}>{h}</SelectItem>))}</SelectContent></Select>
              </div>
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Select value={mapping.valor} onValueChange={v => setMapping(m => ({ ...m, valor: v }))}><SelectTrigger><SelectValue placeholder="Selecione a coluna" /></SelectTrigger><SelectContent>{headers.map(h => (<SelectItem key={h} value={h}>{h}</SelectItem>))}</SelectContent></Select>
              </div>
              <div className="space-y-2">
                <Label>Canal/Plataforma</Label>
                <Select value={mapping.canal || "__none__"} onValueChange={v => setMapping(m => ({ ...m, canal: v === "__none__" ? "" : v }))}><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent><SelectItem value="__none__">Não usar</SelectItem>{headers.map(h => (<SelectItem key={h} value={h}>{h}</SelectItem>))}</SelectContent></Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={mapping.status || "__none__"} onValueChange={v => setMapping(m => ({ ...m, status: v === "__none__" ? "" : v }))}><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent><SelectItem value="__none__">Não usar</SelectItem>{headers.map(h => (<SelectItem key={h} value={h}>{h}</SelectItem>))}</SelectContent></Select>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-sm"><FileSpreadsheet className="h-3 w-3 mr-1" />{fileName}</Badge>
                <span className="text-sm text-muted-foreground">{selectedCount} de {parsedRows.length} selecionadas</span>
                {duplicateCount > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50"><AlertTriangle className="h-3 w-3 mr-1" />{duplicateCount} duplicata(s)</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm">Canal:</Label>
                <Select value={canalOverride || "__fromfile__"} onValueChange={v => setCanalOverride(v === "__fromfile__" ? "" : v)}>
                  <SelectTrigger className="w-32"><SelectValue placeholder="Do arquivo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__fromfile__">Do arquivo</SelectItem>
                    {canaisDelivery.map(canal => (<SelectItem key={canal.id} value={canal.nome}>{canal.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"><Checkbox checked={selectedCount === parsedRows.length} onCheckedChange={(checked) => toggleSelectAll(!!checked)} /></TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Válido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, i) => (
                    <TableRow key={i} className={`${!row.selected ? 'opacity-50' : ''} ${row.isDuplicate ? 'bg-amber-50/50' : ''}`}>
                      <TableCell><Checkbox checked={row.selected} onCheckedChange={() => toggleRow(i)} disabled={row.isDuplicate} /></TableCell>
                      <TableCell>{row.data || <span className="text-destructive">Inválida</span>}</TableCell>
                      <TableCell className="text-right">{row.valor > 0 ? formatCurrency(row.valor) : <span className="text-destructive">R$ 0</span>}</TableCell>
                      <TableCell>{row.canal || '-'}</TableCell>
                      <TableCell>
                        {row.isDuplicate ? <Badge variant="outline" className="text-amber-600 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Duplicata</Badge>
                        : STATUS_CONCLUIDO.some(s => row.status.toLowerCase().includes(s))
                          ? <Badge variant="outline" className="text-green-600 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />{row.status}</Badge>
                          : <Badge variant="outline" className="text-muted-foreground text-xs">{row.status || '-'}</Badge>}
                      </TableCell>
                      <TableCell>{row.data && row.valor > 0 ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-destructive" />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <span className="text-sm font-medium">Total: </span>
                <span className="text-lg font-bold text-primary">{formatCurrency(totalValor)}</span>
                <span className="text-sm text-muted-foreground ml-2">({selectedCount} vendas)</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
                <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || selectedCount === 0}>
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
