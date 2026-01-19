import React, { useState, useRef, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Check, AlertCircle, Plus, Link2, Camera, Key, QrCode, Loader2, ImageIcon, Calculator, Pencil, AlertTriangle, Lightbulb } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isNativePlatform, takePictureNative, pickImageNative } from '@/lib/cameraUtils';
import { normalizeString, findBestMatch } from '@/lib/importUtils';
import { inserirMovimentoEstoque } from '@/lib/estoqueUtils';

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
  unidade_compra_id?: string;
}

interface ParsedNota {
  numero: string;
  fornecedor: string;
  data_emissao: string;
  valor_total: number;
  itens: XmlItem[];
}

const XmlImport = () => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [parsedNota, setParsedNota] = useState<ParsedNota | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<XmlItem | null>(null);
  const [newInsumoNome, setNewInsumoNome] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [filePreview, setFilePreview] = useState<{ url: string; type: 'image' | 'pdf'; name: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para conversão de unidades no mapeamento
  const [selectedInsumoId, setSelectedInsumoId] = useState<string>('');
  const [fatorConversao, setFatorConversao] = useState<string>('1');
  const [showNovaUnidade, setShowNovaUnidade] = useState(false);
  const [novaUnidadeNome, setNovaUnidadeNome] = useState('');
  const [selectedUnidadeCompraId, setSelectedUnidadeCompraId] = useState<string>('');

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
        .select('*, insumos(nome, unidade_medida)');
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch notas já importadas para verificar duplicidade
  const { data: notasImportadas } = useQuery({
    queryKey: ['notas-importadas', usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('xml_notas')
        .select('numero, fornecedor')
        .eq('empresa_id', usuario!.empresa_id);
      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Verificar se nota atual já foi importada
  const notaJaImportada = parsedNota && parsedNota.numero && parsedNota.fornecedor
    ? notasImportadas?.some(n => 
        n.numero === parsedNota.numero && 
        n.fornecedor?.toLowerCase() === parsedNota.fornecedor?.toLowerCase()
      )
    : false;

  // Fetch unidades de compra para o insumo selecionado no mapeamento
  const { data: unidadesCompra } = useQuery({
    queryKey: ['unidades-compra', selectedInsumoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unidades_compra')
        .select('*')
        .eq('insumo_id', selectedInsumoId)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedInsumoId,
  });

  const insumoSelecionadoParaMapeamento = insumos?.find(i => i.id === selectedInsumoId);
  const unidadeSelecionada = unidadesCompra?.find(u => u.id === selectedUnidadeCompraId);

  // Calcular conversão baseado na seleção
  const fatorConversaoNumerico = parseFloat(fatorConversao) || 1;
  const quantidadeOriginal = selectedItem?.quantidade || 0;
  const valorTotalItem = selectedItem?.valor_total || 0;
  const quantidadeConvertida = quantidadeOriginal * fatorConversaoNumerico;
  const custoUnitarioConvertido = quantidadeConvertida > 0 ? valorTotalItem / quantidadeConvertida : 0;

  const parseXmlFile = async (file: File) => {
    const text = await file.text();
    parseXmlContent(text);
  };

  const parseXmlContent = (text: string) => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');

    // Parse NF-e structure
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

    // Get nota info
    const ide = infNFe.querySelector('ide');
    const emit = infNFe.querySelector('emit');
    const total = infNFe.querySelector('total ICMSTot');

    const numero = ide?.querySelector('nNF')?.textContent || '';
    const fornecedor = emit?.querySelector('xNome')?.textContent || '';
    const dataEmissao = ide?.querySelector('dhEmi')?.textContent?.split('T')[0] || '';
    const valorTotal = parseFloat(total?.querySelector('vNF')?.textContent || '0');

    // Get items
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

      // Check if already mapped
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

  // Handle file selection for preview
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const isPdf = file.type === 'application/pdf';
    
    if (isPdf) {
      // For PDFs, create object URL
      const url = URL.createObjectURL(file);
      setFilePreview({ url, type: 'pdf', name: file.name });
    } else {
      // For images, create data URL for preview
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview({ url: reader.result as string, type: 'image', name: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  // Clear file preview
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

  // Process image/PDF with AI
  const processFileWithAI = async () => {
    if (!selectedFile) return;

    setIsProcessingAI(true);
    try {
      // Convert to base64
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
        // Convert to our format
        const itens: XmlItem[] = nfeData.itens?.map((item: any) => {
          const mapeamento = mapeamentos?.find(m => 
            m.descricao_nota?.toLowerCase() === item.descricao?.toLowerCase()
          );
          
          const quantidade = item.quantidade || 0;
          const valorTotal = item.valorTotal || 0;
          const fatorConv = mapeamento?.unidade_conversao || 1;
          const qtdConvertida = quantidade * fatorConv;
          const custoConvertido = qtdConvertida > 0 ? valorTotal / qtdConvertida : 0;
          
          return {
            produto_descricao: item.descricao || '',
            ean: item.ean || '',
            quantidade: quantidade,
            unidade: item.unidade || 'un',
            valor_total: valorTotal,
            custo_unitario: item.valorUnitario || 0,
            insumo_id: mapeamento?.insumo_id,
            mapeado: !!mapeamento,
            fator_conversao: mapeamento ? fatorConv : undefined,
            quantidade_convertida: mapeamento ? qtdConvertida : undefined,
            custo_unitario_convertido: mapeamento ? custoConvertido : undefined,
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

  // Process access key
  const handleAccessKeySubmit = async () => {
    const cleanKey = accessKey.replace(/\D/g, '');
    if (cleanKey.length !== 44) {
      toast({
        title: 'Chave inválida',
        description: 'A chave de acesso deve conter 44 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-nfe', {
        body: { type: 'accessKey', content: cleanKey }
      });

      if (error) throw error;

      if (data.data) {
        const nfeData = data.data;
        setParsedNota({
          numero: nfeData.numero || '',
          fornecedor: nfeData.fornecedor?.nome || nfeData.fornecedor?.cnpj || '',
          data_emissao: nfeData.dataEmissao || '',
          valor_total: nfeData.valorTotal || 0,
          itens: [],
        });
      }
      
      toast({
        title: data.success ? 'Chave validada' : 'Atenção',
        description: data.message,
        variant: data.success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error processing access key:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao processar chave de acesso.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Process QR Code
  const handleQrCodeSubmit = async () => {
    if (!qrCodeUrl.trim()) {
      toast({
        title: 'URL vazia',
        description: 'Cole a URL do QR Code do cupom fiscal.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-nfe', {
        body: { type: 'qrCode', content: qrCodeUrl }
      });

      if (error) throw error;

      if (data.data) {
        const nfeData = data.data;
        setParsedNota({
          numero: nfeData.numero || '',
          fornecedor: nfeData.fornecedor?.nome || nfeData.fornecedor?.cnpj || '',
          data_emissao: nfeData.dataEmissao || '',
          valor_total: nfeData.valorTotal || 0,
          itens: [],
        });
      }

      toast({
        title: data.success ? 'QR Code processado' : 'Atenção',
        description: data.message,
        variant: data.success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error processing QR code:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao processar QR Code.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Criar unidade de compra mutation
  const createUnidadeCompraMutation = useMutation({
    mutationFn: async (data: { nome: string; fator_conversao: number; insumo_id: string }) => {
      const { data: result, error } = await supabase
        .from('unidades_compra')
        .insert({
          empresa_id: usuario!.empresa_id,
          insumo_id: data.insumo_id,
          nome: data.nome,
          fator_conversao: data.fator_conversao,
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['unidades-compra'] });
      setSelectedUnidadeCompraId(data.id);
      setShowNovaUnidade(false);
      toast({ title: 'Unidade de compra salva!' });
    },
  });

  const createInsumoMutation = useMutation({
    mutationFn: async (nome: string) => {
      // VERIFICAR SE JÁ EXISTE um insumo com nome similar antes de criar
      const nomeNormalizado = nome.trim().toLowerCase();
      const { data: existente } = await supabase
        .from('insumos')
        .select('id, nome')
        .eq('empresa_id', usuario!.empresa_id)
        .ilike('nome', nomeNormalizado)
        .maybeSingle();

      if (existente) {
        // Insumo já existe - retornar o existente ao invés de criar duplicado
        return existente;
      }

      const { data, error } = await supabase
        .from('insumos')
        .insert({
          empresa_id: usuario!.empresa_id,
          nome: nome.trim(),
          unidade_medida: selectedItem?.unidade || 'un',
          custo_unitario: 0, // Será calculado na importação
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      setSelectedInsumoId(data.id);
      setFatorConversao('1'); // Reset fator para 1:1 já que unidade do insumo = unidade da nota
      setNewInsumoNome('');
      toast({ title: 'Insumo configurado! Continue com o mapeamento.' });
    },
  });

  const handleConfirmMapping = async () => {
    if (!selectedItem || !parsedNota || !selectedInsumoId) return;

    // Salvar nova unidade se estiver criando
    if (showNovaUnidade && novaUnidadeNome && fatorConversaoNumerico > 0) {
      await createUnidadeCompraMutation.mutateAsync({
        nome: novaUnidadeNome,
        fator_conversao: fatorConversaoNumerico,
        insumo_id: selectedInsumoId,
      });
    }

    // Save mapping with conversion factor
    await supabase.from('produto_mapeamento').upsert({
      empresa_id: usuario!.empresa_id,
      ean_gtin: selectedItem.ean || null,
      descricao_nota: selectedItem.produto_descricao,
      insumo_id: selectedInsumoId,
      unidade_conversao: fatorConversaoNumerico,
      fornecedor_cnpj: null,
      codigo_produto_nota: null,
    }, {
      onConflict: 'empresa_id,fornecedor_cnpj,codigo_produto_nota',
    });

    // Update local state com dados de conversão
    setParsedNota({
      ...parsedNota,
      itens: parsedNota.itens.map(item => 
        item.produto_descricao === selectedItem.produto_descricao
          ? { 
              ...item, 
              insumo_id: selectedInsumoId, 
              mapeado: true,
              fator_conversao: fatorConversaoNumerico,
              quantidade_convertida: item.quantidade * fatorConversaoNumerico,
              custo_unitario_convertido: item.valor_total / (item.quantidade * fatorConversaoNumerico),
              unidade_compra_id: selectedUnidadeCompraId || undefined,
            }
          : item
      ),
    });

    queryClient.invalidateQueries({ queryKey: ['mapeamentos'] });
    resetMappingState();
    setMappingDialogOpen(false);
    setSelectedItem(null);
    toast({ title: 'Item mapeado com conversão!' });
  };

  const resetMappingState = () => {
    setSelectedInsumoId('');
    setFatorConversao('1');
    setShowNovaUnidade(false);
    setNovaUnidadeNome('');
    setSelectedUnidadeCompraId('');
    setNewInsumoNome('');
  };

  const handleOpenMappingDialog = (item: XmlItem) => {
    setSelectedItem(item);
    
    // Se já está mapeado, pré-popular os dados
    if (item.mapeado && item.insumo_id) {
      setSelectedInsumoId(item.insumo_id);
      setFatorConversao((item.fator_conversao || 1).toString());
      setSelectedUnidadeCompraId(item.unidade_compra_id || '');
    } else {
      resetMappingState();
    }
    
    setShowNovaUnidade(false);
    setNovaUnidadeNome('');
    setNewInsumoNome('');
    setMappingDialogOpen(true);
  };

  const importarNotaMutation = useMutation({
    mutationFn: async () => {
      if (!parsedNota) throw new Error('Nenhuma nota para importar');

      // VERIFICAR SE NOTA JÁ FOI IMPORTADA (por número + fornecedor)
      if (parsedNota.numero && parsedNota.fornecedor) {
        const { data: notaExistente } = await supabase
          .from('xml_notas')
          .select('id, numero')
          .eq('empresa_id', usuario!.empresa_id)
          .eq('numero', parsedNota.numero)
          .ilike('fornecedor', parsedNota.fornecedor)
          .maybeSingle();

        if (notaExistente) {
          throw new Error(`Esta nota (Nº ${parsedNota.numero}) já foi importada anteriormente. Verifique no histórico de notas.`);
        }
      }

      // 1. Create xml_nota
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

      // 2. Create xml_itens
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

        // 3. If mapped, create stock movement with conversion and update cost
        if (item.insumo_id && item.mapeado) {
          const fator = item.fator_conversao || 1;
          const quantidadeConv = item.quantidade_convertida || item.quantidade * fator;
          const custoConv = item.custo_unitario_convertido || item.valor_total / quantidadeConv;

          // Get current insumo cost for history
          const { data: insumoAtual } = await supabase
            .from('insumos')
            .select('custo_unitario, unidade_medida')
            .eq('id', item.insumo_id)
            .single();

          const custoAnterior = insumoAtual?.custo_unitario || 0;
          const variacao = custoAnterior > 0 
            ? ((custoConv - custoAnterior) / custoAnterior) * 100 
            : 0;

          // Insert stock movement with conversion info - uses helper that normalizes qty
          await inserirMovimentoEstoque({
            empresa_id: usuario!.empresa_id,
            insumo_id: item.insumo_id!,
            tipo: 'entrada',
            quantidade: quantidadeConv,
            quantidade_original: item.quantidade,
            unidade_compra: item.unidade,
            fator_conversao: fator,
            custo_total: item.valor_total,
            origem: 'xml',
            referencia: nota.id,
            observacao: `NF-e ${parsedNota.numero} - ${parsedNota.fornecedor}`,
          });

          // Record price history
          await supabase.from('historico_precos').insert({
            empresa_id: usuario!.empresa_id,
            insumo_id: item.insumo_id,
            preco_anterior: custoAnterior,
            preco_novo: custoConv,
            variacao_percentual: variacao,
            origem: 'xml',
            observacao: `NF-e ${parsedNota.numero}`,
          });

          // Update insumo cost with converted value
          await supabase
            .from('insumos')
            .update({ custo_unitario: custoConv })
            .eq('id', item.insumo_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumos'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentos'] });
      toast({ title: 'Nota importada com sucesso!', description: 'Estoque atualizado.' });
      setParsedNota(null);
    },
    onError: (error) => {
      toast({ title: 'Erro ao importar', description: error.message, variant: 'destructive' });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const itensMapeados = parsedNota?.itens.filter(i => i.mapeado).length || 0;
  const totalItens = parsedNota?.itens.length || 0;

  // Componente para criar insumo com sugestão inteligente
  const NewInsumoWithSuggestion = ({
    newInsumoNome,
    setNewInsumoNome,
    insumos: insumosList,
    createInsumoMutation: mutation,
    onSelectExisting,
  }: {
    newInsumoNome: string;
    setNewInsumoNome: (value: string) => void;
    insumos: typeof insumos extends (infer T)[] ? T[] : never[];
    createInsumoMutation: typeof createInsumoMutation;
    onSelectExisting: (insumoId: string) => void;
  }) => {
    // Buscar sugestão de insumo similar
    const sugestao = useMemo(() => {
      if (!newInsumoNome || newInsumoNome.length < 3 || !insumosList?.length) return null;
      
      const match = findBestMatch(newInsumoNome, insumosList);
      // Retorna sugestão se score >= 40 (match razoável)
      return match && match.score >= 40 ? match : null;
    }, [newInsumoNome, insumosList]);

    const handleCreateOrSuggest = () => {
      if (sugestao && sugestao.score >= 70) {
        // Se score alto, perguntar antes
        return;
      }
      mutation.mutate(newInsumoNome);
    };

    return (
      <div className="space-y-2">
        <Label>Criar novo insumo</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Nome do insumo"
            value={newInsumoNome}
            onChange={(e) => setNewInsumoNome(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => mutation.mutate(newInsumoNome)}
            disabled={!newInsumoNome || mutation.isPending}
            title={sugestao && sugestao.score >= 70 ? "Insumo similar encontrado - verifique abaixo" : "Criar insumo"}
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {/* Sugestão de insumo similar */}
        {sugestao && (
          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg space-y-2">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Insumo similar encontrado!
                </p>
                <p className="text-xs text-muted-foreground">
                  Você quis dizer <strong>"{sugestao.item.nome}"</strong>?
                </p>
              </div>
            </div>
            <div className="flex gap-2 ml-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSelectExisting(sugestao.item.id)}
                className="border-warning text-warning hover:bg-warning/10"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Usar existente
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => mutation.mutate(newInsumoNome)}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                Criar novo mesmo assim
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Importar Nota Fiscal</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Importe via XML, foto, chave de acesso ou QR Code</p>
      </div>

      {/* Tabs for different import methods */}
      <Tabs defaultValue="xml" className="space-y-3 sm:space-y-4">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1">
          <TabsTrigger value="xml" className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">XML</span>
          </TabsTrigger>
          <TabsTrigger value="foto" className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 text-xs sm:text-sm">
            <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Foto</span>
          </TabsTrigger>
          <TabsTrigger value="chave" className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 text-xs sm:text-sm">
            <Key className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Chave</span>
          </TabsTrigger>
          <TabsTrigger value="qrcode" className="flex items-center gap-1 sm:gap-2 px-2 py-1.5 text-xs sm:text-sm">
            <QrCode className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">QR Code</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="xml">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
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
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Foto ou PDF do DANFE/Cupom
              </CardTitle>
              <CardDescription>
                Envie uma foto, imagem ou PDF do cupom fiscal/DANFE. A IA extrai os dados automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!filePreview ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Botão de Tirar Foto (Câmera) */}
                    <div className="flex-1">
                      {isNativePlatform() ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={isProcessingAI}
                          onClick={async () => {
                            try {
                              const base64 = await takePictureNative();
                              if (base64) {
                                setFilePreview({ url: base64, type: 'image', name: 'camera-photo.jpg' });
                                // Create a mock file for processing
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
                      ) : (
                        <>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileSelect}
                            disabled={isProcessingAI}
                            className="hidden"
                            id="camera-input"
                          />
                          <label htmlFor="camera-input">
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
                        </>
                      )}
                    </div>
                    
                    {/* Botão de Escolher Arquivo */}
                    <div className="flex-1">
                      {isNativePlatform() ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
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
                      ) : (
                        <>
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleFileSelect}
                            disabled={isProcessingAI}
                            className="hidden"
                            id="file-input"
                          />
                          <label htmlFor="file-input">
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
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: JPG, PNG, WEBP, PDF
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Preview */}
                  <div className="border rounded-lg overflow-hidden bg-muted/50 max-w-2xl">
                    {filePreview.type === 'image' ? (
                      <img 
                        src={filePreview.url} 
                        alt="Preview" 
                        className="max-h-96 w-auto mx-auto object-contain"
                      />
                    ) : (
                      <div className="relative">
                        <iframe
                          src={filePreview.url}
                          className="w-full h-96"
                          title="PDF Preview"
                        />
                      </div>
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

                  {/* Actions */}
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
                          Processar
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

        <TabsContent value="chave">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Chave de Acesso NFe
              </CardTitle>
              <CardDescription>
                Digite os 44 dígitos da chave de acesso da nota fiscal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1 max-w-lg">
                  <Label htmlFor="accessKey">Chave de Acesso (44 dígitos)</Label>
                  <Input
                    id="accessKey"
                    placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    disabled={isProcessingAI}
                    maxLength={54}
                  />
                </div>
                <Button onClick={handleAccessKeySubmit} disabled={isProcessingAI}>
                  {isProcessingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : "Consultar"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ Consulta completa requer integração com API SEFAZ (dados limitados)
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qrcode">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Code do Cupom
              </CardTitle>
              <CardDescription>
                Cole a URL do QR Code do cupom fiscal (NFC-e)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-4">
                <div className="flex-1 max-w-lg">
                  <Label htmlFor="qrCode">URL do QR Code</Label>
                  <Input
                    id="qrCode"
                    placeholder="https://www.sefaz.rs.gov.br/NFCE/..."
                    value={qrCodeUrl}
                    onChange={(e) => setQrCodeUrl(e.target.value)}
                    disabled={isProcessingAI}
                  />
                </div>
                <Button onClick={handleQrCodeSubmit} disabled={isProcessingAI}>
                  {isProcessingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : "Processar"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ Consulta completa requer integração com API SEFAZ (dados limitados)
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Parsed Nota */}
      {parsedNota && (
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
                <div className="flex flex-col items-end gap-1">
                  {totalItens > 0 && (
                    <Badge variant={itensMapeados === totalItens ? 'default' : 'secondary'}>
                      {itensMapeados}/{totalItens} itens mapeados
                    </Badge>
                  )}
                  {notaJaImportada && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Nota já importada
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsedNota.itens.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>EAN</TableHead>
                    <TableHead className="text-right">Qtd Nota</TableHead>
                    <TableHead className="text-right">Qtd Convertida</TableHead>
                    <TableHead className="text-right">Custo/Un</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedNota.itens.map((item, index) => {
                    const insumoMapeado = insumos?.find(i => i.id === item.insumo_id);
                    const fator = item.fator_conversao || 1;
                    const qtdConv = item.quantidade_convertida || item.quantidade * fator;
                    const custoConv = item.custo_unitario_convertido || item.valor_total / qtdConv;
                    
                    // Detectar possível erro de conversão: unidades diferentes mas fator = 1
                    const unidadeXml = item.unidade?.toLowerCase().trim();
                    const unidadeInsumo = insumoMapeado?.unidade_medida?.toLowerCase().trim();
                    const unidadesDiferentes = unidadeXml && unidadeInsumo && unidadeXml !== unidadeInsumo;
                    const possivelErroConversao = item.mapeado && unidadesDiferentes && fator === 1;
                    
                    return (
                      <TableRow key={index} className={possivelErroConversao ? 'bg-warning/10' : ''}>
                        <TableCell className="font-medium">
                          {item.produto_descricao}
                          {item.mapeado && insumoMapeado && (
                            <p className="text-xs text-muted-foreground">
                              → {insumoMapeado.nome}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.ean || '-'}</TableCell>
                        <TableCell className="text-right">
                          {item.quantidade} {item.unidade}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.mapeado && insumoMapeado ? (
                            <span className={fator !== 1 ? 'text-primary font-medium' : ''}>
                              {qtdConv.toFixed(2)} {insumoMapeado.unidade_medida}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.mapeado && insumoMapeado ? (
                            <span className="text-xs">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                                minimumFractionDigits: 4,
                              }).format(custoConv)}/{insumoMapeado.unidade_medida}
                            </span>
                          ) : (
                            formatCurrency(item.custo_unitario)
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.valor_total)}</TableCell>
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
                                    mas o fator de conversão é 1. Clique no lápis para ajustar.
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
                          {item.mapeado ? (
                            <Button
                              variant={possivelErroConversao ? "outline" : "ghost"}
                              size="sm"
                              onClick={() => handleOpenMappingDialog(item)}
                              title="Editar conversão"
                              className={possivelErroConversao ? 'border-warning text-warning hover:bg-warning/10' : ''}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenMappingDialog(item)}
                            >
                              <Link2 className="h-4 w-4 mr-1" />
                              Mapear
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum item encontrado na nota fiscal.</p>
                <p className="text-sm">Tente usar o método de upload de XML ou foto para obter os itens.</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setParsedNota(null)}>
                Cancelar
              </Button>
              {parsedNota.itens.length > 0 && !notaJaImportada && (
                <Button
                  onClick={() => importarNotaMutation.mutate()}
                  disabled={importarNotaMutation.isPending}
                >
                  {importarNotaMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Importar Nota
                </Button>
              )}
              {notaJaImportada && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Esta nota já foi importada anteriormente
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapping Dialog with Unit Conversion */}
      <Dialog open={mappingDialogOpen} onOpenChange={(open) => {
        setMappingDialogOpen(open);
        if (!open) resetMappingState();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mapear Item para Insumo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Item da Nota */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedItem?.produto_descricao}</p>
              <p className="text-sm text-muted-foreground">
                EAN: {selectedItem?.ean || 'N/A'} • Qtd: {selectedItem?.quantidade} {selectedItem?.unidade} • {formatCurrency(selectedItem?.valor_total || 0)}
              </p>
            </div>

            {/* Selecionar Insumo */}
            <div className="space-y-2">
              <Label>Vincular a insumo existente</Label>
              <Select value={selectedInsumoId} onValueChange={(value) => {
                setSelectedInsumoId(value);
                setFatorConversao('1');
                setShowNovaUnidade(false);
                setSelectedUnidadeCompraId('');
              }}>
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

            {/* Divisor OU */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            {/* Criar Novo Insumo com Sugestão Inteligente */}
            <NewInsumoWithSuggestion
              newInsumoNome={newInsumoNome}
              setNewInsumoNome={setNewInsumoNome}
              insumos={insumos || []}
              createInsumoMutation={createInsumoMutation}
              onSelectExisting={(insumoId) => {
                setSelectedInsumoId(insumoId);
                setNewInsumoNome('');
                setFatorConversao('1');
              }}
            />

            {/* Conversão de Unidade - só aparece se insumo selecionado */}
            {selectedInsumoId && insumoSelecionadoParaMapeamento && (
              <Card className="border-primary/20">
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Conversão de Unidade</span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    A nota tem <strong>{selectedItem?.unidade}</strong>, mas o insumo usa <strong>{insumoSelecionadoParaMapeamento.unidade_medida}</strong>
                  </p>

                  {/* Selecionar unidade de compra existente ou criar nova */}
                  {!showNovaUnidade ? (
                    <div className="space-y-2">
                      <Label className="text-xs">Unidade de Compra</Label>
                      <Select
                        value={selectedUnidadeCompraId}
                        onValueChange={(value) => {
                          if (value === 'nova') {
                            setShowNovaUnidade(true);
                            setSelectedUnidadeCompraId('');
                          } else if (value === 'manual') {
                            setSelectedUnidadeCompraId('');
                            // Deixa o fator manual
                          } else {
                            setSelectedUnidadeCompraId(value);
                            const unidade = unidadesCompra?.find(u => u.id === value);
                            if (unidade) {
                              setFatorConversao(unidade.fator_conversao.toString());
                            }
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione ou defina conversão..." />
                        </SelectTrigger>
                        <SelectContent>
                          {unidadesCompra?.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.nome} (1 = {u.fator_conversao} {insumoSelecionadoParaMapeamento.unidade_medida})
                            </SelectItem>
                          ))}
                          <SelectItem value="manual">Definir fator manualmente</SelectItem>
                          <SelectItem value="nova" className="text-primary font-medium">
                            <span className="flex items-center gap-2">
                              <Plus className="h-4 w-4" />
                              Salvar nova unidade...
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Nova Unidade de Compra</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowNovaUnidade(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Nome da unidade</Label>
                          <Input
                            placeholder="Ex: pacote 500g"
                            value={novaUnidadeNome}
                            onChange={(e) => setNovaUnidadeNome(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            1 {selectedItem?.unidade} = X {insumoSelecionadoParaMapeamento.unidade_medida}
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Ex: 500"
                            value={fatorConversao}
                            onChange={(e) => setFatorConversao(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Input manual de fator quando não selecionou unidade */}
                  {!showNovaUnidade && !selectedUnidadeCompraId && (
                    <div className="space-y-1">
                      <Label className="text-xs">
                        1 {selectedItem?.unidade} equivale a quantos {insumoSelecionadoParaMapeamento.unidade_medida}?
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Ex: 1000 (se 1kg = 1000g)"
                        value={fatorConversao}
                        onChange={(e) => setFatorConversao(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Resumo da conversão */}
                  {fatorConversaoNumerico > 0 && (
                    <div className="p-3 bg-primary/5 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Entrada no estoque:</span>
                        <Badge className="bg-primary">
                          {quantidadeConvertida.toFixed(2)} {insumoSelecionadoParaMapeamento.unidade_medida}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Custo por {insumoSelecionadoParaMapeamento.unidade_medida}:</span>
                        <span className="font-bold text-primary">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 4,
                          }).format(custoUnitarioConvertido)}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Botão Confirmar */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmMapping}
                disabled={!selectedInsumoId || fatorConversaoNumerico <= 0}
              >
                Confirmar Mapeamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default XmlImport;
