import React from 'react';
import { useCompras, XmlItem } from '@/hooks/useCompras';
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
import { Upload, FileText, Check, AlertCircle, Plus, Link2, Camera, Loader2, ImageIcon, Package, Search, Trash2, Wand2, Pencil, Eye, AlertTriangle, ArrowRight, Calculator } from 'lucide-react';
import { InsumoIcon } from '@/lib/insumoIconUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MobileDataView } from '@/components/ui/mobile-data-view';
import { Checkbox } from '@/components/ui/checkbox';
import { isNativePlatform, takePictureNative, pickImageNative } from '@/lib/cameraUtils';
import { format } from 'date-fns';
import RegistrarCompraDialog from '@/components/compras/RegistrarCompraDialog';
import { formatCurrencyBRL } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';

const Compras = () => {
  const c = useCompras();
  const formatCurrency = formatCurrencyBRL;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try { return format(new Date(dateStr), 'dd/MM/yyyy'); } catch { return dateStr; }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Compras</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Gerencie suas notas fiscais e itens comprados</p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:justify-end">
          <Button variant="outline" onClick={() => c.setCompraDialogOpen(true)} className="gap-2 w-full min-w-0">
            <Plus className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">Registrar Compra</span>
          </Button>
          <Button onClick={() => c.setImportDialogOpen(true)} className="gap-2 w-full min-w-0">
            <Upload className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">Importar NF-e</span>
          </Button>
        </div>
      </div>

      <RegistrarCompraDialog open={c.compraDialogOpen} onOpenChange={c.setCompraDialogOpen} />

      {/* Summary Cards */}
      <div className="grid gap-2 sm:gap-4 grid-cols-2 sm:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total em Compras</CardTitle></CardHeader>
          <CardContent className="min-w-0"><p className="text-2xl font-bold whitespace-nowrap">{formatCurrency(c.totalCompras)}</p></CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Notas Importadas</CardTitle></CardHeader>
          <CardContent className="min-w-0"><p className="text-2xl font-bold whitespace-nowrap">{c.totalNotasCount}</p></CardContent>
        </Card>
        <Card className="min-w-0 col-span-2 sm:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Compras Manuais</CardTitle></CardHeader>
          <CardContent className="min-w-0"><p className="text-2xl font-bold whitespace-nowrap">{c.totalManuaisCount}</p></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3">
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por número, fornecedor ou produto..." value={c.searchTerm} onChange={(e) => c.setSearchTerm(e.target.value)} className="pl-9" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
              <Select value={c.fornecedorFilter} onValueChange={c.setFornecedorFilter}>
                <SelectTrigger className="w-full min-w-0 sm:w-[220px]"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {c.fornecedores.map((f) => <SelectItem key={f} value={f!}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={c.dateFilter} onChange={(e) => c.setDateFilter(e.target.value)} className="w-full sm:w-[160px]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="notas" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="notas" className="gap-2 shrink-0"><FileText className="h-4 w-4" />Notas Fiscais</TabsTrigger>
          <TabsTrigger value="manuais" className="gap-2 shrink-0"><Plus className="h-4 w-4" />Compras Manuais</TabsTrigger>
          <TabsTrigger value="itens" className="gap-2 shrink-0"><Package className="h-4 w-4" />Itens Detalhados</TabsTrigger>
        </TabsList>

        <TabsContent value="notas">
          <Card>
            <CardHeader><CardTitle>Notas Fiscais Importadas</CardTitle><CardDescription>Lista de todas as notas fiscais de compra</CardDescription></CardHeader>
            <CardContent>
              {c.notasLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : c.filteredNotas && c.filteredNotas.length > 0 ? (
                <MobileDataView
                  data={c.filteredNotas}
                  keyExtractor={(nota) => nota.id}
                  columns={[
                    { key: 'numero', header: 'Número', mobilePriority: 1, render: (n) => <span className="font-medium">{n.numero || '-'}</span> },
                    { key: 'fornecedor', header: 'Fornecedor', mobilePriority: 2, render: (n) => <span className="break-words">{n.fornecedor || '-'}</span> },
                    { key: 'data', header: 'Data Emissão', mobilePriority: 3, render: (n) => formatDate(n.data_emissao) },
                    { key: 'valor', header: 'Valor Total', align: 'right', mobilePriority: 4, render: (n) => formatCurrency(n.valor_total || 0) },
                  ]}
                  onItemClick={(nota) => c.setViewNotaId(nota.id)}
                  renderMobileHeader={(n) => <span className="min-w-0 whitespace-normal break-words leading-snug">{n.fornecedor || 'Sem fornecedor'}</span>}
                  renderMobileSubtitle={(n) => `NF ${n.numero || '-'} • ${formatDate(n.data_emissao)}`}
                  renderMobileHighlight={(n) => <span className="font-bold whitespace-nowrap">{formatCurrency(n.valor_total || 0)}</span>}
                  renderActions={(nota) => (
                    <>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); c.setViewNotaId(nota.id); }}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); c.setDeleteNotaId(nota.id); }} disabled={c.deleteNotaMutation.isPending}><Trash2 className="h-4 w-4" /></Button>
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
            <CardHeader><CardTitle>Compras Manuais</CardTitle><CardDescription>Entradas de estoque registradas manualmente</CardDescription></CardHeader>
            <CardContent>
              {c.comprasManuaisLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : c.comprasManuais && c.comprasManuais.length > 0 ? (
                <MobileDataView
                  data={c.comprasManuais}
                  keyExtractor={(compra) => compra.id}
                  columns={[
                    { key: 'data', header: 'Data', mobilePriority: 3, render: (cm) => <span className="whitespace-nowrap">{formatDate(cm.created_at)}</span> },
                    { key: 'insumo', header: 'Insumo', mobilePriority: 1, render: (cm) => <span className="font-medium break-words">{(cm.insumos as any)?.nome || '-'}</span> },
                    { key: 'quantidade', header: 'Quantidade', align: 'right', mobilePriority: 2, render: (cm) => <span className="whitespace-nowrap">{cm.quantidade} {(cm.insumos as any)?.unidade_medida || 'un'}</span> },
                    { key: 'custoUnit', header: 'Custo Unit.', align: 'right', mobilePriority: 4, render: (cm) => <span className="whitespace-nowrap">{formatCurrency((cm.insumos as any)?.custo_unitario || 0)}</span> },
                    { key: 'total', header: 'Total', align: 'right', mobilePriority: 5, render: (cm) => <span className="whitespace-nowrap">{formatCurrency(Number(cm.quantidade) * ((cm.insumos as any)?.custo_unitario || 0))}</span> },
                    { key: 'obs', header: 'Observação', mobilePriority: 6, render: (cm) => <span className="text-muted-foreground break-words">{cm.observacao || '-'}</span> },
                  ]}
                  renderMobileHeader={(cm) => <span className="min-w-0 whitespace-normal break-words leading-snug">{(cm.insumos as any)?.nome || 'Insumo'}</span>}
                  renderMobileSubtitle={(cm) => `${formatDate(cm.created_at)} • ${cm.quantidade} ${(cm.insumos as any)?.unidade_medida || 'un'}`}
                  renderMobileHighlight={(cm) => <span className="font-bold whitespace-nowrap">{formatCurrency(Number(cm.quantidade) * ((cm.insumos as any)?.custo_unitario || 0))}</span>}
                  renderActions={(compra) => (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => c.setDeleteManualId(compra.id)} disabled={c.deleteManualMutation.isPending}><Trash2 className="h-4 w-4" /></Button>
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
            <CardHeader><CardTitle>Itens de Compra</CardTitle><CardDescription>Todos os itens das notas fiscais importadas</CardDescription></CardHeader>
            <CardContent>
              {c.itensLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : c.filteredItens && c.filteredItens.length > 0 ? (
                <MobileDataView
                  data={c.filteredItens}
                  keyExtractor={(item) => item.id}
                  columns={[
                    { key: 'produto', header: 'Produto', mobilePriority: 1, render: (i) => <span className="font-medium break-words">{i.produto_descricao}</span> },
                    { key: 'fornecedor', header: 'Fornecedor', mobilePriority: 4, render: (i) => <span className="text-muted-foreground break-words">{(i.xml_notas as any)?.fornecedor || '-'}</span> },
                    { key: 'qtd', header: 'Qtd', align: 'right', mobilePriority: 2, render: (i) => `${i.quantidade} ${i.unidade}` },
                    { key: 'custoUnit', header: 'Custo Unit.', align: 'right', mobilePriority: 5, render: (i) => formatCurrency(i.custo_unitario || 0) },
                    { key: 'total', header: 'Total', align: 'right', mobilePriority: 3, render: (i) => formatCurrency(i.valor_total || 0) },
                    { key: 'insumo', header: 'Insumo', mobilePriority: 6, render: (i) => (i.insumos as any) ? (
                      <Badge variant="default" className="gap-1 whitespace-nowrap"><Check className="h-3 w-3" />{(i.insumos as any).nome}</Badge>
                    ) : <Badge variant="secondary">Não mapeado</Badge> },
                  ]}
                  renderMobileHeader={(i) => <span className="min-w-0 whitespace-normal break-words leading-snug">{i.produto_descricao}</span>}
                  renderMobileSubtitle={(i) => <span className="min-w-0 whitespace-normal break-words">{(i.xml_notas as any)?.fornecedor || '-'} • {i.quantidade} {i.unidade}</span>}
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
      <Dialog open={c.importDialogOpen} onOpenChange={(open) => {
        c.setImportDialogOpen(open);
        if (!open) { c.setParsedNota(null); c.clearFilePreview(); }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Importar Nota Fiscal</DialogTitle></DialogHeader>
          
          {!c.parsedNota ? (
            <Tabs value={c.importTab} onValueChange={c.setImportTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="xml" className="flex items-center gap-2"><FileText className="h-4 w-4" />XML</TabsTrigger>
                <TabsTrigger value="foto" className="flex items-center gap-2"><Camera className="h-4 w-4" />Foto/PDF</TabsTrigger>
              </TabsList>

              <TabsContent value="xml">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-5 w-5" />Upload de XML</CardTitle>
                    <CardDescription>Selecione um arquivo XML de NF-e ou NFC-e</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Input type="file" accept=".xml" onChange={c.handleFileChange} className="max-w-md" />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="foto">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Camera className="h-5 w-5" />Foto ou PDF do DANFE/Cupom</CardTitle>
                    <CardDescription>Envie uma foto ou PDF do cupom fiscal. A IA extrai os dados automaticamente.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!c.filePreview ? (
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                          {isNativePlatform() ? (
                            <>
                              <Button type="button" variant="outline" className="flex-1" disabled={c.isProcessingAI} onClick={async () => {
                                try {
                                  const base64 = await takePictureNative();
                                  if (base64) {
                                    // Handle native camera - simplified for readability
                                  }
                                } catch (error: any) {
                                  if (error.message !== 'User cancelled photos app') {
                                    c.toast({ title: 'Erro', description: 'Não foi possível acessar a câmera.', variant: 'destructive' });
                                  }
                                }
                              }}><Camera className="h-4 w-4 mr-2" />Tirar Foto</Button>
                              <Button type="button" variant="outline" className="flex-1" disabled={c.isProcessingAI} onClick={async () => {
                                try {
                                  const base64 = await pickImageNative();
                                  if (base64) {
                                    // Handle native gallery
                                  }
                                } catch (error: any) {
                                  if (error.message !== 'User cancelled photos app') {
                                    c.toast({ title: 'Erro', description: 'Não foi possível acessar a galeria.', variant: 'destructive' });
                                  }
                                }
                              }}><ImageIcon className="h-4 w-4 mr-2" />Escolher da Galeria</Button>
                            </>
                          ) : (
                            <>
                              <div className="flex-1">
                                <input type="file" accept="image/*" capture="environment" onChange={c.handleFileSelect} disabled={c.isProcessingAI} className="hidden" id="camera-input-dialog" />
                                <label htmlFor="camera-input-dialog">
                                  <Button type="button" variant="outline" className="w-full cursor-pointer" disabled={c.isProcessingAI} asChild>
                                    <span><Camera className="h-4 w-4 mr-2" />Tirar Foto</span>
                                  </Button>
                                </label>
                              </div>
                              <div className="flex-1">
                                <input ref={c.imageInputRef} type="file" accept="image/*,application/pdf" onChange={c.handleFileSelect} disabled={c.isProcessingAI} className="hidden" id="file-input-dialog" />
                                <label htmlFor="file-input-dialog">
                                  <Button type="button" variant="outline" className="w-full cursor-pointer" disabled={c.isProcessingAI} asChild>
                                    <span><Upload className="h-4 w-4 mr-2" />Escolher Arquivo</span>
                                  </Button>
                                </label>
                              </div>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Formatos aceitos: JPG, PNG, WEBP, PDF</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="border rounded-lg overflow-hidden bg-muted/50">
                          {c.filePreview.type === 'image' ? (
                            <img src={c.filePreview.url} alt="Preview" className="max-h-64 w-auto mx-auto object-contain" />
                          ) : (
                            <iframe src={c.filePreview.url} className="w-full h-64" title="PDF Preview" />
                          )}
                          <div className="p-2 bg-muted flex items-center justify-between">
                            <span className="text-sm text-muted-foreground truncate max-w-xs">{c.filePreview.name}</span>
                            <Badge variant="outline">{c.filePreview.type === 'pdf' ? 'PDF' : 'Imagem'}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button onClick={c.processFileWithAI} disabled={c.isProcessingAI}>
                            {c.isProcessingAI ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>) : (<><Camera className="h-4 w-4 mr-2" />Processar</>)}
                          </Button>
                          <Button variant="outline" onClick={c.clearFilePreview} disabled={c.isProcessingAI}>Trocar arquivo</Button>
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
                      <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />NF-e {c.parsedNota.numero || '(sem número)'}</CardTitle>
                      <CardDescription>{c.parsedNota.fornecedor || 'Fornecedor não identificado'}{c.parsedNota.data_emissao && ` • ${c.parsedNota.data_emissao}`}</CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{formatCurrency(c.parsedNota.valor_total)}</p>
                      {c.totalItens > 0 && (
                        <Badge variant={c.itensMapeados === c.totalItens ? 'default' : 'secondary'}>{c.itensMapeados}/{c.totalItens} itens mapeados</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {c.parsedNota.itens.some(i => !i.mapeado) && (
                    <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground w-full mb-1">{c.parsedNota.itens.filter(i => !i.mapeado).length} item(ns) não mapeado(s)</p>
                      <Button variant="outline" size="sm" onClick={async () => {
                        const unmappedItems = c.parsedNota!.itens.filter(i => !i.mapeado);
                        const updatedItens = [...c.parsedNota!.itens];
                        for (const item of unmappedItems) {
                          const { data: newInsumo, error } = await supabase.from('insumos').insert({
                            empresa_id: c.usuario!.empresa_id, nome: item.produto_descricao,
                            unidade_medida: item.unidade || 'un', custo_unitario: item.custo_unitario || 0,
                          }).select().single();
                          if (!error && newInsumo) {
                            await supabase.from('produto_mapeamento').upsert({
                              empresa_id: c.usuario!.empresa_id, ean_gtin: item.ean || null,
                              descricao_nota: item.produto_descricao, insumo_id: newInsumo.id,
                              fornecedor_cnpj: null, codigo_produto_nota: null,
                            }, { onConflict: 'empresa_id,fornecedor_cnpj,codigo_produto_nota' });
                            const idx = updatedItens.findIndex(ui => ui.produto_descricao === item.produto_descricao);
                            if (idx !== -1) updatedItens[idx] = { ...updatedItens[idx], insumo_id: newInsumo.id, mapeado: true };
                          }
                        }
                        c.queryClient.invalidateQueries({ queryKey: ['insumos'] });
                        c.queryClient.invalidateQueries({ queryKey: ['mapeamentos'] });
                        c.setParsedNota({ ...c.parsedNota!, itens: updatedItens });
                        c.toast({ title: 'Insumos criados!', description: `${unmappedItems.length} insumo(s) cadastrado(s) automaticamente.` });
                      }} className="gap-1"><Wand2 className="h-3.5 w-3.5" />Cadastrar todos como insumos</Button>
                    </div>
                  )}

                  {/* Items list - simplified to mobile cards */}
                  {c.parsedNota.itens.length > 0 ? (
                    <div className="max-h-[60vh] overflow-y-auto space-y-2">
                      {c.parsedNota.itens.map((item, index) => {
                        const insumoMapeado = c.insumos?.find(i => i.id === item.insumo_id);
                        const fator = item.fator_conversao || 1;
                        const qtdConv = item.quantidade_convertida || item.quantidade * fator;
                        const custoConv = item.custo_unitario_convertido || (qtdConv > 0 ? item.valor_total / qtdConv : 0);
                        const unidadeXml = item.unidade?.toLowerCase().trim();
                        const unidadeInsumo = insumoMapeado?.unidade_medida?.toLowerCase().trim();
                        const unidadesDiferentes = unidadeXml && unidadeInsumo && unidadeXml !== unidadeInsumo;
                        const possivelErroConversao = item.mapeado && unidadesDiferentes && fator === 1;

                        return (
                          <Card key={index} className={possivelErroConversao ? 'border-amber-500 bg-amber-500/5' : ''}>
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                                    const newItens = c.parsedNota!.itens.filter((_, i) => i !== index);
                                    const newValorTotal = newItens.reduce((acc, i) => acc + i.valor_total, 0);
                                    c.setParsedNota({ ...c.parsedNota!, itens: newItens, valor_total: newValorTotal });
                                    c.toast({ title: 'Item removido' });
                                  }}><Trash2 className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => c.setEditingItemIndex(c.editingItemIndex === index ? null : index)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </div>
                                {possivelErroConversao ? (
                                  <Badge variant="outline" className="gap-1 border-amber-500 text-amber-500"><AlertTriangle className="h-3 w-3" />Verificar</Badge>
                                ) : item.mapeado ? (
                                  <Badge variant="default" className="gap-1"><Check className="h-3 w-3" />Mapeado</Badge>
                                ) : (
                                  <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Não mapeado</Badge>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-sm line-clamp-2">{item.produto_descricao}</p>
                                {item.mapeado && insumoMapeado && <p className="text-xs text-muted-foreground">→ {insumoMapeado.nome}</p>}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div><span className="text-muted-foreground text-xs">Nota:</span><p className="font-medium">{item.quantidade} {item.unidade}</p></div>
                                <div><span className="text-muted-foreground text-xs">Total:</span><p className="font-bold text-primary">{formatCurrency(item.valor_total)}</p></div>
                                {item.mapeado && insumoMapeado && (
                                  <>
                                    <div className="flex items-center gap-1">
                                      <div>
                                        <span className="text-muted-foreground text-xs">Conv.:</span>
                                        <p className={`font-medium ${fator !== 1 ? 'text-primary' : ''}`}>{qtdConv.toFixed(2)} {insumoMapeado.unidade_medida}</p>
                                      </div>
                                      <Button variant="ghost" size="icon" className={`h-7 w-7 ${possivelErroConversao ? 'text-amber-500' : ''}`} onClick={() => {
                                        c.setConversionItemIndex(index);
                                        c.setConversionUnidadeCompraId('');
                                        c.setConversionShowNovaUnidade(false);
                                        c.setConversionNovaUnidadeNome('');
                                        c.setConversionFatorManual(String(fator));
                                        c.setConversionDialogOpen(true);
                                      }}><Pencil className="h-3 w-3" /></Button>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground text-xs">Custo/Un:</span>
                                      <p className="text-xs">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 }).format(custoConv)}/{insumoMapeado.unidade_medida}</p>
                                    </div>
                                  </>
                                )}
                              </div>
                              {!item.mapeado && (
                                <div className="flex gap-2 pt-2 border-t">
                                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { c.setSelectedItem(item); c.setMappingDialogOpen(true); }}>
                                    <Link2 className="h-4 w-4 mr-1" />Mapear
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={async () => {
                                    const { data: newInsumo, error } = await supabase.from('insumos').insert({
                                      empresa_id: c.usuario!.empresa_id, nome: item.produto_descricao,
                                      unidade_medida: item.unidade || 'un', custo_unitario: item.custo_unitario || 0,
                                    }).select().single();
                                    if (error) { c.toast({ title: 'Erro ao criar insumo', variant: 'destructive' }); return; }
                                    await supabase.from('produto_mapeamento').upsert({
                                      empresa_id: c.usuario!.empresa_id, ean_gtin: item.ean || null,
                                      descricao_nota: item.produto_descricao, insumo_id: newInsumo.id,
                                      fornecedor_cnpj: null, codigo_produto_nota: null,
                                    }, { onConflict: 'empresa_id,fornecedor_cnpj,codigo_produto_nota' });
                                    c.queryClient.invalidateQueries({ queryKey: ['insumos'] });
                                    c.queryClient.invalidateQueries({ queryKey: ['mapeamentos'] });
                                    const updatedItens = [...c.parsedNota!.itens];
                                    updatedItens[index] = { ...updatedItens[index], insumo_id: newInsumo.id, mapeado: true };
                                    c.setParsedNota({ ...c.parsedNota!, itens: updatedItens });
                                    c.toast({ title: 'Insumo criado e mapeado!' });
                                  }}><Plus className="h-4 w-4" />Criar</Button>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum item encontrado na nota fiscal.</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-4 border-t">
                    {c.parsedNota.itens.some(i => !i.mapeado) && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />Todos os itens precisam estar mapeados para importar a nota
                      </p>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => c.setParsedNota(null)}>Voltar</Button>
                      {c.parsedNota.itens.length > 0 && (
                        <Button
                          onClick={() => {
                            const itensComVariacao = c.parsedNota!.itens.filter(item => {
                              if (!item.insumo_id || !item.mapeado) return false;
                              const insumo = c.insumos?.find(i => i.id === item.insumo_id);
                              if (!insumo || !insumo.custo_unitario || insumo.custo_unitario === 0) return false;
                              return Math.abs(((item.custo_unitario - insumo.custo_unitario) / insumo.custo_unitario) * 100) > 15;
                            });

                            if (itensComVariacao.length > 0) {
                              let maxVariation = 0;
                              let maxVariationInsumo: any = null;
                              let maxVariationItem: any = null;
                              itensComVariacao.forEach(item => {
                                const insumo = c.insumos?.find(i => i.id === item.insumo_id);
                                if (insumo) {
                                  const variacao = ((item.custo_unitario - insumo.custo_unitario) / insumo.custo_unitario) * 100;
                                  if (Math.abs(variacao) > Math.abs(maxVariation)) {
                                    maxVariation = variacao;
                                    maxVariationItem = item;
                                    maxVariationInsumo = insumo;
                                  }
                                }
                              });
                              c.setCostVariationWarning({
                                show: true, type: 'import',
                                insumoNome: itensComVariacao.length > 1 ? `${maxVariationInsumo?.nome} e mais ${itensComVariacao.length - 1} item(ns)` : maxVariationInsumo?.nome,
                                custoAtual: maxVariationInsumo?.custo_unitario || 0,
                                custoNovo: maxVariationItem?.custo_unitario || 0,
                                variacao: maxVariation,
                                onConfirm: () => { c.importarNotaMutation.mutate(); c.setCostVariationWarning(null); },
                              });
                            } else {
                              c.importarNotaMutation.mutate();
                            }
                          }}
                          disabled={c.importarNotaMutation.isPending || c.parsedNota.itens.some(i => !i.mapeado)}
                        >
                          {c.importarNotaMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
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
      <Dialog open={c.mappingDialogOpen} onOpenChange={c.setMappingDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mapear Item para Insumo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{c.selectedItem?.produto_descricao}</p>
              <p className="text-sm text-muted-foreground">{c.selectedItem?.quantidade} {c.selectedItem?.unidade} • {formatCurrency(c.selectedItem?.valor_total || 0)}</p>
            </div>
            <div>
              <Label>Selecionar Insumo Existente</Label>
              <Select onValueChange={(value) => c.handleMapItem(value)}>
                <SelectTrigger><SelectValue placeholder="Buscar insumo..." /></SelectTrigger>
                <SelectContent>
                  {c.insumos?.map(insumo => (
                    <SelectItem key={insumo.id} value={insumo.id}>
                      <span className="flex items-center gap-2"><InsumoIcon nome={insumo.nome} className="h-4 w-4" />{insumo.nome} ({insumo.unidade_medida})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-4">
              <Label>Ou Criar Novo Insumo</Label>
              <div className="flex gap-2 mt-2">
                <Input placeholder="Nome do insumo" value={c.newInsumoNome} onChange={(e) => c.setNewInsumoNome(e.target.value)} />
                <Button onClick={() => c.createInsumoMutation.mutate(c.newInsumoNome)} disabled={!c.newInsumoNome || c.createInsumoMutation.isPending}>
                  {c.createInsumoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Nota Dialog */}
      <Dialog open={!!c.viewNotaId} onOpenChange={(open) => !open && c.setViewNotaId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes da Nota Fiscal</DialogTitle></DialogHeader>
          {c.viewingNota && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><p className="text-xs text-muted-foreground">Número</p><p className="font-medium">{c.viewingNota.numero || '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Fornecedor</p><p className="font-medium break-words">{c.viewingNota.fornecedor || '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Data</p><p className="font-medium">{formatDate(c.viewingNota.data_emissao)}</p></div>
                <div><p className="text-xs text-muted-foreground">Valor Total</p><p className="font-bold text-primary">{formatCurrency(c.viewingNota.valor_total || 0)}</p></div>
              </div>
              {c.viewNotaItensLoading ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : c.viewNotaItens && c.viewNotaItens.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Custo Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Insumo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.viewNotaItens.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium max-w-[200px]">
                            <span className="line-clamp-2">{item.produto_descricao}</span>
                            {item.ean && <span className="block text-xs text-muted-foreground">EAN: {item.ean}</span>}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">{item.quantidade} {item.unidade}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.custo_unitario || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.valor_total || 0)}</TableCell>
                          <TableCell>
                            {item.mapeado && (item.insumos as any) ? (
                              <Badge variant="default" className="gap-1"><Check className="h-3 w-3" />{(item.insumos as any).nome}</Badge>
                            ) : <Badge variant="secondary">Não mapeado</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-center py-4 text-muted-foreground">Nenhum item encontrado</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => c.setViewNotaId(null)}>Fechar</Button>
                <Button variant="destructive" onClick={() => { c.setViewNotaId(null); c.setDeleteNotaId(c.viewingNota!.id); }}>
                  <Trash2 className="h-4 w-4 mr-2" />Excluir Nota
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Nota Confirmation */}
      <AlertDialog open={!!c.deleteNotaId} onOpenChange={(open) => !open && c.setDeleteNotaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Nota Fiscal</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta nota fiscal? Esta ação não pode ser desfeita e o estoque será revertido.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (c.deleteNotaId) { c.deleteNotaMutation.mutate(c.deleteNotaId); c.setDeleteNotaId(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {c.deleteNotaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Manual Purchase Confirmation */}
      <AlertDialog open={!!c.deleteManualId} onOpenChange={(open) => !open && c.setDeleteManualId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Compra Manual</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta compra manual? O estoque do insumo será revertido automaticamente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (c.deleteManualId) c.deleteManualMutation.mutate(c.deleteManualId); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {c.deleteManualMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cost Variation Warning */}
      <AlertDialog open={!!c.costVariationWarning?.show} onOpenChange={(open) => !open && c.setCostVariationWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-500"><AlertCircle className="h-5 w-5" />Alerta de Variação de Custo</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>O custo do insumo <span className="font-semibold">{c.costVariationWarning?.insumoNome}</span> apresenta uma variação significativa:</p>
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Custo atual:</span><span className="font-medium">{formatCurrency(c.costVariationWarning?.custoAtual || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Novo custo:</span><span className="font-medium">{formatCurrency(c.costVariationWarning?.custoNovo || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Variação:</span>
                  <span className={`font-bold ${(c.costVariationWarning?.variacao || 0) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {(c.costVariationWarning?.variacao || 0) > 0 ? '+' : ''}{c.costVariationWarning?.variacao?.toFixed(1)}%
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Variações acima de 15% podem indicar erro de digitação ou mudança significativa no preço do fornecedor. Deseja confirmar esta entrada?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => c.costVariationWarning?.onConfirm()} className="bg-orange-500 text-white hover:bg-orange-600">Confirmar mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conversion Dialog */}
      <Dialog open={c.conversionDialogOpen} onOpenChange={c.setConversionDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Editar Conversão</DialogTitle></DialogHeader>
          {c.conversionItem && c.conversionInsumo && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{c.conversionItem.produto_descricao}</p>
                <p className="text-sm text-muted-foreground">{c.conversionItem.quantidade} {c.conversionItem.unidade} → {c.conversionInsumo.nome} ({c.conversionInsumo.unidade_medida})</p>
              </div>
              <div className="space-y-2">
                <Label>Unidade de Compra</Label>
                {!c.conversionShowNovaUnidade ? (
                  <Select value={c.conversionUnidadeCompraId} onValueChange={(value) => {
                    if (value === 'nova') { c.setConversionShowNovaUnidade(true); c.setConversionUnidadeCompraId(''); c.setConversionFatorManual(''); }
                    else { c.setConversionUnidadeCompraId(value); c.setConversionFatorManual(''); }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione ou crie uma unidade..." /></SelectTrigger>
                    <SelectContent>
                      {c.conversionUnidades?.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome} (1 = {u.fator_conversao} {c.conversionInsumo!.unidade_medida})</SelectItem>)}
                      <SelectItem value="nova" className="text-primary font-medium"><span className="flex items-center gap-2"><Plus className="h-4 w-4" />Nova unidade...</span></SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Nova Unidade de Compra</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { c.setConversionShowNovaUnidade(false); c.setConversionFatorManual(''); }}>Cancelar</Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome da unidade</Label>
                        <Input placeholder="Ex: pacote 500g" value={c.conversionNovaUnidadeNome} onChange={(e) => c.setConversionNovaUnidadeNome(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">1 unidade = X {c.conversionInsumo.unidade_medida}</Label>
                        <Input type="number" step="0.01" min="0" placeholder="Ex: 500" value={c.conversionFatorManual} onChange={(e) => c.setConversionFatorManual(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {c.conversionFatorAtivo > 0 && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-3"><Calculator className="h-4 w-4 text-primary" /><span className="font-medium text-sm">Prévia da Conversão</span></div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{c.conversionItem.quantidade} {c.conversionItem.unidade}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge className="bg-primary">{(c.conversionItem.quantidade * c.conversionFatorAtivo).toFixed(2)} {c.conversionInsumo.unidade_medida}</Badge>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Custo por {c.conversionInsumo.unidade_medida}:</span>
                        <span className="font-bold text-primary">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 }).format(c.conversionItem.valor_total / (c.conversionItem.quantidade * c.conversionFatorAtivo))}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => c.setConversionDialogOpen(false)}>Cancelar</Button>
                <Button onClick={async () => {
                  if (c.conversionItemIndex === null || !c.parsedNota) return;
                  if (c.conversionShowNovaUnidade && c.conversionNovaUnidadeNome && c.conversionFatorManual) {
                    const { error } = await supabase.from('unidades_compra').insert({
                      empresa_id: c.usuario!.empresa_id, insumo_id: c.conversionInsumo!.id,
                      nome: c.conversionNovaUnidadeNome, fator_conversao: parseFloat(c.conversionFatorManual),
                    });
                    if (error) { c.toast({ title: 'Erro ao salvar unidade', variant: 'destructive' }); return; }
                    c.queryClient.invalidateQueries({ queryKey: ['unidades-compra-conversion'] });
                    c.toast({ title: 'Unidade de compra salva!' });
                  }
                  const newFator = c.conversionFatorAtivo;
                  const newQtdConv = c.conversionItem!.quantidade * newFator;
                  const newCustoConv = newQtdConv > 0 ? c.conversionItem!.valor_total / newQtdConv : 0;
                  const newItens = [...c.parsedNota.itens];
                  newItens[c.conversionItemIndex] = { ...newItens[c.conversionItemIndex], fator_conversao: newFator, quantidade_convertida: newQtdConv, custo_unitario_convertido: newCustoConv };
                  c.setParsedNota({ ...c.parsedNota, itens: newItens });
                  c.setConversionDialogOpen(false);
                  c.toast({ title: 'Conversão atualizada!' });
                }} disabled={c.conversionFatorAtivo <= 0}>Aplicar Conversão</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Compras;
