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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Check, AlertCircle, Plus, Link2, Camera, Loader2, ImageIcon, Filter, Calendar, Package, Search, Trash2, Wand2, Pencil } from 'lucide-react';
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
          await supabase.from('estoque_movimentos').insert({
            empresa_id: usuario!.empresa_id,
            insumo_id: item.insumo_id,
            tipo: 'entrada',
            quantidade: item.quantidade,
            origem: 'xml',
            referencia: nota.id,
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
      toast({ title: 'Nota importada com sucesso!', description: 'Estoque atualizado.' });
      setParsedNota(null);
      setImportDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: 'Erro ao importar', description: error.message, variant: 'destructive' });
    },
  });

  // Delete nota mutation
  const deleteNotaMutation = useMutation({
    mutationFn: async (notaId: string) => {
      const { error } = await supabase
        .from('xml_notas')
        .delete()
        .eq('id', notaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xml-notas'] });
      queryClient.invalidateQueries({ queryKey: ['xml-itens-all'] });
      toast({ title: 'Nota excluída com sucesso!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao excluir nota', description: error.message, variant: 'destructive' });
    },
  });

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
  const totalCompras = notas?.reduce((acc, nota) => acc + (nota.valor_total || 0), 0) || 0;
  const totalNotasCount = notas?.length || 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Compras</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Gerencie suas notas fiscais e itens comprados</p>
        </div>
        <Button onClick={() => setImportDialogOpen(true)} className="gap-2">
          <Upload className="h-4 w-4" />
          Importar NF-e
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2">
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
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotas.map((nota) => (
                      <TableRow key={nota.id}>
                        <TableCell className="font-medium">{nota.numero || '-'}</TableCell>
                        <TableCell>{nota.fornecedor || '-'}</TableCell>
                        <TableCell>{formatDate(nota.data_emissao)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(nota.valor_total || 0)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm('Tem certeza que deseja excluir esta nota fiscal?')) {
                                deleteNotaMutation.mutate(nota.id);
                              }
                            }}
                            disabled={deleteNotaMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
                <div className="overflow-x-auto">
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
                </div>
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
                                  formatCurrency(item.custo_unitario)
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
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setParsedNota(null)}>
                        Voltar
                      </Button>
                      {parsedNota.itens.length > 0 && (
                        <Button
                          onClick={() => importarNotaMutation.mutate()}
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
    </div>
  );
};

export default Compras;
