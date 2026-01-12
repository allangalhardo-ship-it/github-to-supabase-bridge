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
import { Upload, FileText, Check, AlertCircle, Plus, Link2, Camera, Key, QrCode, Loader2 } from 'lucide-react';

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

    // Save mapping
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

    // Update local state
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

        // 3. If mapped, create stock movement and update cost
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

          // Update insumo cost
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
                    </div>
                    
                    {/* Botão de Escolher Arquivo */}
                    <div className="flex-1">
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
                {totalItens > 0 && (
                  <Badge variant={itensMapeados === totalItens ? 'default' : 'secondary'}>
                    {itensMapeados}/{totalItens} itens mapeados
                  </Badge>
                )}
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
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Custo Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedNota.itens.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.produto_descricao}</TableCell>
                      <TableCell className="text-muted-foreground">{item.ean || '-'}</TableCell>
                      <TableCell className="text-right">
                        {item.quantidade} {item.unidade}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.custo_unitario)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.valor_total)}</TableCell>
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
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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
              {parsedNota.itens.length > 0 && (
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
            </div>
          </CardContent>
        </Card>
      )}

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

export default XmlImport;
