import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toPng } from 'html-to-image';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Encomenda } from '@/hooks/useEncomendas';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share2, Loader2 } from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/format';
import { toast } from 'sonner';

interface Props {
  encomenda: Encomenda | null;
  tipo: 'orcamento' | 'recibo';
  onOpenChange: (open: boolean) => void;
}

const dataBR = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');

export default function EncomendaImagemDialog({ encomenda, tipo, onOpenChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [gerando, setGerando] = useState(false);
  const { usuario } = useAuth();
  const { data: empresa } = useQuery({
    queryKey: ['empresa-nome', usuario?.empresa_id],
    queryFn: async () => (await supabase.from('empresas').select('nome, whatsapp_dono').eq('id', usuario!.empresa_id).single()).data,
    enabled: !!usuario?.empresa_id,
  });

  if (!encomenda) return null;
  const itens = encomenda.encomenda_itens || [];
  const subtotal = itens.reduce((a, i) => a + Number(i.quantidade) * Number(i.preco_unitario), 0);
  const desconto = Number(encomenda.desconto) || 0;
  const sinal = Number(encomenda.valor_sinal) || 0;
  const total = Number(encomenda.valor_total) || 0;
  const titulo = tipo === 'orcamento' ? 'Orçamento' : 'Recibo';
  const nomeArquivo = `${titulo}-${encomenda.cliente_nome}`.replace(/[^\w-]+/g, '_') + '.png';

  const gerar = async () => {
    if (!ref.current) return null;
    const url = await toPng(ref.current, { pixelRatio: 2, cacheBust: true });
    const blob = await (await fetch(url)).blob();
    return { url, file: new File([blob], nomeArquivo, { type: 'image/png' }) };
  };

  const baixar = async (pronto?: { url: string }) => {
    const r = pronto || (await gerar());
    if (!r) return;
    const a = document.createElement('a');
    a.href = r.url; a.download = nomeArquivo; a.click();
  };

  const compartilhar = async () => {
    setGerando(true);
    try {
      const r = await gerar();
      if (!r) return;
      if (navigator.canShare?.({ files: [r.file] })) {
        await navigator.share({ files: [r.file], title: titulo });
      } else {
        await baixar(r);
        toast.info('Imagem baixada. Agora é só enviar pelo WhatsApp.');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error('Não foi possível gerar a imagem.');
    } finally { setGerando(false); }
  };

  return (
    <Dialog open={!!encomenda} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Enviar {titulo.toLowerCase()}</DialogTitle></DialogHeader>
        <div ref={ref} className="bg-card text-card-foreground rounded-lg border border-border p-5 space-y-3 text-sm">
          <div className="text-center border-b border-border pb-3">
            <p className="text-lg font-bold">{empresa?.nome || 'Meu negócio'}</p>
            {empresa?.whatsapp_dono && <p className="text-xs text-muted-foreground">{empresa.whatsapp_dono}</p>}
            <p className="text-xs uppercase tracking-wide text-primary font-semibold mt-1">{titulo}</p>
          </div>
          <div className="text-xs space-y-0.5">
            <p><strong>Cliente:</strong> {encomenda.cliente_nome}</p>
            <p><strong>Entrega:</strong> {dataBR(encomenda.data_entrega)}{encomenda.hora_entrega ? ` às ${encomenda.hora_entrega}` : ''}</p>
            {encomenda.local_entrega && <p><strong>Local:</strong> {encomenda.local_entrega}</p>}
          </div>
          <table className="w-full text-xs">
            <thead><tr className="text-muted-foreground"><th className="text-left">Item</th><th className="text-right">Qtd</th><th className="text-right">Valor</th></tr></thead>
            <tbody>
              {itens.map(i => (
                <tr key={i.id}><td>{i.produto_nome}{i.observacoes ? ` (${i.observacoes})` : ''}</td>
                  <td className="text-right">{Number(i.quantidade)}</td>
                  <td className="text-right">{formatCurrencyBRL(Number(i.quantidade) * Number(i.preco_unitario))}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-border pt-2 text-xs space-y-0.5">
            {desconto > 0 && <><div className="flex justify-between"><span>Subtotal</span><span>{formatCurrencyBRL(subtotal)}</span></div>
              <div className="flex justify-between"><span>Desconto</span><span>− {formatCurrencyBRL(desconto)}</span></div></>}
            <div className="flex justify-between font-bold text-sm"><span>Total</span><span>{formatCurrencyBRL(total)}</span></div>
            {sinal > 0 && <div className="flex justify-between"><span>Sinal pago{encomenda.sinal_data ? ` em ${dataBR(encomenda.sinal_data)}` : ''}</span><span>{formatCurrencyBRL(sinal)}</span></div>}
            <div className="flex justify-between font-semibold"><span>{tipo === 'recibo' && encomenda.status === 'entregue' ? 'Saldo pago' : 'Saldo a pagar'}</span><span>{formatCurrencyBRL(Math.max(0, total - sinal))}</span></div>
          </div>
          {encomenda.observacoes && <p className="text-xs italic text-muted-foreground">{encomenda.observacoes}</p>}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={compartilhar} disabled={gerando}>
            {gerando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Share2 className="h-4 w-4 mr-1" />} Compartilhar
          </Button>
          <Button variant="outline" onClick={() => baixar()}><Download className="h-4 w-4 mr-1" /> Baixar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
