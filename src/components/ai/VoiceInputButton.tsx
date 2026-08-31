import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { encodeWav, blobToBase64 } from "@/lib/wavEncoder";
import { toast } from "sonner";

interface Props {
  onTranscribed: (texto: string) => void;
  disabled?: boolean;
}

const MAX_SECONDS = 60;

export const VoiceInputButton: React.FC<Props> = ({ onTranscribed, disabled }) => {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [seconds, setSeconds] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<number | null>(null);

  const start = async () => {
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
      setSeconds(0);
      setState("recording");
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS) stop();
          return next;
        });
      }, 1000);
    } catch {
      toast.error("Sem acesso ao microfone. Permita o acesso para falar com o consultor.");
    }
  };

  const stop = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try { nodeRef.current?.disconnect(); } catch { /* noop */ }
    try { sourceRef.current?.disconnect(); } catch { /* noop */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const sampleRate = ctxRef.current?.sampleRate || 48000;
    try { await ctxRef.current?.close(); } catch { /* noop */ }

    const blob = encodeWav(chunksRef.current, sampleRate, 16000);
    chunksRef.current = [];
    if (blob.size < 4000) {
      toast.error("Gravação muito curta. Fale a pergunta inteira e tente de novo.");
      setState("idle");
      return;
    }

    setState("processing");
    try {
      const base64 = await blobToBase64(blob);
      const { data, error } = await supabase.functions.invoke("ai-transcribe", {
        body: { audio_base64: base64, mime: "audio/wav" },
      });
      if (error) throw error;
      if (data?.error === "credits_exhausted") {
        toast.error("Créditos de IA esgotados. Avise o suporte.");
        return;
      }
      if (data?.error) throw new Error(data.error);
      if (data?.texto) onTranscribed(data.texto);
    } catch (err: any) {
      toast.error(err?.message || "Não consegui transcrever o áudio.");
    } finally {
      setState("idle");
    }
  };

  if (state === "processing") {
    return (
      <Button type="button" size="icon" variant="outline" disabled className="shrink-0">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (state === "recording") {
    return (
      <Button
        type="button"
        size="icon"
        variant="destructive"
        onClick={stop}
        className="shrink-0 animate-pulse"
        title={`Gravando ${seconds}s — toque para parar`}
      >
        <Square className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      onClick={start}
      disabled={disabled}
      className="shrink-0"
      title="Falar sua pergunta"
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
};

export default VoiceInputButton;
