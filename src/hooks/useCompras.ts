import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { inserirMovimentoEstoque, calcularEstoqueDeMovimentos } from '@/lib/estoqueUtils';

export interface XmlItem {
  produto_descricao: string;
  ean: string;
  quantidade: number;
  unidade: string;
  valor_total: number;
  custo_unitario: number;
  insumo_id?: string;
  mapeado?: boolean;
  fator_conversao?: number;
  quantidade_convertida?: number;
  custo_unitario_convertido?: number;
}

export interface ParsedNota {
  numero: string;
  fornecedor: string;
  data_emissao: string;
  valor_total: number;
  itens: XmlItem[];
}

export function useCompras() {
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

  // Conversão
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false);
  const [conversionItemIndex, setConversionItemIndex] = useState<number | null>(null);
  const [conversionUnidadeCompraId, setConversionUnidadeCompraId] = useState('');
  const [conversionShowNovaUnidade, setConversionShowNovaUnidade] = useState(false);
  const [conversionNovaUnidadeNome, setConversionNovaUnidadeNome] = useState('');
  const [conversionFatorManual, setConversionFatorManual] = useState('');

  const [deleteNotaId, setDeleteNotaId] = useState<string | null>(null);
  const [viewNotaId, setViewNotaId] = useState<string | null>(null);
  const [compraDialogOpen, setCompraDialogOpen] = useState(false);
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

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [fornecedorFilter, setFornecedorFilter] = useState('');

  // Queries
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

  const conversionItem = conversionItemIndex !== null ? parsedNota?.itens[conversionItemIndex] : null;
  const conversionInsumo = conversionItem?.insumo_id ? insumos?.find(i => i.id === conversionItem.insumo_id) : null;

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

  const conversionUnidadeSelecionada = conversionUnidades?.find(u => u.id === conversionUnidadeCompraId);
  const conversionFatorAtivo = conversionFatorManual
    ? (parseFloat(conversionFatorManual) || 1)
    : (conversionUnidadeSelecionada?.fator_conversao || 1);

  useEffect(() => {
    if (conversionDialogOpen && conversionInsumo) {
      setConversionUnidadeCompraId('');
      setConversionShowNovaUnidade(false);
    }
  }, [conversionInsumo?.id]);

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

  // Derived data
  const fornecedores = [...new Set(notas?.map(n => n.fornecedor).filter(Boolean))];
  const viewingNota = notas?.find(n => n.id === viewNotaId);

  const filteredNotas = notas?.filter(nota => {
    const matchesSearch = !searchTerm ||
      nota.numero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nota.fornecedor?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !dateFilter || nota.data_emissao === dateFilter;
    const matchesFornecedor = !fornecedorFilter || nota.fornecedor === fornecedorFilter;
    return matchesSearch && matchesDate && matchesFornecedor;
  });

  const filteredItens = todosItens?.filter(item => {
    const matchesSearch = !searchTerm ||
      item.produto_descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.xml_notas as any)?.fornecedor?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const itensMapeados = parsedNota?.itens.filter(i => i.mapeado).length || 0;
  const totalItens = parsedNota?.itens.length || 0;

  const totalNotasCompras = notas?.reduce((acc, nota) => acc + (nota.valor_total || 0), 0) || 0;
  const totalManuaisCompras = comprasManuais?.reduce((acc, c) => {
    const custo = (c.insumos as any)?.custo_unitario || 0;
    return acc + (Number(c.quantidade) * custo);
  }, 0) || 0;
  const totalCompras = totalNotasCompras + totalManuaisCompras;
  const totalNotasCount = notas?.length || 0;
  const totalManuaisCount = comprasManuais?.length || 0;

  // XML parsing
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
      toast({ title: 'Erro ao ler XML', description: 'Formato de NF-e não reconhecido', variant: 'destructive' });
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

      const fatorConv = mapeamento?.unidade_conversao || 1;
      const qtdConvertida = quantidade * fatorConv;
      const custoConvertido = qtdConvertida > 0 ? valorTotalItem / qtdConvertida : 0;

      itens.push({
        produto_descricao: descricao,
        ean,
        quantidade,
        unidade,
        valor_total: valorTotalItem,
        custo_unitario: custoUnitario,
        insumo_id: mapeamento?.insumo_id || undefined,
        mapeado: !!mapeamento,
        fator_conversao: mapeamento ? fatorConv : undefined,
        quantidade_convertida: mapeamento ? qtdConvertida : undefined,
        custo_unitario_convertido: mapeamento ? custoConvertido : undefined,
      });
    });

    setParsedNota({ numero, fornecedor, data_emissao: dataEmissao, valor_total: valorTotal, itens });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseXmlFile(file);
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
      reader.onload = () => setFilePreview({ url: reader.result as string, type: 'image', name: file.name });
      reader.readAsDataURL(file);
    }
  };

  const clearFilePreview = () => {
    if (filePreview?.type === 'pdf') URL.revokeObjectURL(filePreview.url);
    setFilePreview(null);
    setSelectedFile(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
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
        toast({ title: 'Erro ao processar arquivo', description: data.message || 'Não foi possível extrair dados.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast({ title: 'Erro', description: 'Falha ao processar arquivo com IA.', variant: 'destructive' });
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Mutations
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
    }, { onConflict: 'empresa_id,fornecedor_cnpj,codigo_produto_nota' });

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
          const { data: insumoAtual } = await supabase
            .from('insumos')
            .select('custo_unitario')
            .eq('id', item.insumo_id)
            .single();

          const custoAnterior = insumoAtual?.custo_unitario || 0;
          const variacao = custoAnterior > 0 ? ((item.custo_unitario - custoAnterior) / custoAnterior) * 100 : 0;

          await inserirMovimentoEstoque({
            empresa_id: usuario!.empresa_id,
            insumo_id: item.insumo_id,
            tipo: 'entrada',
            quantidade: item.quantidade,
            origem: 'xml',
            referencia: nota.id,
            observacao: `NF-e ${parsedNota.numero} - ${parsedNota.fornecedor}`,
          });

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

  const deleteNotaMutation = useMutation({
    mutationFn: async (notaId: string) => {
      const { data: notaItens, error: itensError } = await supabase
        .from('xml_itens')
        .select('*')
        .eq('xml_id', notaId)
        .eq('mapeado', true);
      if (itensError) throw itensError;

      for (const item of notaItens || []) {
        if (item.insumo_id && item.quantidade) {
          await inserirMovimentoEstoque({
            empresa_id: usuario!.empresa_id,
            insumo_id: item.insumo_id,
            tipo: 'saida',
            quantidade: item.quantidade,
            origem: 'nfe_exclusao',
            referencia: notaId,
            observacao: `Reversão - Exclusão da NF-e`,
          });

          const { data: insumo, error: insumoError } = await supabase
            .from('insumos')
            .select('estoque_atual')
            .eq('id', item.insumo_id)
            .single();

          if (!insumoError && insumo) {
            const novoEstoque = Math.max(0, (insumo.estoque_atual || 0) - item.quantidade);
            await supabase.from('insumos').update({ estoque_atual: novoEstoque }).eq('id', item.insumo_id);
          }
        }
      }

      const { error } = await supabase.from('xml_notas').delete().eq('id', notaId);
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

  const manualPurchaseMutation = useMutation({
    mutationFn: async (data: typeof manualFormData) => {
      const quantidade = parseFloat(data.quantidade) || 0;
      const custoUnitario = parseFloat(data.custo_unitario) || 0;

      const { data: insumoAtual } = await supabase
        .from('insumos')
        .select('custo_unitario')
        .eq('id', data.insumo_id)
        .single();

      const custoAnterior = insumoAtual?.custo_unitario || 0;
      const variacao = custoAnterior > 0 ? ((custoUnitario - custoAnterior) / custoAnterior) * 100 : 0;

      await inserirMovimentoEstoque({
        empresa_id: usuario!.empresa_id,
        insumo_id: data.insumo_id,
        tipo: 'entrada',
        quantidade,
        origem: 'manual',
        observacao: data.fornecedor ? `Compra - ${data.fornecedor}` : data.observacao || 'Compra manual',
      });

      await supabase.from('historico_precos').insert({
        empresa_id: usuario!.empresa_id,
        insumo_id: data.insumo_id,
        preco_anterior: custoAnterior,
        preco_novo: custoUnitario,
        variacao_percentual: variacao,
        origem: 'manual',
        observacao: data.fornecedor || 'Compra manual',
      });

      const { data: movimentos, error: movimentosError } = await supabase
        .from('estoque_movimentos')
        .select('tipo, quantidade')
        .eq('insumo_id', data.insumo_id);
      if (movimentosError) throw movimentosError;

      const novoEstoque = calcularEstoqueDeMovimentos(movimentos || []);

      const { error: updateError } = await supabase
        .from('insumos')
        .update({ estoque_atual: Math.max(0, novoEstoque), custo_unitario: custoUnitario })
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

  const deleteManualMutation = useMutation({
    mutationFn: async (movimentoId: string) => {
      const { data: movimento, error: getError } = await supabase
        .from('estoque_movimentos')
        .select('insumo_id, quantidade')
        .eq('id', movimentoId)
        .single();
      if (getError) throw getError;
      if (!movimento) throw new Error('Movimento não encontrado');

      const { error: deleteError } = await supabase
        .from('estoque_movimentos')
        .delete()
        .eq('id', movimentoId);
      if (deleteError) throw deleteError;

      const { data: movimentos, error: movimentosError } = await supabase
        .from('estoque_movimentos')
        .select('tipo, quantidade')
        .eq('insumo_id', movimento.insumo_id);
      if (movimentosError) throw movimentosError;

      const novoEstoque = (movimentos || []).reduce((acc, mov) => {
        const qty = Number(mov.quantidade) || 0;
        return mov.tipo === 'entrada' ? acc + qty : acc - qty;
      }, 0);

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

  const checkCostVariation = (insumoId: string, novoCusto: number) => {
    const insumo = insumos?.find(i => i.id === insumoId);
    if (!insumo || !insumo.custo_unitario || insumo.custo_unitario === 0) return null;
    const custoAtual = Number(insumo.custo_unitario);
    const variacao = ((novoCusto - custoAtual) / custoAtual) * 100;
    return { variacao, custoAtual, insumoNome: insumo.nome };
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const novoCusto = parseFloat(manualFormData.custo_unitario) || 0;
    const variation = checkCostVariation(manualFormData.insumo_id, novoCusto);

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

  return {
    // State
    importDialogOpen, setImportDialogOpen,
    parsedNota, setParsedNota,
    mappingDialogOpen, setMappingDialogOpen,
    selectedItem, setSelectedItem,
    newInsumoNome, setNewInsumoNome,
    isProcessingAI,
    filePreview, selectedFile,
    imageInputRef,
    importTab, setImportTab,
    editingItemIndex, setEditingItemIndex,
    conversionDialogOpen, setConversionDialogOpen,
    conversionItemIndex, setConversionItemIndex,
    conversionUnidadeCompraId, setConversionUnidadeCompraId,
    conversionShowNovaUnidade, setConversionShowNovaUnidade,
    conversionNovaUnidadeNome, setConversionNovaUnidadeNome,
    conversionFatorManual, setConversionFatorManual,
    deleteNotaId, setDeleteNotaId,
    viewNotaId, setViewNotaId,
    compraDialogOpen, setCompraDialogOpen,
    manualFormData, setManualFormData,
    deleteManualId, setDeleteManualId,
    costVariationWarning, setCostVariationWarning,
    searchTerm, setSearchTerm,
    dateFilter, setDateFilter,
    fornecedorFilter, setFornecedorFilter,

    // Data
    notas, notasLoading,
    todosItens, itensLoading,
    comprasManuais, comprasManuaisLoading,
    insumos, mapeamentos,
    conversionItem, conversionInsumo,
    conversionUnidades,
    conversionFatorAtivo,
    viewNotaItens, viewNotaItensLoading,
    viewingNota,
    fornecedores,
    filteredNotas, filteredItens,
    itensMapeados, totalItens,
    totalCompras, totalNotasCount, totalManuaisCount,

    // Actions
    handleFileChange,
    handleFileSelect,
    clearFilePreview,
    processFileWithAI,
    handleMapItem,
    handleManualSubmit,
    resetManualForm,

    // Mutations
    createInsumoMutation,
    importarNotaMutation,
    deleteNotaMutation,
    manualPurchaseMutation,
    deleteManualMutation,

    // Auth
    usuario,
    queryClient,
    toast,
  };
}
