import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { invalidateEmpresaCachesAndRefetch } from '@/lib/queryConfig';
import { Mic, Square, Loader2, Check, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { encodeWav, blobToBase64 } from '@/lib/wavEncoder';

interface ItemExtraido {
  nome_falado: string;
  quantidade: number | null;
  unidade: string | null;
  insumo_id: string | null;
  insumo_nome: string | null;
  insumo_unidade: string | null;
  confianca: number;
  novo_custo?: string;
}

interface Props {
  produtoId: string;
  className?: string;
}

const UNIDADES = ['g', 'kg', 'mg', 'ml', 'l', 'un'];

export const GravarReceitaVoz: React.FC<Props> = ({ produtoId, className }) => {
  const { usuario } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [transcricao, setTranscricao] = useState('');
  const [itens, setItens] = useState<ItemExtraido[]>([]);
  const [salvando, setSalvando] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<number | null>(null);

  const reset = () => {
    setState('idle');
    setTranscricao('');
    setItens([]);
    setSeconds(0);
    chunksRef.current = [];
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;
      chunksRef.current = [];
      node.onaudioprocess = (e) => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(node);
      node.connect(ctx.destination);
      setState('recording');
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= 60) {
            // Auto-stop em 60s para conter custo do Whisper
            toast({ title: 'Tempo máximo atingido', description: 'Gravação encerrada automaticamente em 60s.' });
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch {
      toast({
        title: 'Sem acesso ao microfone',
        description: 'Permita o acesso para gravar a receita por voz.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { nodeRef.current?.disconnect(); } catch { /* noop */ }
    try { sourceRef.current?.disconnect(); } catch { /* noop */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const sampleRate = ctxRef.current?.sampleRate || 48000;
    try { await ctxRef.current?.close(); } catch { /* noop */ }

    const blob = encodeWav(chunksRef.current, sampleRate, 16000);
    if (blob.size < 4000) {
      toast({ title: 'Gravação muito curta', description: 'Fale a receita inteira e tente de novo.', variant: 'destructive' });
      reset();
      return;
    }

    setState('processing');
    try {
      const base64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke('ai-voice-recipe', {
        body: { audio_base64: base64, mime: 'audio/wav' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTranscricao(data.transcricao || '');
      const arr: ItemExtraido[] = data.itens || [];
      setItens(arr.map((i) => ({ ...i })));
      setState('idle');

      if (arr.length === 0) {
        toast({ title: 'Não identifiquei insumos', description: 'Tente gravar de novo dizendo nome, quantidade e unidade.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro ao processar áudio', description: err?.message || 'Tente novamente.', variant: 'destructive' });
      setState('idle');
    }
  };

  const removerItem = (idx: number) => {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  };

  const atualizarItem = (idx: number, patch: Partial<ItemExtraido>) => {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const salvar = async () => {
    if (!usuario?.empresa_id) return;
    const validos = itens.filter((i) => i.quantidade && i.quantidade > 0);
    if (validos.length === 0) {
      toast({ title: 'Nada para salvar', description: 'Preencha quantidade dos insumos.', variant: 'destructive' });
      return;
    }
    setSalvando(true);
    try {
      let criados = 0;
      let adicionados = 0;
      for (const item of validos) {
        let insumoId = item.insumo_id;

        // Cadastrar insumo novo se necessário
        if (!insumoId) {
          const custo = parseFloat(item.novo_custo || '0') || 0;
          const { data: novo, error } = await supabase
            .from('insumos')
            .insert({
              empresa_id: usuario.empresa_id,
              nome: item.nome_falado.trim(),
              unidade_medida: item.unidade || 'un',
              custo_unitario: custo,
              estoque_atual: 0,
              estoque_minimo: 0,
              fator_perda: 0,
              is_intermediario: false,
            })
            .select('id')
            .single();
          if (error) throw error;
          insumoId = novo.id;
          criados++;
        }

        const { error: errFt } = await supabase.from('fichas_tecnicas').insert({
          produto_id: produtoId,
          insumo_id: insumoId,
          quantidade: item.quantidade,
          unidade: item.unidade,
        });
        if (errFt && !errFt.message?.includes('duplicate')) throw errFt;
        if (!errFt) adicionados++;
      }

      await invalidateEmpresaCachesAndRefetch(usuario.empresa_id);
      toast({
        title: 'Ficha atualizada!',
        description: `${adicionados} insumo(s) adicionado(s)${criados ? `, ${criados} cadastrado(s) novo(s)` : ''}.`,
      });
      reset();
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        onClick={() => { reset(); setOpen(true); }}
      >
        <Mic className="h-4 w-4 mr-2" />
        Ditar receita
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); setOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ditar receita por voz</DialogTitle>
          </DialogHeader>

          {itens.length === 0 && (
            <div className="space-y-4 py-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p>Aperte o microfone e dite os ingredientes, ex:</p>
                <p className="italic bg-muted p-3 rounded">
                  "Leva 200 gramas de farinha, 3 ovos, 150 ml de leite e uma colher de sopa de açúcar."
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 py-6">
                {state === 'idle' && (
                  <Button size="lg" className="rounded-full h-20 w-20" onClick={startRecording}>
                    <Mic className="h-8 w-8" />
                  </Button>
                )}
                {state === 'recording' && (
                  <>
                    <Button
                      size="lg"
                      variant="destructive"
                      className="rounded-full h-20 w-20 animate-pulse"
                      onClick={stopRecording}
                    >
                      <Square className="h-8 w-8" />
                    </Button>
                    <span className="text-sm tabular-nums">{fmtTime(seconds)}</span>
                    <span className="text-xs text-muted-foreground">Gravando... toque para parar</span>
                  </>
                )}
                {state === 'processing' && (
                  <>
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Transcrevendo e identificando insumos...</span>
                  </>
                )}
              </div>
            </div>
          )}

          {itens.length > 0 && (
            <div className="space-y-3">
              {transcricao && (
                <div className="text-xs bg-muted p-2 rounded">
                  <span className="font-semibold">Você disse:</span> "{transcricao}"
                </div>
              )}

              <div className="space-y-2">
                {itens.map((it, idx) => {
                  const linkado = !!it.insumo_id;
                  return (
                    <div key={idx} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{linkado ? it.insumo_nome : it.nome_falado}</span>
                            {linkado ? (
                              <Badge variant="secondary" className="text-xs">
                                <Check className="h-3 w-3 mr-1" /> Vinculado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                                <AlertCircle className="h-3 w-3 mr-1" /> Novo insumo
                              </Badge>
                            )}
                          </div>
                          {linkado && (
                            <span className="text-xs text-muted-foreground">
                              Falou: "{it.nome_falado}"
                            </span>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removerItem(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-[1fr_80px_80px] gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Qtd"
                          value={it.quantidade ?? ''}
                          onChange={(e) => atualizarItem(idx, { quantidade: parseFloat(e.target.value) || null })}
                        />
                        <Select
                          value={it.unidade || 'un'}
                          onValueChange={(v) => atualizarItem(idx, { unidade: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {!linkado && (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Custo R$"
                            value={it.novo_custo || ''}
                            onChange={(e) => atualizarItem(idx, { novo_custo: e.target.value })}
                            title="Custo por unidade do novo insumo"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {itens.length > 0 && (
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={reset} disabled={salvando}>
                <Mic className="h-4 w-4 mr-2" /> Gravar de novo
              </Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Adicionar à ficha
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
