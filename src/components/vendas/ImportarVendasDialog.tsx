import React, { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X, AlertTriangle, Camera, ImageIcon, Loader2, Plus, Trash2, DollarSign, TrendingDown, Info } from 'lucide-react';
import { formatCurrencyBRL, fmtNum } from '@/lib/format';
import * as XLSX from 'xlsx';
import { isNativePlatform, takePictureNative, pickImageNative } from '@/lib/cameraUtils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { identificarFormato, ler99Food, lerIfoodPedidos, lerIfoodFinanceiro, lerGenerica, cruzarIfood, NOMES_FORMATO, type FormatoPlanilha, type PedidoPlanilha } from '@/lib/planilhaFormatos';
import { resolverVinculo, classificarDesconto, interpretarData, calcularLiquido, montarItensPedido, somarPedido, type TipoVinculo, type Sugestao, type QuemPaga } from '@/lib/importacaoFotoRegras';

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
  matchType: TipoVinculo;
  sugestoes: Sugestao[];
  componentes: ParsedComponente[];
}

interface ParsedComponente {
  produto: string;
  quantidade: number;
  produto_id?: string;
  matchType: TipoVinculo;
  sugestoes: Sugestao[];
}

interface DescontoLinha { texto: string; valor: number; quem: QuemPaga | null }

interface PhotoImportData {
  tipo: 'comanda' | 'relatorio';
  plataforma: string;
  data: string;
  data_confirmada: boolean;
  data_texto: string | null;
  numero_pedido: string | null;
  cliente: string | null;
  telefone_cliente: string | null;
  cadastrar_cliente: boolean;
  canal_proprio: boolean;
  entrega_por: 'loja' | 'plataforma' | null;
  forma_pagamento: string | null;
  cobrar_do_cliente: number;
  descontos: DescontoLinha[];
  subtotal: number;
  taxa_entrega: number;
  taxa_servico: number;
  incentivos_plataforma: number;
  incentivos_loja: number;
  total_geral: number;
  itens: ParsedItem[];
  fonte?: 'foto' | 'planilha';
  taxa_real?: number | null;
  recebido_por?: 'loja' | 'plataforma' | null;
  atualizarPedidoId?: string;
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

// Searchable product select component
const ProductSearchSelect = ({ produtos, value, onChange, disabled, semProduto, sugestoes = [] }: {
  produtos: { id: string; nome: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  semProduto?: boolean;
  sugestoes?: Sugestao[];
}) => {
  const [open, setOpen] = useState(false);
  const selectedProduct = produtos.find(p => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-8 text-xs justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate">
            {selectedProduct ? selectedProduct.nome : semProduto ? 'Sem produto (ligar depois)' : 'Escolha o produto...'}
          </span>
          <X
            className={`ml-1 h-3 w-3 shrink-0 opacity-50 ${!selectedProduct ? 'hidden' : ''}`}
            onClick={(e) => { e.stopPropagation(); onChange('__none__'); }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar produto..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => { onChange('__none__'); setOpen(false); }}>
                Sem produto (ligar depois em Vendas)
              </CommandItem>
            </CommandGroup>
            {sugestoes.length > 0 && (
              <CommandGroup heading="Sugestões">
                {sugestoes.map(sg => (
                  <CommandItem key={`sg-${sg.id}`} value={`sugestao ${sg.nome}`} onSelect={() => { onChange(sg.id); setOpen(false); }}>
                    <span className="truncate">{sg.nome}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">sugestão</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Todos os produtos">
              {produtos.map(p => (
                <CommandItem key={p.id} value={p.nome} onSelect={() => { onChange(p.id); setOpen(false); }}>
                  <span className={value === p.id ? 'font-semibold' : ''}>{p.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const VinculoBadge = ({ tipo, combo }: { tipo: TipoVinculo; combo?: boolean }) => {
  const cfg: Record<TipoVinculo, { txt: string; cls: string; title: string }> = {
    saved: { txt: '🔗 Salvo', cls: 'bg-primary/15 text-primary border-primary/20', title: 'Ligação salva de importação anterior' },
    exact: { txt: '✓ Nome igual', cls: 'bg-primary/15 text-primary border-primary/20', title: 'Mesmo nome do produto cadastrado' },
    manual: { txt: '✋ Escolhido', cls: 'bg-secondary text-secondary-foreground', title: 'Escolhido por você (fica salvo)' },
    pendente: { txt: 'Escolha o produto', cls: 'bg-amber-500/15 text-amber-700 border-amber-500/30', title: 'Veja as sugestões e escolha' },
    sem_produto: { txt: combo ? 'Combo (estoque pelos itens)' : 'Sem produto', cls: 'bg-muted text-muted-foreground', title: 'Conta na receita, não baixa estoque. Ligue depois em Vendas.' },
  };
  const c = cfg[tipo];
  return <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${c.cls}`} title={c.title}>{c.txt}</span>;
};

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
  
  const [importMethod, setImportMethod] = useState<'foto' | 'planilha'>('foto');
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
      const { data, error } = await supabase.from('produtos').select('id, nome, preco_venda').eq('ativo', true).eq('empresa_id', usuario!.empresa_id).order('nome');
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
    queryKey: ['canais-configurados-v2', usuario?.empresa_id],
    queryFn: async () => {
      const { data: canaisData, error: canaisError } = await supabase.from('canais_venda').select('*').eq('ativo', true).order('tipo').order('nome');
      if (canaisError) throw canaisError;
      
      const { data: taxasData, error: taxasError } = await supabase.from('taxas_canais').select('*');
      if (taxasError) throw taxasError;

      return (canaisData || []).map(canal => {
        const taxas = (taxasData || []).filter(t => t.canal_id === canal.id);
        const taxaTotal = taxas.reduce((sum, t) => sum + Number(t.percentual), 0);
        return { ...canal, taxaTotal };
      });
    },
    enabled: !!usuario?.empresa_id && open,
  });

  const canaisDelivery = canaisConfigurados?.filter(c => c.tipo === 'app_delivery') || [];

  // Fuzzy match: find configured canal by platform name
  const findCanalByPlataforma = (plataforma: string) => {
    if (!plataforma || !canaisConfigurados) return null;

    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const p = norm(plataforma);
    const matches = canaisConfigurados.filter(c => {
      const n = norm(c.nome);
      return n === p || n.includes(p) || p.includes(n);
    });

    if (matches.length === 0) return null;

    // Prefer the match with highest configured rate
    return matches.sort((a, b) => Number(b.taxaTotal || 0) - Number(a.taxaTotal || 0))[0];
  };

  // Canal usado no pedido (cardápio próprio nunca paga comissão)
  const getCanal = (data: PhotoImportData) => {
    const canal = findCanalByPlataforma(canalOverride || data.plataforma || '');
    if (data.canal_proprio && !canalOverride && canal && Number(canal.taxaTotal || 0) > 0) return null;
    return canal;
  };
  const getDescontoLoja = (data: PhotoImportData) =>
    data.descontos.length > 0
      ? data.descontos.filter(d => d.quem === 'loja').reduce((s, d) => s + Number(d.valor || 0), 0)
      : Number(data.incentivos_loja || 0);
  const getDescontoPlataforma = (data: PhotoImportData) =>
    data.descontos.length > 0
      ? data.descontos.filter(d => d.quem === 'plataforma').reduce((s, d) => s + Number(d.valor || 0), 0)
      : Number(data.incentivos_plataforma || 0);
  const getValores = (data: PhotoImportData) => {
    const canal = getCanal(data);
    const taxaPct = data.canal_proprio && !canalOverride ? 0 : Number(canal?.taxaTotal || 0);
    return { canal, taxaPct, ...calcularLiquido({ subtotal: Number(data.subtotal || 0), descontoLoja: getDescontoLoja(data), taxaPct }) };
  };
  const getComissao = (data: PhotoImportData) => getValores(data).comissao;

  const resetState = () => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRawData([]);
    setMapping({ data: '', valor: '', canal: '', status: '', descricao: '' });
    setParsedRows([]);
    setCanalOverride('');
    setPlanilhas([]);
    setVerLista(false);
    setDuplicateCount(0);
    setCheckingDuplicates(false);
    setImportMethod('foto');
    setIsProcessingAI(false);
    setMultiImages([]);
    setAllPhotoResults([]);
    setPhotoStep('upload');
    setCurrentResultIndex(0);
  };

  const vincular = (nome: string, plataforma: string) =>
    resolverVinculo(nome, plataforma, (mapeamentos || []) as any, (produtos || []) as any);

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
      // Busca apenas as vendas das datas envolvidas na importação (evita trazer a base inteira
      // e bater no limite de linhas, o que fazia duplicata passar batido)
      const datas = results.map(r => r.data).filter(Boolean).sort();
      const dataInicio = datas[0];
      const dataFim = datas[datas.length - 1];

      let query = supabase
        .from('vendas')
        .select('numero_pedido_externo, plataforma, data_venda, subtotal, valor_total, pedido_id')
        .eq('empresa_id', usuario.empresa_id);

      if (dataInicio && dataFim) {
        query = query.gte('data_venda', dataInicio).lte('data_venda', dataFim);
      } else {
        query = query.order('data_venda', { ascending: false }).limit(1000);
      }

      const { data: existingVendas } = await query;

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
            if (result.taxa_real != null && byPedido.pedido_id) {
              return { ...result, isDuplicate: false, atualizarPedidoId: byPedido.pedido_id, duplicateReason: `Pedido ${result.numero_pedido} já existe: só a taxa real será atualizada` };
            }
            return { ...result, isDuplicate: true, duplicateReason: `Pedido ${result.numero_pedido} já importado` };
          }
        }

        // 2. Check by data + subtotal + plataforma (fallback for orders without number)
        if (result.atualizarPedidoId) return result;
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

  // ===== Planilha =====
  const [planilhas, setPlanilhas] = useState<{ file: File; linhas: Record<string, unknown>[]; formato: FormatoPlanilha }[]>([]);
  const [lendoPlanilhas, setLendoPlanilhas] = useState(false);
  const [verLista, setVerLista] = useState(false);

  const handlePlanilhasSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const lidas: typeof planilhas = [];
    for (const file of files) {
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: '' });
        lidas.push({ file, linhas, formato: identificarFormato(Object.keys(linhas[0] || {})) });
      } catch {
        toast({ title: `Não consegui abrir ${file.name}`, variant: 'destructive' });
      }
    }
    setPlanilhas(prev => [...prev, ...lidas]);
  };

  const pedidoPlanilhaParaConferencia = (p: PedidoPlanilha): PhotoImportData => {
    const plataforma = canalOverride || p.plataforma;
    return {
      tipo: 'relatorio', plataforma, data: p.data, data_confirmada: !!p.data, data_texto: p.data || null,
      numero_pedido: p.numero, cliente: null, telefone_cliente: null, cadastrar_cliente: false, canal_proprio: false,
      entrega_por: p.entrega_por, forma_pagamento: p.forma_pagamento, cobrar_do_cliente: 0,
      descontos: [
        ...(p.desconto_loja > 0 ? [{ texto: 'Desconto pago pela loja', valor: p.desconto_loja, quem: 'loja' as QuemPaga }] : []),
        ...(p.incentivo_plataforma > 0 ? [{ texto: 'Incentivo da plataforma', valor: p.incentivo_plataforma, quem: 'plataforma' as QuemPaga }] : []),
      ],
      subtotal: p.subtotal, taxa_entrega: p.taxa_entrega, taxa_servico: p.taxa_servico,
      incentivos_plataforma: p.incentivo_plataforma, incentivos_loja: p.desconto_loja, total_geral: p.subtotal,
      itens: p.itens.map(i => {
        const semNome = /^pedido( #|$)/i.test(i.produto);
        const match = semNome ? { produto_id: undefined, tipo: 'sem_produto' as TipoVinculo, sugestoes: [] as Sugestao[] } : vincular(i.produto, plataforma);
        return {
          produto: i.produto, quantidade: i.quantidade, valor_unitario: i.quantidade ? i.valor_total / i.quantidade : i.valor_total,
          valor_total: i.valor_total, produto_id: match.produto_id, selected: true, matchType: match.tipo, sugestoes: match.sugestoes, componentes: [],
        };
      }),
      fonte: 'planilha', taxa_real: p.taxa_real, recebido_por: p.recebido_por,
    };
  };

  const lerPlanilhas = async () => {
    setLendoPlanilhas(true);
    try {
      let pedidosIfood: PedidoPlanilha[] = [];
      const finIfood = new Map<string, { taxa_real: number; data: string; subtotal: number }>();
      const outros: PedidoPlanilha[] = [];
      for (const pl of planilhas) {
        if (pl.formato === 'ifood_pedidos') pedidosIfood = pedidosIfood.concat(lerIfoodPedidos(pl.linhas));
        else if (pl.formato === 'ifood_financeiro') lerIfoodFinanceiro(pl.linhas).forEach((v, k) => finIfood.set(k, v));
        else if (pl.formato === '99food') outros.push(...ler99Food(pl.linhas));
        else if (pl.formato === 'generica') outros.push(...lerGenerica(pl.linhas, canalOverride || ''));
      }
      const { pedidos, soFinanceiro } = cruzarIfood(pedidosIfood, finIfood);
      const todos = [...pedidos, ...soFinanceiro, ...outros];
      if (todos.length === 0) {
        toast({ title: 'Nenhum pedido encontrado', description: 'Confira se o arquivo é o relatório de pedidos e se o formato está certo.', variant: 'destructive' });
        return;
      }
      let conferencia = await checkPhotoDuplicates(todos.map(pedidoPlanilhaParaConferencia));
      // Linhas só do financeiro sem pedido já lançado não viram venda nova sem itens conferidos
      conferencia = conferencia.map(r => {
        const soFin = soFinanceiro.some(f => f.numero === r.numero_pedido);
        if (soFin && !r.atualizarPedidoId && !r.isDuplicate && r.subtotal <= 0) {
          return { ...r, isDuplicate: true, duplicateReason: 'Só aparece no financeiro e não há pedido com este número' };
        }
        return r;
      });
      setAllPhotoResults(conferencia);
      setCurrentResultIndex(0);
      setVerLista(conferencia.length > 5);
      setPhotoStep('items');
    } finally {
      setLendoPlanilhas(false);
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
            const componentes: ParsedComponente[] = (item.componentes || []).map((c: any) => {
              const v = vincular(c.produto || '', plataforma);
              return { produto: c.produto || '', quantidade: Number(c.quantidade) || 1, produto_id: v.produto_id, matchType: v.tipo, sugestoes: v.sugestoes };
            });
            const match = vincular(item.produto || '', plataforma);
            // Combo sem produto próprio: a linha leva o valor e o estoque sai pelos componentes
            const comboSemProduto = componentes.length > 0 && match.tipo === 'pendente';
            return {
              produto: item.produto || '',
              quantidade: item.quantidade || 1,
              valor_unitario: item.valor_unitario || 0,
              valor_total: item.valor_total || 0,
              produto_id: match.produto_id,
              selected: true,
              matchType: comboSemProduto ? 'sem_produto' as const : match.tipo,
              sugestoes: match.sugestoes,
              componentes,
            };
          });
          const descontos: DescontoLinha[] = (data.data.descontos || [])
            .filter((d: any) => Number(d?.valor) > 0)
            .map((d: any) => ({ texto: String(d.texto || 'Desconto'), valor: Math.abs(Number(d.valor)), quem: classificarDesconto(String(d.texto || '')) }));
          const dataLida = interpretarData(data.data.data) || interpretarData(data.data.data_texto);
          const hojeIso = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
          const entregaPor = data.data.entrega_por === 'loja' || data.data.entrega_por === 'plataforma'
            ? data.data.entrega_por
            : (data.data.canal_proprio ? 'loja' : null);

          const result: PhotoImportData = {
            tipo: data.data.tipo || 'comanda',
            plataforma,
            data: dataLida || hojeIso,
            data_confirmada: !!dataLida,
            data_texto: data.data.data_texto || null,
            numero_pedido: data.data.numero_pedido || null,
            cliente: data.data.cliente || null,
            telefone_cliente: data.data.telefone_cliente || null,
            cadastrar_cliente: false,
            canal_proprio: !!data.data.canal_proprio,
            entrega_por: entregaPor,
            forma_pagamento: data.data.forma_pagamento || null,
            cobrar_do_cliente: Number(data.data.cobrar_do_cliente) || 0,
            descontos,
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
      setVerLista(checkedResults.length > 5);
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

  const handleLinkProduct = (resultIdx: number, itemIdx: number, produtoId: string, compIdx?: number) => {
    const novo = produtoId === '__none__'
      ? { produto_id: undefined, matchType: 'sem_produto' as const }
      : { produto_id: produtoId, matchType: 'manual' as const };
    setAllPhotoResults(prev => prev.map((result, ri) =>
      ri === resultIdx ? {
        ...result,
        itens: result.itens.map((item, ii) => {
          if (ii !== itemIdx) return item;
          if (compIdx === undefined) return { ...item, ...novo };
          return { ...item, componentes: item.componentes.map((c, ci) => ci === compIdx ? { ...c, ...novo } : c) };
        })
      } : result
    ));
  };

  const updateResult = (resultIdx: number, patch: Partial<PhotoImportData>) => {
    setAllPhotoResults(prev => prev.map((r, ri) => ri === resultIdx ? { ...r, ...patch } : r));
  };

  const setDescontoQuem = (resultIdx: number, dIdx: number, quem: QuemPaga) => {
    setAllPhotoResults(prev => prev.map((r, ri) => ri === resultIdx ? { ...r, descontos: r.descontos.map((d, di) => di === dIdx ? { ...d, quem } : d) } : r));
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
      let totalAtualizados = 0;
      const newMappings: { nome_externo: string; produto_id: string; plataforma: string }[] = [];

      for (const result of allPhotoResults) {
        if (result.isDuplicate) continue;
        if (result.atualizarPedidoId) {
          const { error: upErr } = await supabase.rpc('atualizar_taxa_real_pedido' as any, { p_pedido_id: result.atualizarPedidoId, p_taxa_real: result.taxa_real });
          if (upErr) throw upErr;
          totalAtualizados += 1;
          continue;
        }
        const itensImport = result.itens.map(i => ({
          nome: i.produto, quantidade: i.quantidade, valor_total: i.valor_total, selected: i.selected,
          produto_id: i.produto_id, tipo: i.matchType,
          componentes: i.componentes.map(c => ({ nome: c.produto, quantidade: c.quantidade, produto_id: c.produto_id, tipo: c.matchType })),
        }));
        const linhas = montarItensPedido(itensImport);
        if (linhas.length === 0) continue;

        const { canal } = getValores(result);
        const plat = canalOverride || result.plataforma || 'Venda Direta';

        // Cliente do cupom (cardápio próprio), só com confirmação
        let clienteId: string | null = null;
        if (result.cadastrar_cliente && result.cliente) {
          const tel = (result.telefone_cliente || '').replace(/\D/g, '');
          if (tel) {
            const { data: existentes } = await supabase.from('clientes').select('id, whatsapp').eq('empresa_id', usuario.empresa_id).not('whatsapp', 'is', null);
            clienteId = (existentes || []).find(c => (c.whatsapp || '').replace(/\D/g, '').endsWith(tel.slice(-8)))?.id || null;
          }
          if (!clienteId) {
            const { data: novo, error: cliErr } = await supabase.from('clientes')
              .insert({ empresa_id: usuario.empresa_id, nome: result.cliente, whatsapp: result.telefone_cliente || null })
              .select('id').single();
            if (cliErr) throw cliErr;
            clienteId = novo.id;
          }
        }

        const entregaLoja = result.entrega_por === 'loja';
        const recebidoPor = result.recebido_por ?? (result.cobrar_do_cliente > 0 || result.canal_proprio ? 'loja' : 'plataforma');

        const { data: pedidoId, error } = await supabase.rpc('salvar_venda_pedido' as any, {
          p_pedido: {
            canal_id: canal?.id || null,
            plataforma: result.plataforma || plat,
            cliente_id: clienteId,
            forma_pagamento: result.forma_pagamento,
            data_venda: result.data,
            origem: result.fonte === 'planilha' ? 'planilha' : 'foto',
            numero_externo: result.numero_pedido,
            desconto: getDescontoLoja(result),
            taxa_entrega: entregaLoja ? Number(result.taxa_entrega || 0) : 0,
            entrega_por: result.entrega_por,
            pagamento_recebido_por: recebidoPor,
            taxa_servico_info: Number(result.taxa_servico || 0),
            incentivo_plataforma_info: getDescontoPlataforma(result),
          },
          p_itens: linhas,
        });
        if (error) throw error;
        if (result.taxa_real != null && pedidoId) {
          const { error: tErr } = await supabase.rpc('atualizar_taxa_real_pedido' as any, { p_pedido_id: pedidoId, p_taxa_real: result.taxa_real });
          if (tErr) throw tErr;
        }

        totalImported += 1;

        const salvarLigacao = (nome: string, produtoId?: string, tipo?: TipoVinculo) => {
          if (produtoId && tipo === 'manual') newMappings.push({ nome_externo: nome, produto_id: produtoId, plataforma: result.plataforma || '' });
        };
        result.itens.filter(i => i.selected).forEach(item => {
          salvarLigacao(item.produto, item.produto_id, item.matchType);
          item.componentes.forEach(c => salvarLigacao(c.produto, c.produto_id, c.matchType));
        });
      }

      // Save product name mappings for future auto-link
      await saveMappings(newMappings);
      
      return { totalImported, totalAtualizados };
    },
    onSuccess: ({ totalImported: count, totalAtualizados }) => {
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
      queryClient.invalidateQueries({ queryKey: ['caixa-movimentos'] });
      queryClient.invalidateQueries({ queryKey: ['vendas-pedidos'] });
      toast({ title: `${count} pedido(s) importado(s)${totalAtualizados ? ` e ${totalAtualizados} com taxa real atualizada` : ''}!` });
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
      // Limita a checagem à janela de datas do arquivo importado (evita varrer todo o histórico)
      const datas = rows.map(r => r.data).filter(Boolean).sort();
      const minData = datas[0];
      const maxData = datas[datas.length - 1];

      let query = supabase
        .from('vendas')
        .select('data_venda, valor_total, canal, descricao_produto')
        .eq('empresa_id', usuario.empresa_id);
      if (minData && maxData) {
        query = query.gte('data_venda', minData).lte('data_venda', maxData);
      } else {
        query = query.limit(1000);
      }
      const { data: existingVendas, error } = await query;
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
  const pendenciasDoPedido = (r: PhotoImportData) => {
    const sel = r.itens.filter(i => i.selected);
    const itensPend = sel.filter(i => i.matchType === 'pendente').length
      + sel.reduce((n, i) => n + i.componentes.filter(c => c.matchType === 'pendente').length, 0);
    const descPend = r.descontos.filter(d => d.quem === null).length;
    return { itensPend, descPend, dataPend: !r.data_confirmada || !r.data };
  };
  const totaisPend = nonDuplicateResults.filter(r => !r.atualizarPedidoId).reduce((acc, r) => {
    const p = pendenciasDoPedido(r);
    return { itens: acc.itens + p.itensPend, desc: acc.desc + p.descPend, data: acc.data + (p.dataPend ? 1 : 0) };
  }, { itens: 0, desc: 0, data: 0 });
  const totalPhotoItemsTotal = nonDuplicateResults.reduce((sum, r) => sum + r.itens.filter(i => i.selected).length, 0);
  const totalPhotoValue = nonDuplicateResults.reduce((sum, r) => sum + somarPedido(montarItensPedido(r.itens.map(i => ({
    nome: i.produto, quantidade: i.quantidade, valor_total: i.valor_total, selected: i.selected, produto_id: i.produto_id, tipo: i.matchType, componentes: [],
  })))), 0);
  const temPendencia = totaisPend.itens + totaisPend.desc + totaisPend.data > 0;
  const textoBotaoImportar = totaisPend.data > 0 ? `Confirme a data de ${totaisPend.data} pedido(s)`
    : totaisPend.desc > 0 ? `Diga quem pagou ${totaisPend.desc} desconto(s)`
    : totaisPend.itens > 0 ? `Escolha o produto de ${totaisPend.itens} item(ns)`
    : `Importar ${nonDuplicateResults.length} pedido(s)`;
  const statusPedido = (r: PhotoImportData) => {
    if (r.isDuplicate) return { txt: 'Já importado', cls: 'text-muted-foreground' };
    if (r.atualizarPedidoId) return { txt: 'Atualiza taxa real', cls: 'text-primary' };
    const p = pendenciasDoPedido(r);
    if (p.dataPend || p.descPend || p.itensPend) return { txt: 'Precisa escolher', cls: 'text-amber-600' };
    return { txt: 'Pronto', cls: 'text-green-600' };
  };

  // Financial breakdown component
  const FinancialBreakdown = ({ data, resultIdx }: { data: PhotoImportData; resultIdx: number }) => {
    const { canal, taxaPct, comissao, liquido } = getValores(data);
    const somaItens = somarPedido(montarItensPedido(data.itens.map(i => ({
      nome: i.produto, quantidade: i.quantidade, valor_total: i.valor_total, selected: true, produto_id: i.produto_id, tipo: i.matchType, componentes: [],
    }))));
    const diferenca = Math.abs(somaItens - Number(data.subtotal || 0)) >= 0.01;
    return (
      <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <DollarSign className="h-4 w-4" />
          Resumo financeiro
          {data.numero_pedido && <Badge variant="outline" className="text-xs">{data.numero_pedido}</Badge>}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Subtotal (itens)</span>
            <span className="font-medium">{formatCurrency(data.subtotal)}</span>
          </div>
          {diferenca && (
            <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />A soma dos itens lidos ({formatCurrency(somaItens)}) não bate com o subtotal. Confira a foto.</p>
          )}
          {data.descontos.map((d, di) => (
            <div key={di} className="flex flex-col gap-1">
              <div className={`flex justify-between ${d.quem === 'loja' ? 'text-destructive' : d.quem === 'plataforma' ? 'text-muted-foreground' : 'text-amber-600'}`}>
                <span className="flex items-center gap-1">
                  {d.texto}
                  <span className="text-[10px]">({d.quem === 'loja' ? 'pago pela loja' : d.quem === 'plataforma' ? 'pago pela plataforma, não reduz seu valor' : 'quem pagou?'})</span>
                </span>
                <span>{d.quem === 'loja' ? '-' : ''}{formatCurrency(d.valor)}</span>
              </div>
              {d.quem === null && (
                <div className="flex items-center gap-2 text-xs">
                  <span>Quem pagou este desconto?</span>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setDescontoQuem(resultIdx, di, 'loja')}>Loja</Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setDescontoQuem(resultIdx, di, 'plataforma')}>Plataforma</Button>
                </div>
              )}
            </div>
          ))}
          {data.descontos.length === 0 && data.incentivos_loja > 0 && (
            <div className="flex justify-between text-destructive"><span>Desconto pago pela loja</span><span>-{formatCurrency(data.incentivos_loja)}</span></div>
          )}
          {data.descontos.length === 0 && data.incentivos_plataforma > 0 && (
            <div className="flex justify-between text-muted-foreground"><span>Incentivo da plataforma (não reduz seu valor)</span><span>{formatCurrency(data.incentivos_plataforma)}</span></div>
          )}
          {canal && taxaPct > 0 && (
            <div className="flex justify-between text-destructive">
              <span className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                Comissão prevista do canal {canal.nome} ({fmtNum(taxaPct, 1)}%)
                <Tooltip>
                  <TooltipTrigger><Info className="h-3 w-3" /></TooltipTrigger>
                  <TooltipContent><p>O comprovante não mostra a comissão real.<br/>É a taxa cadastrada do canal, sobre os itens menos o desconto da loja.</p></TooltipContent>
                </Tooltip>
              </span>
              <span className="font-medium">-{formatCurrency(comissao)}</span>
            </div>
          )}
          {data.canal_proprio && !canalOverride && (
            <div className="flex justify-between text-muted-foreground"><span>Cardápio próprio: sem comissão</span><span>R$ 0,00</span></div>
          )}
          {!data.canal_proprio && canal && taxaPct === 0 && (
            <div className="flex justify-between text-amber-600"><span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Canal {canal.nome} sem taxa cadastrada</span><span>R$ 0,00</span></div>
          )}
          {!data.canal_proprio && !canal && (data.plataforma || canalOverride) && (
            <div className="flex justify-between text-amber-600"><span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Canal "{canalOverride || data.plataforma}" não cadastrado: comissão não calculada</span><span>—</span></div>
          )}
          {data.taxa_servico > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Taxa de serviço (paga pelo cliente à plataforma)</span>
              <span>{formatCurrency(data.taxa_servico)}</span>
            </div>
          )}
          {data.taxa_real != null && (
            <div className="flex justify-between text-destructive"><span>Taxa real cobrada (relatório da plataforma)</span><span className="font-medium">-{formatCurrency(data.taxa_real)}</span></div>
          )}
          <div className="border-t pt-1 flex justify-between font-bold text-primary">
            <span>Valor líquido dos produtos</span>
            <span>{formatCurrency(liquido)}</span>
          </div>
          <div className="border-t pt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Quem entregou</Label>
              <Select value={data.entrega_por || '__none__'} onValueChange={v => updateResult(resultIdx, { entrega_por: v === '__none__' ? null : v as 'loja' | 'plataforma' })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Não informado</SelectItem>
                  <SelectItem value="loja">A loja</SelectItem>
                  <SelectItem value="plataforma">A plataforma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Taxa de entrega</Label>
              <p className="h-7 flex items-center">{formatCurrency(data.taxa_entrega)}{data.entrega_por === 'loja' && data.taxa_entrega > 0 ? ' (receita da loja)' : ''}</p>
            </div>
            <div className="col-span-2 text-muted-foreground">
              Pagamento: {data.forma_pagamento || 'não informado'} • {data.cobrar_do_cliente > 0 || data.canal_proprio
                ? `recebido pela loja${data.cobrar_do_cliente > 0 ? ` na entrega (${formatCurrency(data.cobrar_do_cliente)})` : ''}`
                : 'pago pela plataforma'}
            </div>
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
            {photoStep === 'upload' && (
            <Tabs value={importMethod} onValueChange={(v) => setImportMethod(v as 'foto' | 'planilha')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="foto" className="flex items-center gap-1 text-xs sm:text-sm"><Camera className="h-4 w-4" />Foto</TabsTrigger>
                <TabsTrigger value="planilha" className="flex items-center gap-1 text-xs sm:text-sm"><FileSpreadsheet className="h-4 w-4" />Planilha</TabsTrigger>
              </TabsList>

              <TabsContent value="foto" className="mt-4 space-y-4">
                {(
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

              </TabsContent>

              <TabsContent value="planilha" className="mt-4 space-y-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-lg font-medium mb-1">Envie uma ou mais planilhas</p>
                  <p className="text-sm text-muted-foreground mb-4">Pode mandar juntos o relatório de pedidos e o financeiro do iFood, ou o extrato da 99Food. Eu reconheço cada um sozinho.</p>
                  <input type="file" accept=".xlsx,.xls,.csv" multiple onChange={handlePlanilhasSelect} className="hidden" id="planilhas-input-sales" />
                  <label htmlFor="planilhas-input-sales">
                    <Button type="button" variant="outline" className="cursor-pointer" asChild><span><Plus className="h-4 w-4 mr-2" />Selecionar planilhas</span></Button>
                  </label>
                </div>
                {planilhas.length > 0 && (
                  <div className="space-y-2">
                    {planilhas.map((pl, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2 border rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{pl.file.name}</p>
                          <p className="text-xs text-muted-foreground">{pl.linhas.length} linha(s)</p>
                        </div>
                        <Select value={pl.formato} onValueChange={v => setPlanilhas(prev => prev.map((x, i) => i === idx ? { ...x, formato: v as FormatoPlanilha } : x))}>
                          <SelectTrigger className="h-8 text-xs sm:w-72"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(NOMES_FORMATO) as FormatoPlanilha[]).map(f => <SelectItem key={f} value={f}>{NOMES_FORMATO[f]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" onClick={() => setPlanilhas(prev => prev.filter((_, i) => i !== idx))}><X className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    {planilhas.some(p => p.formato === 'generica') && (
                      <div className="flex items-center gap-2 text-sm">
                        <Label className="text-sm">Canal da planilha genérica:</Label>
                        <Select value={canalOverride || "__fromfile__"} onValueChange={v => setCanalOverride(v === "__fromfile__" ? "" : v)}>
                          <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Do arquivo" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__fromfile__">Do arquivo</SelectItem>
                            {(canaisConfigurados || []).map(canal => (<SelectItem key={canal.id} value={canal.nome}>{canal.nome}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button className="w-full" onClick={lerPlanilhas} disabled={lendoPlanilhas}>
                      {lendoPlanilhas ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Lendo...</> : 'Ler planilhas e conferir'}
                    </Button>
                  </div>
                )}
                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground flex items-center gap-2"><AlertCircle className="h-4 w-4" />Dica</p>
                  <p>Se você já importou o pedido por foto, mande a planilha financeira: eu só atualizo a taxa real cobrada, sem duplicar a venda.</p>
                </div>
              </TabsContent>
            </Tabs>
            )}
            {photoStep === 'items' && allPhotoResults.length > 0 && verLista && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  {(['Pronto', 'Precisa escolher', 'Atualiza taxa real', 'Já importado'] as const).map(t => {
                    const n = allPhotoResults.filter(r => statusPedido(r).txt === t).length;
                    return n > 0 ? <Badge key={t} variant="outline">{t}: {n}</Badge> : null;
                  })}
                </div>
                {allPhotoResults.some(r => r.fonte === 'planilha' && !r.atualizarPedidoId && r.itens.some(i => i.matchType === 'sem_produto' && /^pedido( #|$)/i.test(i.produto))) && (
                  <p className="text-xs text-amber-700 bg-amber-50/60 border border-amber-300 rounded p-2">Alguns pedidos vieram sem itens (ex.: extrato da 99Food) e entram sem produto: não baixam estoque nem calculam custo. Para estoque e custo certos, importe esses pedidos por foto. Pedidos que já vieram por foto só têm a taxa real atualizada.</p>
                )}
                <ScrollArea className="h-[50vh] border rounded-lg">
                  <div className="divide-y">
                    {allPhotoResults.map((r, idx) => {
                      const st = statusPedido(r);
                      return (
                        <button key={idx} type="button" onClick={() => { setCurrentResultIndex(idx); setVerLista(false); }} className="w-full flex items-center justify-between gap-2 p-2 text-left hover:bg-muted/50">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{r.plataforma || 'Venda'} {r.numero_pedido ? `#${r.numero_pedido}` : ''}</p>
                            <p className="text-xs text-muted-foreground">{r.data ? r.data.split('-').reverse().join('/') : 'sem data'} • {r.itens.length} item(ns)</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm">{formatCurrency(r.subtotal)}</p>
                            <p className={`text-xs ${st.cls}`}>{st.txt}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t">
                  <span className="text-sm">Total: <span className="font-bold text-primary">{formatCurrency(totalPhotoValue)}</span></span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setPhotoStep('upload'); setAllPhotoResults([]); setMultiImages([]); }}>Voltar</Button>
                    <Button size="sm" onClick={() => importPhotoItemsMutation.mutate()} disabled={importPhotoItemsMutation.isPending || nonDuplicateResults.length === 0 || temPendencia}>
                      {importPhotoItemsMutation.isPending ? 'Importando...' : textoBotaoImportar}
                    </Button>
                  </div>
                </div>
              </div>
            )}
                {photoStep === 'items' && allPhotoResults.length > 0 && currentResult && !verLista && (
                  <div className="space-y-3">
                    {/* Navigation between orders */}
                    {allPhotoResults.length > 1 && (
                      <div className="flex items-center justify-between bg-muted/30 rounded-lg p-2">
                        <Button variant="ghost" size="sm" disabled={currentResultIndex === 0} onClick={() => setCurrentResultIndex(i => i - 1)}>← Anterior</Button>
                        <span className="text-sm font-medium">Pedido {currentResultIndex + 1} de {allPhotoResults.length}</span>
                        <Button variant="ghost" size="sm" disabled={currentResultIndex === allPhotoResults.length - 1} onClick={() => setCurrentResultIndex(i => i + 1)}>Próximo →</Button>
                      </div>
                    )}

                    {allPhotoResults.length > 5 && (
                      <Button variant="link" size="sm" className="px-0" onClick={() => setVerLista(true)}>← Voltar à lista de pedidos</Button>
                    )}
                    {currentResult.atualizarPedidoId && (
                      <div className="p-3 border rounded-lg bg-muted/40 text-sm">{currentResult.duplicateReason}</div>
                    )}
                    {currentResult.fonte === 'planilha' && !currentResult.atualizarPedidoId && currentResult.itens.some(i => i.matchType === 'sem_produto' && /^pedido( #|$)/i.test(i.produto)) && (
                      <div className="flex items-start gap-2 p-3 border border-amber-300 bg-amber-50/60 rounded-lg text-sm">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p>Esta planilha não traz os itens do pedido, então ele entra <b>sem produto</b>: não baixa estoque nem calcula custo. Quer estoque e custo certos? Importe este pedido por <b>foto</b>. Se ele já foi importado por foto, a planilha só atualiza a taxa real.</p>
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
                          {currentResult.cliente}{currentResult.telefone_cliente && ` • ${currentResult.telefone_cliente}`}
                        </p>
                      </div>
                      <div className={`flex flex-wrap items-center gap-2 rounded-md p-2 ${!currentResult.data_confirmada ? 'border-2 border-amber-500 bg-amber-500/10' : ''}`}>
                        <Label className="text-xs">Data da venda</Label>
                        <Input type="date" className="h-8 w-40 text-sm" value={currentResult.data}
                          onChange={e => updateResult(currentResultIndex, { data: e.target.value })} />
                        {!currentResult.data_confirmada ? (
                          <>
                            <span className="text-xs text-amber-700">
                              {currentResult.data_texto ? `Lido "${currentResult.data_texto}". Confira o ano.` : 'O comprovante não tem data.'}
                            </span>
                            <Button size="sm" className="h-7 text-xs" disabled={!currentResult.data} onClick={() => updateResult(currentResultIndex, { data_confirmada: true })}>Confirmar data</Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Data confirmada</span>
                        )}
                      </div>
                      {currentResult.canal_proprio && currentResult.cliente && (
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox checked={currentResult.cadastrar_cliente} onCheckedChange={v => updateResult(currentResultIndex, { cadastrar_cliente: !!v })} />
                          Cadastrar o cliente {currentResult.cliente}{currentResult.telefone_cliente ? ` (${currentResult.telefone_cliente})` : ''} em Clientes
                        </label>
                      )}
                    </div>

                    {/* Financial Breakdown */}
                    <FinancialBreakdown data={currentResult} resultIdx={currentResultIndex} />

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
                            {currentResult.itens.length} itens
                            {pendenciasDoPedido(currentResult).itensPend > 0 && (
                              <span className="text-amber-600 ml-1">• {pendenciasDoPedido(currentResult).itensPend} para escolher o produto</span>
                            )}
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
                                      <VinculoBadge tipo={item.matchType} combo={item.componentes.length > 0} />
                                    </div>
                                    <span className="text-sm font-medium shrink-0">
                                      {item.quantidade > 1 && <span className="text-muted-foreground mr-1">{item.quantidade}×</span>}
                                      {formatCurrency(item.valor_total)}
                                    </span>
                                  </div>
                                  <ProductSearchSelect
                                    produtos={produtos || []}
                                    value={item.produto_id || ''}
                                    onChange={(v) => handleLinkProduct(currentResultIndex, idx, v)}
                                    disabled={!item.selected}
                                    semProduto={item.matchType === 'sem_produto'}
                                    sugestoes={item.sugestoes}
                                  />
                                  {item.componentes.length > 0 && (
                                    <div className="pl-3 border-l-2 space-y-1.5">
                                      <p className="text-[11px] text-muted-foreground">Itens do combo (valor zero, só para baixar estoque):</p>
                                      {item.componentes.map((c, ci) => (
                                        <div key={ci} className="space-y-1">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-xs truncate">{c.quantidade > 1 ? `${c.quantidade}× ` : ''}{c.produto}</span>
                                            <VinculoBadge tipo={c.matchType} />
                                          </div>
                                          <ProductSearchSelect
                                            produtos={produtos || []}
                                            value={c.produto_id || ''}
                                            onChange={(v) => handleLinkProduct(currentResultIndex, idx, v, ci)}
                                            disabled={!item.selected}
                                            semProduto={c.matchType === 'sem_produto'}
                                            sugestoes={c.sugestoes}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
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
                          ({totalPhotoItemsTotal} itens — {nonDuplicateResults.length} pedido(s), pelo subtotal do comprovante)
                          {photoDuplicateCount > 0 && <span className="text-destructive"> • {photoDuplicateCount} duplicata(s) ignorada(s)</span>}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => { setPhotoStep('upload'); setAllPhotoResults([]); setMultiImages([]); }}>Voltar</Button>
                        <Button size="sm" className="flex-1 sm:flex-none" onClick={() => importPhotoItemsMutation.mutate()} disabled={importPhotoItemsMutation.isPending || nonDuplicateResults.length === 0 || temPendencia}>
                          {importPhotoItemsMutation.isPending ? 'Importando...' : textoBotaoImportar}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
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
