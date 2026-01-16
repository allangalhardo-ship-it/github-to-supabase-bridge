import React, { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Check, AlertCircle, Plus, Link2, Camera, Loader2, ImageIcon, Filter, Calendar, Package, Search, Trash2, Wand2, Pencil, Eye, AlertTriangle, ArrowRight, Calculator } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MobileDataView, Column } from '@/components/ui/mobile-data-view';
import { Checkbox } from '@/components/ui/checkbox';
import { isNativePlatform, takePictureNative, pickImageNative } from '@/lib/cameraUtils';
import { format } from 'date-fns';
import RegistrarCompraDialog from '@/components/compras/RegistrarCompraDialog';

interface XmlItem {
  produto_descricao: string;
  ean: string;
  quantidade: number;
  unidade: string;
  valor_total: number;
  custo_unitario: number;
  insumo_id?: string;
  mapeado?: boolean;
  // Campos de conversão
  fator_conversao?: number;
  quantidade_convertida?: number;
  custo_unitario_convertido?: number;
}

interface ParsedNota {
  numero: string;
  fornecedor: string;
  data_emissao: string;
  valor_total: number;
  itens: XmlItem[];
}

const Compras = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [parsedNota, setParsedNota] = useState<ParsedNota | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<XmlItem | null>(null);
  const [newInsumoNome, setNewInsumoNome] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [filePreview, setFilePreview] = useState<{ url: string; type: 'image' | 'pdf'; name: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [importTab, setImportTab] = useState('xml');
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Conversão (na importação da NF-e)
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);
  const [conversionItemIndex, setConversionItemIndex] = useState<number | null>(null);
  const [conversionUnidadeCompraId, setConversionUnidadeCompraId] = useState('');
  const [conversionShowNovaUnidade, setConversionShowNovaUnidade] = useState(false);
  const [conversionNovaUnidadeNome, setConversionNovaUnidadeNome] = useState('');
  const [conversionFatorManual, setConversionFatorManual] = useState('');

  const [deleteNotaId, setDeleteNotaId] = useState<string | null>(null);
  const [viewNotaId, setViewNotaId] = useState<string | null>(null);
  
  // Manual purchase dialog state - now using new RegistrarCompraDialog
  const [compraDialogOpen, setCompraDialogOpen] = useState(false);
  // Legacy manual form data - keeping for backward compatibility with existing purchases display
  const [manualFormData, setManualFormData] = useState({
    insumo_id: '',
    quantidade: '',
    custo_unitario: '',
    fornecedor: '',
    observacao: '',
  });
  const [deleteManualId, setDeleteManualId] = useState<string | null>(null);
  const [costVariationWarning, setCostVariationWarning] = useState<{
    show: boolean;
    type: 'manual' | 'import';
    insumoNome: string;
    custoAtual: number;
    custoNovo: number;
    variacao: number;
    onConfirm: () => void;
  } | null>(null);
  
  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [fornecedorFilter, setFornecedorFilter] = useState('');

  // Fetch notas
  const { data: notas, isLoading: notasLoading } = useQuery({
    queryKey: ['xml-notas', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xml_notas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch all items
  const { data: todosItens, isLoading: itensLoading } = useQuery({
    queryKey: ['xml-itens-all', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xml_itens')
        .select('*, xml_notas(numero, fornecedor, data_emissao), insumos(nome)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch manual purchases (stock movements with origin 'manual')
  const { data: comprasManuais, isLoading: comprasManuaisLoading } = useQuery({
    queryKey: ['compras-manuais', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentos')
        .select('*, insumos(nome, unidade_medida, custo_unitario)')
        .eq('tipo', 'entrada')
        .eq('origem', 'manual')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch insumos para mapeamento
  const { data: insumos } = useQuery({
    queryKey: ['insumos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch mapeamentos existentes
  const { data: mapeamentos } = useQuery({
    queryKey: ['mapeamentos', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('produto_mapeamento')
        .select('*, insumos(nome)');
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Pegar item em edição de conversão
  const conversionItem = conversionItemIndex !== null ? parsedNota?.itens[conversionItemIndex] : null;
  const conversionInsumo = conversionItem?.insumo_id ? insumos?.find(i => i.id === conversionItem.insumo_id) : null;

  // Fetch unidades de compra para o insumo selecionado na conversão
  const { data: conversionUnidades } = useQuery({
    queryKey: ['unidades-compra-conversion', conversionInsumo?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades_compra')
        .select('*')
        .eq('insumo_id', conversionInsumo!.id)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!conversionInsumo?.id,
  });

  // Calcular fator de conversão ativo
  const conversionUnidadeSelecionada = conversionUnidades?.find(u => u.id === conversionUnidadeCompraId);
  const conversionFatorAtivo = conversionFatorManual 
    ? (parseFloat(conversionFatorManual) || 1) 
    : (conversionUnidadeSelecionada?.fator_conversao || 1);

  // Reset conversão quando muda insumo
  useEffect(() => {
    if (conversionDialogOpen && conversionInsumo) {
      setConversionUnidadeCompraId('');
      setConversionShowNovaUnidade(false);
    }
  }, [conversionInsumo?.id]);

  // Get unique suppliers for filter
  const fornecedores = [...new Set(notas?.map(n => n.fornecedor).filter(Boolean))];

  // Filter notas
  const filteredNotas = notas?.filter(nota => {
    const matchesSearch = !searchTerm || 
      nota.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nota.fornecedor?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !dateFilter || nota.data_emissao === dateFilter;
    const matchesFornecedor = !fornecedorFilter || nota.fornecedor === fornecedorFilter;
    return matchesSearch && matchesDate && matchesFornecedor;
  });

  // Filter items
  const filteredItens = todosItens?.filter(item => {
    const matchesSearch = !searchTerm ||
      item.produto_descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.xml_notas?.fornecedor?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const parseXmlFile = async (file: File) => {
    const text = await file.text();
    parseXmlContent(text);
  };

  const parseXmlContent = (text: string) => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');

    const nfeProc = xml.querySelector('nfeProc') || xml.querySelector('NFe');
    const infNFe = nfeProc?.querySelector('infNFe');
    
    if (!infNFe) {
      toast({
        title: 'Erro ao ler XML',
        description: 'Formato de NF-e não reconhecido',
        variant: 'destructive',
      });
      return;
    }

    const ide = infNFe.querySelector('ide');
    const emit = infNFe.querySelector('emit');
    const total = infNFe.querySelector('total ICMSTot');

    const numero = ide?.querySelector('nNF')?.textContent || '';
    const fornecedor = emit?.querySelector('xNome')?.textContent || '';
    const dataEmissao = ide?.querySelector('dhEmi')?.textContent?.split('T')[0] || '';
    const valorTotal = parseFloat(total?.querySelector('vNF')?.textContent || '0');

    const dets = infNFe.querySelectorAll('det');
    const itens: XmlItem[] = [];

    dets.forEach((det) => {
      const prod = det.querySelector('prod');
      if (!prod) return;

      const descricao = prod.querySelector('xProd')?.textContent || '';
      const ean = prod.querySelector('cEAN')?.textContent || '';
      const quantidade = parseFloat(prod.querySelector('qCom')?.textContent || '0');
      const unidade = prod.querySelector('uCom')?.textContent || 'un';
      const valorTotalItem = parseFloat(prod.querySelector('vProd')?.textContent || '0');
      const custoUnitario = quantidade > 0 ? valorTotalItem / quantidade : 0;

      const mapeamento = mapeamentos?.find(m => 
        m.ean_gtin === ean || 
        m.descricao_nota?.toLowerCase() === descricao.toLowerCase()
      );

      // Calcular conversão se mapeamento existir com fator
      const fatorConv = mapeamento?.unidade_conversao || 1;
      const qtdConvertida = quantidade * fatorConv;
      const custoConvertido = qtdConvertida > 0 ? valorTotalItem / qtdConvertida : 0;

      itens.push({
        produto_descricao: descricao,
        ean: ean,
        quantidade: quantidade,
        unidade: unidade,
        valor_total: valorTotalItem,
        custo_unitario: custoUnitario,
        insumo_id: mapeamento?.insumo_id || undefined,
        mapeado: !!mapeamento,
        fator_conversao: mapeamento ? fatorConv : undefined,
        quantidade_convertida: mapeamento ? qtdConvertida : undefined,
        custo_unitario_convertido: mapeamento ? custoConvertido : undefined,
      });
    });

    setParsedNota({
      numero,
      fornecedor,
      data_emissao: dataEmissao,
      valor_total: valorTotal,
      itens,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseXmlFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const isPdf = file.type === 'application/pdf';
    
    if (isPdf) {
      const url = URL.createObjectURL(file);
      setFilePreview({ url, type: 'pdf', name: file.name });
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview({ url: reader.result as string, type: 'image', name: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  const clearFilePreview = () => {
    if (filePreview?.type === 'pdf') {
      URL.revokeObjectURL(filePreview.url);
    }
    setFilePreview(null);
    setSelectedFile(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const processFileWithAI = async () => {
    if (!selectedFile) return;

    setIsProcessingAI(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedFile);
      });

      const { data, error } = await supabase.functions.invoke('process-nfe', {
        body: { type: 'image', content: base64 }
      });

      if (error) throw error;

      if (data.success && data.data) {
        const nfeData = data.data;
        const itens: XmlItem[] = nfeData.itens?.map((item: any) => {
          const mapeamento = mapeamentos?.find(m => 
            m.descricao_nota?.toLowerCase() === item.descricao?.toLowerCase()
          );
          return {
            produto_descricao: item.descricao || '',
            ean: item.ean || '',
            quantidade: item.quantidade || 0,
            unidade: item.unidade || 'un',
            valor_total: item.valorTotal || 0,
            custo_unitario: item.valorUnitario || 0,
            insumo_id: mapeamento?.insumo_id,
            mapeado: !!mapeamento,
          };
        }) || [];

        setParsedNota({
          numero: nfeData.numero || '',
          fornecedor: nfeData.fornecedor?.nome || '',
          data_emissao: nfeData.dataEmissao || '',
          valor_total: nfeData.valorTotal || 0,
          itens,
        });
        toast({ title: 'Arquivo processado!', description: `${itens.length} itens encontrados.` });
        clearFilePreview();
      } else {
        toast({
          title: 'Erro ao processar arquivo',
          description: data.message || 'Não foi possível extrair dados.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao processar arquivo com IA.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingAI(false);
    }
  };

  const createInsumoMutation = useMutation({
    mutationFn: async (nome: string) => {
      const { data, error } = await supabase
        .from('insumos')
        .insert({
          empresa_id: usuario!.empresa_id,
          nome,
          unidade_medida: selectedItem?.unidade || 'un',
          custo_unitario: selectedItem?.custo_unitario || 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      handleMapItem(data.id);
      setNewInsumoNome('');
    },
  });

  const handleMapItem = async (insumoId: string) => {
    if (!selectedItem || !parsedNota) return;

    await supabase.from('produto_mapeamento').upsert({
      empresa_id: usuario!.empresa_id,
      ean_gtin: selectedItem.ean || null,
      descricao_nota: selectedItem.produto_descricao,
      insumo_id: insumoId,
      fornecedor_cnpj: null,
      codigo_produto_nota: null,
    }, {
      onConflict: 'empresa_id,fornecedor_cnpj,codigo_produto_nota',
    });

    setParsedNota({
      ...parsedNota,
      itens: parsedNota.itens.map(item => 
        item.produto_descricao === selectedItem.produto_descricao
          ? { ...item, insumo_id: insumoId, mapeado: true }
          : item
      ),
    });

    queryClient.invalidateQueries({ queryKey: ['mapeamentos'] });
    setMappingDialogOpen(false);
    setSelectedItem(null);
    toast({ title: 'Item mapeado!' });
  };

  const importarNotaMutation = useMutation({
    mutationFn: async () => {
      if (!parsedNota) throw new Error('Nenhuma nota para importar');

      const { data: nota, error: notaError } = await supabase
        .from('xml_notas')
        .insert({
          empresa_id: usuario!.empresa_id,
          numero: parsedNota.numero,
          fornecedor: parsedNota.fornecedor,
          data_emissao: parsedNota.data_emissao || null,
          valor_total: parsedNota.valor_total,
        })
        .select()
        .single();

      if (notaError) throw notaError;

      for (const item of parsedNota.itens) {
        await supabase.from('xml_itens').insert({
          xml_id: nota.id,
          produto_descricao: item.produto_descricao,
          ean: item.ean,
          quantidade: item.quantidade,
          unidade: item.unidade,
          valor_total: item.valor_total,
          custo_unitario: item.custo_unitario,
          insumo_id: item.insumo_id || null,
          mapeado: item.mapeado || false,
        });

        if (item.insumo_id && item.mapeado) {
          // Get current insumo cost for history
          const { data: insumoAtual } = await supabase
            .from('insumos')
            .select('custo_unitario')
            .eq('id', item.insumo_id)
            .single();
          
          const custoAnterior = insumoAtual?.custo_unitario || 0;
          const variacao = custoAnterior > 0 ? ((item.custo_unitario - custoAnterior) / custoAnterior) * 100 : 0;

          await supabase.from('estoque_movimentos').insert({
            empresa_id: usuario!.empresa_id,
            insumo_id: item.insumo_id,
            tipo: 'entrada',
            quantidade: item.quantidade,
            origem: 'xml',
            referencia: nota.id,
            observacao: `NF-e ${parsedNota.numero} - ${parsedNota.fornecedor}`,
          });

          // Record price history
          await supabase.from('historico_precos').insert({
            empresa_id: usuario!.empresa_id,
            insumo_id: item.insumo_id,
            preco_anterior: custoAnterior,
            preco_novo: item.custo_unitario,
            variacao_percentual: variacao,
            origem: 'xml',
            observacao: `NF-e ${parsedNota.numero} - ${parsedNota.fornecedor}`,
          });

          await supabase
            .from('insumos')
            .update({ custo_unitario: item.custo_unitario })
            .eq('id', item.insumo_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentos'] });
      queryClient.invalidateQueries({ queryKey: ['xml-notas'] });
      queryClient.invalidateQueries({ queryKey: ['xml-itens-all'] });
      queryClient.invalidateQueries({ queryKey: ['historico-precos'] });
      toast({ title: 'Nota importada com sucesso!', description: 'Estoque atualizado.' });
      setParsedNota(null);
      setImportDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: 'Erro ao importar', description: error.message, variant: 'destructive' });
    },
  });

  // Fetch items for selected nota (for viewing details)
  const { data: viewNotaItens, isLoading: viewNotaItensLoading } = useQuery({
    queryKey: ['xml-itens-nota', viewNotaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xml_itens')
        .select('*, insumos(nome)')
        .eq('xml_id', viewNotaId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!viewNotaId,
  });

  // Get the nota being viewed
  const viewingNota = notas?.find(n => n.id === viewNotaId);

  // Delete nota mutation - also reverses stock movements
  const deleteNotaMutation = useMutation({
    mutationFn: async (notaId: string) => {
      // First, get all items from this nota that are mapped to insumos
      const { data: notaItens, error: itensError } = await supabase
        .from('xml_itens')
        .select('*')
        .eq('xml_id', notaId)
        .eq('mapeado', true);
      
      if (itensError) throw itensError;

      // For each mapped item, create a reverse stock movement (saida)
      for (const item of notaItens || []) {
        if (item.insumo_id && item.quantidade) {
          // Create exit movement to reverse the entry
          const { error: movError } = await supabase
            .from('estoque_movimentos')
            .insert({
              empresa_id: usuario?.empresa_id,
              insumo_id: item.insumo_id,
              tipo: 'saida',
              quantidade: item.quantidade,
              origem: 'nfe_exclusao',
              referencia: notaId,
              observacao: `Reversão - Exclusão da NF-e`,
            });
          
          if (movError) throw movError;

          // Update insumo stock
          const { data: insumo, error: insumoError } = await supabase
            .from('insumos')
            .select('estoque_atual')
            .eq('id', item.insumo_id)
            .single();
          
          if (!insumoError && insumo) {
            const novoEstoque = Math.max(0, (insumo.estoque_atual || 0) - item.quantidade);
            await supabase
              .from('insumos')
              .update({ estoque_atual: novoEstoque })
              .eq('id', item.insumo_id);
          }
        }
      }

      // Now delete the nota (this will cascade delete xml_itens due to FK)
      const { error } = await supabase
        .from('xml_notas')
        .delete()
        .eq('id', notaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xml-notas'] });
      queryClient.invalidateQueries({ queryKey: ['xml-itens-all'] });
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentos'] });
      toast({ title: 'Nota excluída com sucesso!', description: 'Estoque revertido.' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir nota', description: error.message, variant: 'destructive' });
    },
  });

  // Manual purchase mutation
  const manualPurchaseMutation = useMutation({
    mutationFn: async (data: typeof manualFormData) => {
      const quantidade = parseFloat(data.quantidade) || 0;
      const custoUnitario = parseFloat(data.custo_unitario) || 0;
      const valorTotal = quantidade * custoUnitario;
      
      // Get current insumo cost for history
      const { data: insumoAtual, error: insumoError } = await supabase
        .from('insumos')
        .select('custo_unitario')
        .eq('id', data.insumo_id)
        .single();
      
      const custoAnterior = insumoAtual?.custo_unitario || 0;
      const variacao = custoAnterior > 0 ? ((custoUnitario - custoAnterior) / custoAnterior) * 100 : 0;
      
      // Insert stock movement
      const { error: movError } = await supabase.from('estoque_movimentos').insert({
        empresa_id: usuario!.empresa_id,
        insumo_id: data.insumo_id,
        tipo: 'entrada',
        quantidade: quantidade,
        origem: 'manual',
        observacao: data.fornecedor ? `Compra - ${data.fornecedor}` : data.observacao || 'Compra manual',
      });
      if (movError) throw movError;

      // Record price history
      await supabase.from('historico_precos').insert({
        empresa_id: usuario!.empresa_id,
        insumo_id: data.insumo_id,
        preco_anterior: custoAnterior,
        preco_novo: custoUnitario,
        variacao_percentual: variacao,
        origem: 'manual',
        observacao: data.fornecedor || 'Compra manual',
      });

      // Calculate stock from all movements (source of truth)
      const { data: movimentos, error: movimentosError } = await supabase
        .from('estoque_movimentos')
        .select('tipo, quantidade')
        .eq('insumo_id', data.insumo_id);
      
      if (movimentosError) throw movimentosError;

      // Calculate correct stock from movements
      const novoEstoque = (movimentos || []).reduce((acc, mov) => {
        const qty = Number(mov.quantidade) || 0;
        return mov.tipo === 'entrada' ? acc + qty : acc - qty;
      }, 0);

      // Update the insumo stock and cost
      const { error: updateError } = await supabase
        .from('insumos')
        .update({ 
          estoque_atual: Math.max(0, novoEstoque),
          custo_unitario: custoUnitario 
        })
        .eq('id', data.insumo_id);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentos'] });
      queryClient.invalidateQueries({ queryKey: ['historico-precos'] });
      toast({ title: 'Compra registrada!', description: 'Estoque atualizado.' });
      resetManualForm();
    },
    onError: (error) => {
      toast({ title: 'Erro ao registrar compra', description: error.message, variant: 'destructive' });
    },
  });

  // Delete manual purchase mutation
  const deleteManualMutation = useMutation({
    mutationFn: async (movimentoId: string) => {
      // Get the movement details first
      const { data: movimento, error: getError } = await supabase
        .from('estoque_movimentos')
        .select('insumo_id, quantidade')
        .eq('id', movimentoId)
        .single();
      
      if (getError) throw getError;
      if (!movimento) throw new Error('Movimento não encontrado');

      // Delete the movement
      const { error: deleteError } = await supabase
        .from('estoque_movimentos')
        .delete()
        .eq('id', movimentoId);
      
      if (deleteError) throw deleteError;

      // Recalculate stock from remaining movements
      const { data: movimentos, error: movimentosError } = await supabase
        .from('estoque_movimentos')
        .select('tipo, quantidade')
        .eq('insumo_id', movimento.insumo_id);
      
      if (movimentosError) throw movimentosError;

      const novoEstoque = (movimentos || []).reduce((acc, mov) => {
        const qty = Number(mov.quantidade) || 0;
        return mov.tipo === 'entrada' ? acc + qty : acc - qty;
      }, 0);

      // Update insumo stock
      const { error: updateError } = await supabase
        .from('insumos')
        .update({ estoque_atual: Math.max(0, novoEstoque) })
        .eq('id', movimento.insumo_id);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentos'] });
      queryClient.invalidateQueries({ queryKey: ['compras-manuais'] });
      toast({ title: 'Compra excluída!', description: 'Estoque atualizado.' });
      setDeleteManualId(null);
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir compra', description: error.message, variant: 'destructive' });
    },
  });

  const resetManualForm = () => {
    setManualFormData({
      insumo_id: '',
      quantidade: '',
      custo_unitario: '',
      fornecedor: '',
      observacao: '',
    });
  };

  // Check cost variation for manual purchase
  const checkCostVariation = (insumoId: string, novoCusto: number): { variacao: number; custoAtual: number; insumoNome: string } | null => {
    const insumo = insumos?.find(i => i.id === insumoId);
    if (!insumo || !insumo.custo_unitario || insumo.custo_unitario === 0) return null;
    
    const custoAtual = Number(insumo.custo_unitario);
    const variacao = ((novoCusto - custoAtual) / custoAtual) * 100;
    
    return {
      variacao,
      custoAtual,
      insumoNome: insumo.nome,
    };
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const novoCusto = parseFloat(manualFormData.custo_unitario) || 0;
    const variation = checkCostVariation(manualFormData.insumo_id, novoCusto);
    
    // If variation > 15%, show warning
    if (variation && Math.abs(variation.variacao) > 15) {
      setCostVariationWarning({
        show: true,
        type: 'manual',
        insumoNome: variation.insumoNome,
        custoAtual: variation.custoAtual,
        custoNovo: novoCusto,
        variacao: variation.variacao,
        onConfirm: () => {
          manualPurchaseMutation.mutate(manualFormData);
          setCostVariationWarning(null);
        },
      });
    } else {
      manualPurchaseMutation.mutate(manualFormData);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const itensMapeados = parsedNota?.itens.filter(i => i.mapeado).length || 0;
  const totalItens = parsedNota?.itens.length || 0;

  // Calculate totals
  const totalNotasCompras = notas?.reduce((acc, nota) => acc + (nota.valor_total || 0), 0) || 0;
  const totalManuaisCompras = comprasManuais?.reduce((acc, c) => {
    const custo = (c.insumos as any)?.custo_unitario || 0;
    return acc + (Number(c.quantidade) * custo);
  }, 0) || 0;
  const totalCompras = totalNotasCompras + totalManuaisCompras;
  const totalNotasCount = notas?.length || 0;
  const totalManuaisCount = comprasManuais?.length || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Compras</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Gerencie suas notas fiscais e itens comprados</p>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:justify-end">
          <Button
            variant="outline"
            onClick={() => setCompraDialogOpen(true)}
            className="gap-2 w-full min-w-0"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">Registrar Compra</span>
          </Button>
          <Button onClick={() => setImportDialogOpen(true)} className="gap-2 w-full min-w-0">
            <Upload className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">Importar NF-e</span>
          </Button>
        </div>
      </div>

      {/* New Purchase Dialog with Unit Conversion */}
      <RegistrarCompraDialog
        open={compraDialogOpen}
        onOpenChange={setCompraDialogOpen}
      />

      {/* Legacy Manual Purchase Dialog - kept for reference but replaced by RegistrarCompraDialog above */}

      {/* Summary Cards */}
      <div className="grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total em Compras</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <p className="text-2xl font-bold whitespace-nowrap">{formatCurrency(totalCompras)}</p>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Notas Importadas</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <p className="text-2xl font-bold whitespace-nowrap">{totalNotasCount}</p>
          </CardContent>
        </Card>
        <Card className="min-w-0 col-span-2 sm:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compras Manuais</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
            <p className="text-2xl font-bold whitespace-nowrap">{totalManuaisCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3">
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, fornecedor ou produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
              <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
                <SelectTrigger className="w-full min-w-0 sm:w-[220px]">
                  <SelectValue placeholder="Fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {fornecedores.map((f) => (
                    <SelectItem key={f} value={f!}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full sm:w-[160px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="notas" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="notas" className="gap-2 shrink-0">
            <FileText className="h-4 w-4" />
            Notas Fiscais
          </TabsTrigger>
          <TabsTrigger value="manuais" className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Compras Manuais
          </TabsTrigger>
          <TabsTrigger value="itens" className="gap-2 shrink-0">
            <Package className="h-4 w-4" />
            Itens Detalhados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notas">
          <Card>
            <CardHeader>
              <CardTitle>Notas Fiscais Importadas</CardTitle>
              <CardDescription>Lista de todas as notas fiscais de compra</CardDescription>
            </CardHeader>
            <CardContent>
              {notasLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredNotas && filteredNotas.length > 0 ? (
                <MobileDataView
                  data={filteredNotas}
                  keyExtractor={(nota) => nota.id}
                  columns={[
                    { key: 'numero', header: 'Número', mobilePriority: 1, render: (n) => <span className="font-medium">{n.numero || '-'}</span> },
                    { key: 'fornecedor', header: 'Fornecedor', mobilePriority: 2, render: (n) => <span className="break-words">{n.fornecedor || '-'}</span> },
                    { key: 'data', header: 'Data Emissão', mobilePriority: 3, render: (n) => formatDate(n.data_emissao) },
                    { key: 'valor', header: 'Valor Total', align: 'right', mobilePriority: 4, render: (n) => formatCurrency(n.valor_total || 0) },
                  ]}
                  onItemClick={(nota) => setViewNotaId(nota.id)}
                  renderMobileHeader={(n) => (
                    <span className="min-w-0 whitespace-normal break-words leading-snug">
                      {n.fornecedor || 'Sem fornecedor'}
                    </span>
                  )}
                  renderMobileSubtitle={(n) => `NF ${n.numero || '-'} • ${formatDate(n.data_emissao)}`}
                  renderMobileHighlight={(n) => <span className="font-bold whitespace-nowrap">{formatCurrency(n.valor_total || 0)}</span>}
                  renderActions={(nota) => (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setViewNotaId(nota.id); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeleteNotaId(nota.id); }} disabled={deleteNotaMutation.isPending}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  emptyMessage="Nenhuma nota fiscal encontrada"
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma nota fiscal encontrada</p>
                  <p className="text-sm">Clique em "Importar NF-e" para adicionar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manuais">
          <Card>
            <CardHeader>
              <CardTitle>Compras Manuais</CardTitle>
              <CardDescription>Entradas de estoque registradas manualmente</CardDescription>
            </CardHeader>
            <CardContent>
              {comprasManuaisLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : comprasManuais && comprasManuais.length > 0 ? (
                <MobileDataView
                  data={comprasManuais}
                  keyExtractor={(compra) => compra.id}
                  columns={[
                    { key: 'data', header: 'Data', mobilePriority: 3, render: (c) => <span className="whitespace-nowrap">{formatDate(c.created_at)}</span> },
                    { key: 'insumo', header: 'Insumo', mobilePriority: 1, render: (c) => <span className="font-medium break-words">{(c.insumos as any)?.nome || '-'}</span> },
                    { key: 'quantidade', header: 'Quantidade', align: 'right', mobilePriority: 2, render: (c) => <span className="whitespace-nowrap">{c.quantidade} {(c.insumos as any)?.unidade_medida || 'un'}</span> },
                    { key: 'custoUnit', header: 'Custo Unit.', align: 'right', mobilePriority: 4, render: (c) => <span className="whitespace-nowrap">{formatCurrency((c.insumos as any)?.custo_unitario || 0)}</span> },
                    { key: 'total', header: 'Total', align: 'right', mobilePriority: 5, render: (c) => {
                      const custoUnit = (c.insumos as any)?.custo_unitario || 0;
                      return <span className="whitespace-nowrap">{formatCurrency(Number(c.quantidade) * custoUnit)}</span>;
                    }},
                    { key: 'obs', header: 'Observação', mobilePriority: 6, render: (c) => <span className="text-muted-foreground break-words">{c.observacao || '-'}</span> },
                  ]}
                  renderMobileHeader={(c) => (
                    <span className="min-w-0 whitespace-normal break-words leading-snug">
                      {(c.insumos as any)?.nome || 'Insumo'}
                    </span>
                  )}
                  renderMobileSubtitle={(c) => `${formatDate(c.created_at)} • ${c.quantidade} ${(c.insumos as any)?.unidade_medida || 'un'}`}
                  renderMobileHighlight={(c) => {
                    const custoUnit = (c.insumos as any)?.custo_unitario || 0;
                    return <span className="font-bold whitespace-nowrap">{formatCurrency(Number(c.quantidade) * custoUnit)}</span>;
                  }}
                  renderActions={(compra) => (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteManualId(compra.id)} disabled={deleteManualMutation.isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  emptyMessage="Nenhuma compra manual registrada"
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma compra manual registrada</p>
                  <p className="text-sm">Clique em "Compra Manual" para adicionar</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="itens">
          <Card>
            <CardHeader>
              <CardTitle>Itens de Compra</CardTitle>
              <CardDescription>Todos os itens das notas fiscais importadas</CardDescription>
            </CardHeader>
            <CardContent>
              {itensLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredItens && filteredItens.length > 0 ? (
                <MobileDataView
                  data={filteredItens}
                  keyExtractor={(item) => item.id}
                  columns={[
                    { key: 'produto', header: 'Produto', mobilePriority: 1, render: (i) => <span className="font-medium break-words">{i.produto_descricao}</span> },
                    { key: 'fornecedor', header: 'Fornecedor', mobilePriority: 4, render: (i) => <span className="text-muted-foreground break-words">{i.xml_notas?.fornecedor || '-'}</span> },
                    { key: 'qtd', header: 'Qtd', align: 'right', mobilePriority: 2, render: (i) => `${i.quantidade} ${i.unidade}` },
                    { key: 'custoUnit', header: 'Custo Unit.', align: 'right', mobilePriority: 5, render: (i) => formatCurrency(i.custo_unitario || 0) },
                    { key: 'total', header: 'Total', align: 'right', mobilePriority: 3, render: (i) => formatCurrency(i.valor_total || 0) },
                    { key: 'insumo', header: 'Insumo', mobilePriority: 6, render: (i) => i.insumos ? (
                      <Badge variant="default" className="gap-1 whitespace-nowrap"><Check className="h-3 w-3" />{i.insumos.nome}</Badge>
                    ) : <Badge variant="secondary">Não mapeado</Badge> },
                  ]}
                  renderMobileHeader={(i) => (
                    <span className="min-w-0 whitespace-normal break-words leading-snug">
                      {i.produto_descricao}
                    </span>
                  )}
                  renderMobileSubtitle={(i) => (
                    <span className="min-w-0 whitespace-normal break-words">
                      {i.xml_notas?.fornecedor || '-'} • {i.quantidade} {i.unidade}
                    </span>
                  )}
                  renderMobileHighlight={(i) => <span className="font-bold whitespace-nowrap">{formatCurrency(i.valor_total || 0)}</span>}
                  emptyMessage="Nenhum item encontrado"
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum item encontrado</p>
                  <p className="text-sm">Importe notas fiscais para ver os itens</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        setImportDialogOpen(open);
        if (!open) {
          setParsedNota(null);
          clearFilePreview();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Nota Fiscal</DialogTitle>
          </DialogHeader>
          
          {!parsedNota ? (
            <Tabs value={importTab} onValueChange={setImportTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="xml" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  XML
                </TabsTrigger>
                <TabsTrigger value="foto" className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Foto/PDF
                </TabsTrigger>
              </TabsList>

              <TabsContent value="xml">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Upload className="h-5 w-5" />
                      Upload de XML
                    </CardTitle>
                    <CardDescription>
                      Selecione um arquivo XML de NF-e ou NFC-e
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Input
                      type="file"
                      accept=".xml"
                      onChange={handleFileChange}
                      className="max-w-md"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="foto">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Camera className="h-5 w-5" />
                      Foto ou PDF do DANFE/Cupom
                    </CardTitle>
                    <CardDescription>
                      Envie uma foto ou PDF do cupom fiscal. A IA extrai os dados automaticamente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!filePreview ? (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3">
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
                                      setFilePreview({ url: base64, type: 'image', name: 'camera-photo.jpg' });
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
                                      setFilePreview({ url: base64, type: 'image', name: 'gallery-photo.jpg' });
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
                                Escolher da Galeria
                              </Button>
                            </>
                          ) : (
                            <>
                              <div className="flex-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={handleFileSelect}
                                  disabled={isProcessingAI}
                                  className="hidden"
                                  id="camera-input-dialog"
                                />
                                <label htmlFor="camera-input-dialog">
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
                              </div>
                              <div className="flex-1">
                                <input
                                  ref={imageInputRef}
                                  type="file"
                                  accept="image/*,application/pdf"
                                  onChange={handleFileSelect}
                                  disabled={isProcessingAI}
                                  className="hidden"
                                  id="file-input-dialog"
                                />
                                <label htmlFor="file-input-dialog">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full cursor-pointer"
                                    disabled={isProcessingAI}
                                    asChild
                                  >
                                    <span>
                                      <Upload className="h-4 w-4 mr-2" />
                                      Escolher Arquivo
                                    </span>
                                  </Button>
                                </label>
                              </div>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Formatos aceitos: JPG, PNG, WEBP, PDF
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="border rounded-lg overflow-hidden bg-muted/50">
                          {filePreview.type === 'image' ? (
                            <img 
                              src={filePreview.url} 
                              alt="Preview" 
                              className="max-h-64 w-auto mx-auto object-contain"
                            />
                          ) : (
                            <iframe
                              src={filePreview.url}
                              className="w-full h-64"
                              title="PDF Preview"
                            />
                          )}
                          <div className="p-2 bg-muted flex items-center justify-between">
                            <span className="text-sm text-muted-foreground truncate max-w-xs">
                              {filePreview.name}
                            </span>
                            <Badge variant="outline">
                              {filePreview.type === 'pdf' ? 'PDF' : 'Imagem'}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={processFileWithAI}
                            disabled={isProcessingAI}
                          >
                            {isProcessingAI ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Processando...
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
                            Trocar arquivo
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        NF-e {parsedNota.numero || '(sem número)'}
                      </CardTitle>
                      <CardDescription>
                        {parsedNota.fornecedor || 'Fornecedor não identificado'}
                        {parsedNota.data_emissao && ` • ${parsedNota.data_emissao}`}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{formatCurrency(parsedNota.valor_total)}</p>
                      {totalItens > 0 && (
                        <Badge variant={itensMapeados === totalItens ? 'default' : 'secondary'}>
                          {itensMapeados}/{totalItens} itens mapeados
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Actions for unmapped items */}
                  {parsedNota.itens.some(i => !i.mapeado) && (
                    <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground w-full mb-1">
                        {parsedNota.itens.filter(i => !i.mapeado).length} item(ns) não mapeado(s)
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const unmappedItems = parsedNota.itens.filter(i => !i.mapeado);
                          const updatedItens = [...parsedNota.itens];
                          
                          for (let i = 0; i < unmappedItems.length; i++) {
                            const item = unmappedItems[i];
                            const { data: newInsumo, error } = await supabase
                              .from('insumos')
                              .insert({
                                empresa_id: usuario!.empresa_id,
                                nome: item.produto_descricao,
                                unidade_medida: item.unidade || 'un',
                                custo_unitario: item.custo_unitario || 0,
                              })
                              .select()
                              .single();
                            
                            if (!error && newInsumo) {
                              await supabase.from('produto_mapeamento').upsert({
                                empresa_id: usuario!.empresa_id,
                                ean_gtin: item.ean || null,
                                descricao_nota: item.produto_descricao,
                                insumo_id: newInsumo.id,
                                fornecedor_cnpj: null,
                                codigo_produto_nota: null,
                              }, {
                                onConflict: 'empresa_id,fornecedor_cnpj,codigo_produto_nota',
                              });
                              
                              // Update the item in our local array
                              const idx = updatedItens.findIndex(ui => ui.produto_descricao === item.produto_descricao);
                              if (idx !== -1) {
                                updatedItens[idx] = { ...updatedItens[idx], insumo_id: newInsumo.id, mapeado: true };
                              }
                            }
                          }
                          
                          queryClient.invalidateQueries({ queryKey: ['insumos'] });
                          queryClient.invalidateQueries({ queryKey: ['mapeamentos'] });
                          setParsedNota({
                            ...parsedNota,
                            itens: updatedItens,
                          });
                          toast({ 
                            title: 'Insumos criados!', 
                            description: `${unmappedItems.length} insumo(s) cadastrado(s) automaticamente.` 
                          });
                        }}
                        className="gap-1"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        Cadastrar todos como insumos
                      </Button>
                    </div>
                  )}

                  {parsedNota.itens.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right w-24">Qtd Nota</TableHead>
                            <TableHead className="text-right w-24">Qtd Conv.</TableHead>
                            <TableHead className="text-right w-28">Custo/Un</TableHead>
                            <TableHead className="text-right w-24">Total</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedNota.itens.map((item, index) => {
                            const insumoMapeado = insumos?.find(i => i.id === item.insumo_id);
                            const fator = item.fator_conversao || 1;
                            const qtdConv = item.quantidade_convertida || item.quantidade * fator;
                            const custoConv = item.custo_unitario_convertido || (qtdConv > 0 ? item.valor_total / qtdConv : 0);
                            
                            // Detectar possível erro de conversão: unidades diferentes mas fator = 1
                            const unidadeXml = item.unidade?.toLowerCase().trim();
                            const unidadeInsumo = insumoMapeado?.unidade_medida?.toLowerCase().trim();
                            const unidadesDiferentes = unidadeXml && unidadeInsumo && unidadeXml !== unidadeInsumo;
                            const possivelErroConversao = item.mapeado && unidadesDiferentes && fator === 1;
                            
                            return (
                              <TableRow key={index} className={possivelErroConversao ? 'bg-warning/10' : ''}>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => {
                                        const newItens = parsedNota.itens.filter((_, i) => i !== index);
                                        const newValorTotal = newItens.reduce((acc, i) => acc + i.valor_total, 0);
                                        setParsedNota({
                                          ...parsedNota,
                                          itens: newItens,
                                          valor_total: newValorTotal,
                                        });
                                        if (editingItemIndex === index) setEditingItemIndex(null);
                                        toast({ title: 'Item removido da importação' });
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => setEditingItemIndex(editingItemIndex === index ? null : index)}
                                      title="Editar item"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {editingItemIndex === index ? (
                                    <Input
                                      value={item.produto_descricao}
                                      onChange={(e) => {
                                        const newItens = [...parsedNota.itens];
                                        newItens[index] = { ...newItens[index], produto_descricao: e.target.value };
                                        setParsedNota({ ...parsedNota, itens: newItens });
                                      }}
                                      className="h-8 text-sm"
                                    />
                                  ) : (
                                    <div>
                                      <span className="max-w-[200px] truncate block">{item.produto_descricao}</span>
                                      {item.mapeado && insumoMapeado && (
                                        <p className="text-xs text-muted-foreground">
                                          → {insumoMapeado.nome}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {editingItemIndex === index ? (
                                    <Input
                                      type="number"
                                      step="0.001"
                                      min="0"
                                      value={item.quantidade}
                                      onChange={(e) => {
                                        const newQtd = parseFloat(e.target.value) || 0;
                                        const newItens = [...parsedNota.itens];
                                        const newTotal = newQtd * item.custo_unitario;
                                        newItens[index] = { ...newItens[index], quantidade: newQtd, valor_total: newTotal };
                                        const notaTotal = newItens.reduce((acc, i) => acc + i.valor_total, 0);
                                        setParsedNota({ ...parsedNota, itens: newItens, valor_total: notaTotal });
                                      }}
                                      className="h-8 text-sm w-20 text-right"
                                    />
                                  ) : (
                                    <span className="whitespace-nowrap">{item.quantidade} {item.unidade}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {item.mapeado && insumoMapeado ? (
                                    <div className="flex items-center gap-1 justify-end">
                                      <span className={fator !== 1 ? 'text-primary font-medium' : ''}>
                                        {qtdConv.toFixed(2)} {insumoMapeado.unidade_medida}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-6 w-6 ${possivelErroConversao ? 'text-warning' : ''}`}
                                        title={`Editar conversão (fator atual: ${fator})`}
                                        onClick={() => {
                                          setConversionItemIndex(index);
                                          setConversionUnidadeCompraId('');
                                          setConversionShowNovaUnidade(false);
                                          setConversionNovaUnidadeNome('');
                                          setConversionFatorManual(String(fator));
                                          setConversionDialogOpen(true);
                                        }}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {editingItemIndex === index ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={item.custo_unitario}
                                      onChange={(e) => {
                                        const newCusto = parseFloat(e.target.value) || 0;
                                        const newItens = [...parsedNota.itens];
                                        const newTotal = item.quantidade * newCusto;
                                        newItens[index] = { ...newItens[index], custo_unitario: newCusto, valor_total: newTotal };
                                        const notaTotal = newItens.reduce((acc, i) => acc + i.valor_total, 0);
                                        setParsedNota({ ...parsedNota, itens: newItens, valor_total: notaTotal });
                                      }}
                                      className="h-8 text-sm w-24 text-right"
                                    />
                                  ) : (
                                    <div className="flex flex-col items-end">
                                      {item.mapeado && insumoMapeado ? (
                                        <span className="text-xs">
                                          {new Intl.NumberFormat('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                            minimumFractionDigits: 4,
                                          }).format(custoConv)}/{insumoMapeado.unidade_medida}
                                        </span>
                                      ) : (
                                        <span>{formatCurrency(item.custo_unitario)}</span>
                                      )}
                                      {(() => {
                                        if (!item.insumo_id || !item.mapeado) return null;
                                        const insumo = insumos?.find(i => i.id === item.insumo_id);
                                        if (!insumo || !insumo.custo_unitario || insumo.custo_unitario === 0) return null;
                                        const variacaoCusto = ((custoConv - insumo.custo_unitario) / insumo.custo_unitario) * 100;
                                        if (Math.abs(variacaoCusto) < 1) return null;
                                        return (
                                          <span className={`text-xs ${Math.abs(variacaoCusto) > 15 ? 'text-destructive font-medium' : variacaoCusto > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                                            {variacaoCusto > 0 ? '+' : ''}{variacaoCusto.toFixed(1)}%
                                            {Math.abs(variacaoCusto) > 15 && ' ⚠️'}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(item.valor_total)}</TableCell>
                                <TableCell className="text-center">
                                  {possivelErroConversao ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant="outline" className="gap-1 border-warning text-warning cursor-help">
                                            <AlertTriangle className="h-3 w-3" />
                                            Verificar
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          <p className="font-medium">Possível erro de conversão</p>
                                          <p className="text-xs mt-1">
                                            Unidade da nota ({item.unidade}) difere do insumo ({insumoMapeado?.unidade_medida}), 
                                            mas o fator de conversão é 1. Configure a conversão na página de Importar XML.
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : item.mapeado ? (
                                    <Badge variant="default" className="gap-1">
                                      <Check className="h-3 w-3" />
                                      Mapeado
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive" className="gap-1">
                                      <AlertCircle className="h-3 w-3" />
                                      Não mapeado
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {!item.mapeado && (
                                    <div className="flex gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedItem(item);
                                          setMappingDialogOpen(true);
                                        }}
                                      >
                                        <Link2 className="h-4 w-4 mr-1" />
                                        Mapear
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        title="Cadastrar como insumo"
                                        onClick={async () => {
                                          const { data: newInsumo, error } = await supabase
                                            .from('insumos')
                                            .insert({
                                              empresa_id: usuario!.empresa_id,
                                              nome: item.produto_descricao,
                                              unidade_medida: item.unidade || 'un',
                                              custo_unitario: item.custo_unitario || 0,
                                            })
                                            .select()
                                            .single();
                                          
                                          if (error) {
                                            toast({ title: 'Erro ao criar insumo', variant: 'destructive' });
                                            return;
                                          }

                                          await supabase.from('produto_mapeamento').upsert({
                                            empresa_id: usuario!.empresa_id,
                                            ean_gtin: item.ean || null,
                                            descricao_nota: item.produto_descricao,
                                            insumo_id: newInsumo.id,
                                            fornecedor_cnpj: null,
                                            codigo_produto_nota: null,
                                          }, {
                                            onConflict: 'empresa_id,fornecedor_cnpj,codigo_produto_nota',
                                          });

                                          setParsedNota({
                                            ...parsedNota,
                                            itens: parsedNota.itens.map((i, idx) => 
                                              idx === index 
                                                ? { ...i, insumo_id: newInsumo.id, mapeado: true }
                                                : i
                                            ),
                                          });
                                          queryClient.invalidateQueries({ queryKey: ['insumos'] });
                                          queryClient.invalidateQueries({ queryKey: ['mapeamentos'] });
                                          toast({ title: 'Insumo criado!', description: `"${item.produto_descricao}" cadastrado.` });
                                        }}
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum item encontrado na nota fiscal.</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-4 border-t">
                    {parsedNota.itens.some(i => !i.mapeado) && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Todos os itens precisam estar mapeados para importar a nota
                      </p>
                    )}
                    {(() => {
                      // Check for cost variations > 15% in mapped items
                      const itensComVariacao = parsedNota.itens.filter(item => {
                        if (!item.insumo_id || !item.mapeado) return false;
                        const insumo = insumos?.find(i => i.id === item.insumo_id);
                        if (!insumo || !insumo.custo_unitario || insumo.custo_unitario === 0) return false;
                        const variacao = ((item.custo_unitario - insumo.custo_unitario) / insumo.custo_unitario) * 100;
                        return Math.abs(variacao) > 15;
                      });

                      if (itensComVariacao.length > 0) {
                        return (
                          <p className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            {itensComVariacao.length} item(ns) com variação de custo &gt; 15%
                          </p>
                        );
                      }
                      return null;
                    })()}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setParsedNota(null)}>
                        Voltar
                      </Button>
                      {parsedNota.itens.length > 0 && (
                        <Button
                          onClick={() => {
                            // Check for significant cost variations before importing
                            const itensComVariacao = parsedNota.itens.filter(item => {
                              if (!item.insumo_id || !item.mapeado) return false;
                              const insumo = insumos?.find(i => i.id === item.insumo_id);
                              if (!insumo || !insumo.custo_unitario || insumo.custo_unitario === 0) return false;
                              const variacao = ((item.custo_unitario - insumo.custo_unitario) / insumo.custo_unitario) * 100;
                              return Math.abs(variacao) > 15;
                            });

                            if (itensComVariacao.length > 0) {
                              // Find the item with the largest variation for the warning
                              let maxVariation = 0;
                              let maxVariationItem: any = null;
                              let maxVariationInsumo: any = null;

                              itensComVariacao.forEach(item => {
                                const insumo = insumos?.find(i => i.id === item.insumo_id);
                                if (insumo) {
                                  const variacao = ((item.custo_unitario - insumo.custo_unitario) / insumo.custo_unitario) * 100;
                                  if (Math.abs(variacao) > Math.abs(maxVariation)) {
                                    maxVariation = variacao;
                                    maxVariationItem = item;
                                    maxVariationInsumo = insumo;
                                  }
                                }
                              });

                              setCostVariationWarning({
                                show: true,
                                type: 'import',
                                insumoNome: itensComVariacao.length > 1 
                                  ? `${maxVariationInsumo?.nome} e mais ${itensComVariacao.length - 1} item(ns)`
                                  : maxVariationInsumo?.nome,
                                custoAtual: maxVariationInsumo?.custo_unitario || 0,
                                custoNovo: maxVariationItem?.custo_unitario || 0,
                                variacao: maxVariation,
                                onConfirm: () => {
                                  importarNotaMutation.mutate();
                                  setCostVariationWarning(null);
                                },
                              });
                            } else {
                              importarNotaMutation.mutate();
                            }
                          }}
                          disabled={importarNotaMutation.isPending || parsedNota.itens.some(i => !i.mapeado)}
                        >
                          {importarNotaMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          Importar Nota
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mapear Item para Insumo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedItem?.produto_descricao}</p>
              <p className="text-sm text-muted-foreground">
                EAN: {selectedItem?.ean || 'N/A'} • {formatCurrency(selectedItem?.custo_unitario || 0)}/{selectedItem?.unidade}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Vincular a insumo existente</Label>
              <Select onValueChange={handleMapItem}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um insumo" />
                </SelectTrigger>
                <SelectContent>
                  {insumos?.map((insumo) => (
                    <SelectItem key={insumo.id} value={insumo.id}>
                      {insumo.nome} ({insumo.unidade_medida})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Criar novo insumo</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do insumo"
                  value={newInsumoNome}
                  onChange={(e) => setNewInsumoNome(e.target.value)}
                />
                <Button
                  onClick={() => createInsumoMutation.mutate(newInsumoNome)}
                  disabled={!newInsumoNome || createInsumoMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Nota Details Dialog */}
      <Dialog open={!!viewNotaId} onOpenChange={(open) => !open && setViewNotaId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes da Nota Fiscal
            </DialogTitle>
          </DialogHeader>
          
          {viewingNota && (
            <div className="space-y-4">
              {/* Nota Header Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Número</p>
                  <p className="font-medium">{viewingNota.numero || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fornecedor</p>
                  <p className="font-medium">{viewingNota.fornecedor || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data Emissão</p>
                  <p className="font-medium">{formatDate(viewingNota.data_emissao)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="font-medium text-primary">{formatCurrency(viewingNota.valor_total || 0)}</p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-medium mb-2">Itens da Nota ({viewNotaItens?.length || 0})</h4>
                {viewNotaItensLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : viewNotaItens && viewNotaItens.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Vlr Unit.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Insumo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewNotaItens.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium max-w-[200px]">
                              <span className="line-clamp-2">{item.produto_descricao}</span>
                              {item.ean && (
                                <span className="block text-xs text-muted-foreground">EAN: {item.ean}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {item.quantidade} {item.unidade}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(item.custo_unitario || 0)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.valor_total || 0)}</TableCell>
                            <TableCell>
                              {item.mapeado && item.insumos ? (
                                <Badge variant="default" className="gap-1">
                                  <Check className="h-3 w-3" />
                                  {item.insumos.nome}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Não mapeado</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center py-4 text-muted-foreground">Nenhum item encontrado</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setViewNotaId(null)}>
                  Fechar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setViewNotaId(null);
                    setDeleteNotaId(viewingNota.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Nota
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteNotaId} onOpenChange={(open) => !open && setDeleteNotaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Nota Fiscal</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta nota fiscal? Esta ação não pode ser desfeita e o estoque será revertido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteNotaId) {
                  deleteNotaMutation.mutate(deleteNotaId);
                  setDeleteNotaId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteNotaMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Manual Purchase Confirmation Dialog */}
      <AlertDialog open={!!deleteManualId} onOpenChange={(open) => !open && setDeleteManualId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Compra Manual</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta compra manual? O estoque do insumo será revertido automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteManualId) {
                  deleteManualMutation.mutate(deleteManualId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteManualMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cost Variation Warning Dialog */}
      <AlertDialog open={!!costVariationWarning?.show} onOpenChange={(open) => !open && setCostVariationWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-500">
              <AlertCircle className="h-5 w-5" />
              Alerta de Variação de Custo
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                O custo do insumo <span className="font-semibold">{costVariationWarning?.insumoNome}</span> apresenta uma variação significativa:
              </p>
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Custo atual:</span>
                  <span className="font-medium">{formatCurrency(costVariationWarning?.custoAtual || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Novo custo:</span>
                  <span className="font-medium">{formatCurrency(costVariationWarning?.custoNovo || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Variação:</span>
                  <span className={`font-bold ${(costVariationWarning?.variacao || 0) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {(costVariationWarning?.variacao || 0) > 0 ? '+' : ''}{costVariationWarning?.variacao?.toFixed(1)}%
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Variações acima de 15% podem indicar erro de digitação ou mudança significativa no preço do fornecedor. Deseja confirmar esta entrada?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => costVariationWarning?.onConfirm()}
              className="bg-orange-500 text-white hover:bg-orange-600"
            >
              Confirmar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conversion Dialog - igual ao RegistrarCompraDialog */}
      <Dialog open={conversionDialogOpen} onOpenChange={setConversionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Editar Conversão
            </DialogTitle>
          </DialogHeader>

          {conversionItem && conversionInsumo && (
            <div className="space-y-4">
              {/* Item info */}
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{conversionItem.produto_descricao}</p>
                <p className="text-sm text-muted-foreground">
                  {conversionItem.quantidade} {conversionItem.unidade} → {conversionInsumo.nome} ({conversionInsumo.unidade_medida})
                </p>
              </div>

              {/* Unit Selection */}
              <div className="space-y-2">
                <Label>Unidade de Compra</Label>
                {!conversionShowNovaUnidade ? (
                  <Select
                    value={conversionUnidadeCompraId}
                    onValueChange={(value) => {
                      if (value === 'nova') {
                        setConversionShowNovaUnidade(true);
                        setConversionUnidadeCompraId('');
                        setConversionFatorManual('');
                      } else {
                        setConversionUnidadeCompraId(value);
                        setConversionFatorManual('');
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione ou crie uma unidade..." />
                    </SelectTrigger>
                    <SelectContent>
                      {conversionUnidades?.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nome} (1 = {u.fator_conversao} {conversionInsumo.unidade_medida})
                        </SelectItem>
                      ))}
                      <SelectItem value="nova" className="text-primary font-medium">
                        <span className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Nova unidade...
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Nova Unidade de Compra</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setConversionShowNovaUnidade(false);
                          setConversionFatorManual('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome da unidade</Label>
                        <Input
                          placeholder="Ex: pacote 500g"
                          value={conversionNovaUnidadeNome}
                          onChange={(e) => setConversionNovaUnidadeNome(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          1 unidade = X {conversionInsumo.unidade_medida}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Ex: 500"
                          value={conversionFatorManual}
                          onChange={(e) => setConversionFatorManual(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Calculation Preview */}
              {conversionFatorAtivo > 0 && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calculator className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Prévia da Conversão</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {conversionItem.quantidade} {conversionItem.unidade}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge className="bg-primary">
                          {(conversionItem.quantidade * conversionFatorAtivo).toFixed(2)} {conversionInsumo.unidade_medida}
                        </Badge>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Custo por {conversionInsumo.unidade_medida}:</span>
                        <span className="font-bold text-primary">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 4,
                          }).format(conversionItem.valor_total / (conversionItem.quantidade * conversionFatorAtivo))}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConversionDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (conversionItemIndex === null || !parsedNota) return;
                    
                    // Se está criando nova unidade, salvar primeiro
                    if (conversionShowNovaUnidade && conversionNovaUnidadeNome && conversionFatorManual) {
                      const { error } = await supabase
                        .from('unidades_compra')
                        .insert({
                          empresa_id: usuario!.empresa_id,
                          insumo_id: conversionInsumo!.id,
                          nome: conversionNovaUnidadeNome,
                          fator_conversao: parseFloat(conversionFatorManual),
                        });
                      if (error) {
                        toast({ title: 'Erro ao salvar unidade', variant: 'destructive' });
                        return;
                      }
                      queryClient.invalidateQueries({ queryKey: ['unidades-compra-conversion'] });
                      toast({ title: 'Unidade de compra salva!' });
                    }

                    // Atualizar item com novo fator
                    const newFator = conversionFatorAtivo;
                    const newQtdConv = conversionItem!.quantidade * newFator;
                    const newCustoConv = newQtdConv > 0 ? conversionItem!.valor_total / newQtdConv : 0;
                    const newItens = [...parsedNota.itens];
                    newItens[conversionItemIndex] = {
                      ...newItens[conversionItemIndex],
                      fator_conversao: newFator,
                      quantidade_convertida: newQtdConv,
                      custo_unitario_convertido: newCustoConv,
                    };
                    setParsedNota({ ...parsedNota, itens: newItens });
                    setConversionDialogOpen(false);
                    toast({ title: 'Conversão atualizada!' });
                  }}
                  disabled={conversionFatorAtivo <= 0}
                >
                  Aplicar Conversão
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Compras;
