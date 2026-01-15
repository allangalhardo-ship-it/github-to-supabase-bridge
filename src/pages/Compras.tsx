import React, { useState, useRef } from 'react';
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
import { Upload, FileText, Check, AlertCircle, Plus, Link2, Camera, Loader2, ImageIcon, Filter, Calendar, Package, Search, Trash2, Wand2, Pencil, Eye } from 'lucide-react';
import { ScrollableTableWrapper } from '@/components/ui/scrollable-table-wrapper';
import { Checkbox } from '@/components/ui/checkbox';
import { isNativePlatform, takePictureNative, pickImageNative } from '@/lib/cameraUtils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface XmlItem {
  produto_descricao: string;
  ean: string;
  quantidade: number;
  unidade: string;
  valor_total: number;
  custo_unitario: number;
  insumo_id?: string;
  mapeado?: boolean;
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
  const [deleteNotaId, setDeleteNotaId] = useState<string | null>(null);
  const [viewNotaId, setViewNotaId] = useState<string | null>(null);
  
  // Manual purchase dialog state
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
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

      itens.push({
        produto_descricao: descricao,
        ean: ean,
        quantidade: quantidade,
        unidade: unidade,
        valor_total: valorTotalItem,
        custo_unitario: custoUnitario,
        insumo_id: mapeamento?.insumo_id || undefined,
        mapeado: !!mapeamento,
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
    setManualDialogOpen(false);
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
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setManualDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Compra Manual
          </Button>
          <Button onClick={() => setImportDialogOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar NF-e
          </Button>
        </div>
      </div>

      {/* Manual Purchase Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={(open) => {
        setManualDialogOpen(open);
        if (!open) resetManualForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Compra Manual</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="insumo">Insumo</Label>
              <Select
                value={manualFormData.insumo_id}
                onValueChange={(value) => setManualFormData({ ...manualFormData, insumo_id: value })}
              >
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

            {/* Show current cost info when insumo is selected */}
            {manualFormData.insumo_id && (() => {
              const selectedInsumo = insumos?.find(i => i.id === manualFormData.insumo_id);
              const custoAtual = selectedInsumo?.custo_unitario || 0;
              const custoNovo = parseFloat(manualFormData.custo_unitario) || 0;
              const variacao = custoAtual > 0 ? ((custoNovo - custoAtual) / custoAtual) * 100 : 0;
              const showVariation = manualFormData.custo_unitario && custoAtual > 0;
              
              return (
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Custo atual:</span>
                    <span className="font-medium">{formatCurrency(custoAtual)}</span>
                  </div>
                  {showVariation && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Novo custo:</span>
                        <span className="font-medium">{formatCurrency(custoNovo)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Variação:</span>
                        <span className={`font-medium ${Math.abs(variacao) > 15 ? 'text-destructive' : variacao > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                          {variacao > 0 ? '+' : ''}{variacao.toFixed(1)}%
                          {Math.abs(variacao) > 15 && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Alerta
                            </Badge>
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade</Label>
                <Input
                  id="quantidade"
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualFormData.quantidade}
                  onChange={(e) => setManualFormData({ ...manualFormData, quantidade: e.target.value })}
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custo_unitario">Custo Unitário (R$)</Label>
                <Input
                  id="custo_unitario"
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualFormData.custo_unitario}
                  onChange={(e) => setManualFormData({ ...manualFormData, custo_unitario: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fornecedor">Fornecedor (opcional)</Label>
              <Input
                id="fornecedor"
                value={manualFormData.fornecedor}
                onChange={(e) => setManualFormData({ ...manualFormData, fornecedor: e.target.value })}
                placeholder="Nome do fornecedor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <Input
                id="observacao"
                value={manualFormData.observacao}
                onChange={(e) => setManualFormData({ ...manualFormData, observacao: e.target.value })}
                placeholder="Ex: Compra emergencial"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={resetManualForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={manualPurchaseMutation.isPending}>
                Registrar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total em Compras</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalCompras)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Notas Importadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalNotasCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Compras Manuais</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalManuaisCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, fornecedor ou produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
                <SelectTrigger className="w-[180px]">
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
                className="w-[140px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="notas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notas" className="gap-2">
            <FileText className="h-4 w-4" />
            Notas Fiscais
          </TabsTrigger>
          <TabsTrigger value="manuais" className="gap-2">
            <Plus className="h-4 w-4" />
            Compras Manuais
          </TabsTrigger>
          <TabsTrigger value="itens" className="gap-2">
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Data Emissão</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotas.map((nota) => (
                      <TableRow 
                        key={nota.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setViewNotaId(nota.id)}
                      >
                        <TableCell className="font-medium">{nota.numero || '-'}</TableCell>
                        <TableCell>{nota.fornecedor || '-'}</TableCell>
                        <TableCell>{formatDate(nota.data_emissao)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(nota.valor_total || 0)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewNotaId(nota.id);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteNotaId(nota.id);
                              }}
                              disabled={deleteNotaMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
              <ScrollableTableWrapper>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">Data</TableHead>
                        <TableHead className="min-w-[120px]">Insumo</TableHead>
                        <TableHead className="text-right min-w-[100px]">Quantidade</TableHead>
                        <TableHead className="text-right min-w-[100px]">Custo Unit.</TableHead>
                        <TableHead className="text-right min-w-[90px]">Total</TableHead>
                        <TableHead className="min-w-[120px]">Observação</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comprasManuais.map((compra) => {
                        const insumoData = compra.insumos as any;
                        const custoUnit = insumoData?.custo_unitario || 0;
                        const total = Number(compra.quantidade) * custoUnit;
                        return (
                          <TableRow key={compra.id}>
                            <TableCell className="whitespace-nowrap">{formatDate(compra.created_at)}</TableCell>
                            <TableCell className="font-medium">{insumoData?.nome || '-'}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {compra.quantidade} {insumoData?.unidade_medida || 'un'}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(custoUnit)}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">{formatCurrency(total)}</TableCell>
                            <TableCell className="text-muted-foreground max-w-[200px] truncate">
                              {compra.observacao || '-'}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteManualId(compra.id)}
                                disabled={deleteManualMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollableTableWrapper>
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
              <ScrollableTableWrapper>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Custo Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Insumo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItens.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium max-w-[200px] truncate">{item.produto_descricao}</TableCell>
                          <TableCell className="text-muted-foreground">{item.xml_notas?.fornecedor || '-'}</TableCell>
                          <TableCell className="text-right">{item.quantidade} {item.unidade}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.custo_unitario || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.valor_total || 0)}</TableCell>
                          <TableCell>
                            {item.insumos ? (
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
                </ScrollableTableWrapper>
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
                            <TableHead className="text-right w-24">Qtd</TableHead>
                            <TableHead className="text-right w-28">Vlr Unit.</TableHead>
                            <TableHead className="text-right w-24">Total</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedNota.itens.map((item, index) => (
                            <TableRow key={index}>
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
                                  <span className="max-w-[200px] truncate block">{item.produto_descricao}</span>
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
                                    <span>{formatCurrency(item.custo_unitario)}</span>
                                    {item.insumo_id && item.mapeado && (() => {
                                      const insumo = insumos?.find(i => i.id === item.insumo_id);
                                      if (!insumo || !insumo.custo_unitario || insumo.custo_unitario === 0) return null;
                                      const variacao = ((item.custo_unitario - insumo.custo_unitario) / insumo.custo_unitario) * 100;
                                      if (Math.abs(variacao) < 1) return null;
                                      return (
                                        <span className={`text-xs ${Math.abs(variacao) > 15 ? 'text-destructive font-medium' : variacao > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                                          {variacao > 0 ? '+' : ''}{variacao.toFixed(1)}%
                                          {Math.abs(variacao) > 15 && ' ⚠️'}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(item.valor_total)}</TableCell>
                              <TableCell className="text-center">
                                {item.mapeado ? (
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
                          ))}
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
    </div>
  );
};

export default Compras;
