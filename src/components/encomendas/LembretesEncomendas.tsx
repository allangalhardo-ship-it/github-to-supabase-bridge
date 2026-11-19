import { addDays, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useEncomendasPeriodo, type Encomenda } from '@/hooks/useEncomendas';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrencyBRL } from '@/lib/format';
import { CalendarClock, AlertTriangle, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const ABERTAS = ['pendente', 'em_producao', 'pronta'];

export default function LembretesEncomendas({ compacto = false }: { compacto?: boolean }) {
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const amanha = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  // Inclui atrasadas dos últimos 60 dias e saldo dos próximos 180 dias
  const { data = [] } = useEncomendasPeriodo(format(addDays(new Date(), -60), 'yyyy-MM-dd'), format(addDays(new Date(), 180), 'yyyy-MM-dd'));
  const abertas = data.filter(e => ABERTAS.includes(e.status));
  const deHoje = abertas.filter(e => e.data_entrega === hoje);
  const deAmanha = abertas.filter(e => e.data_entrega === amanha);
  const atrasadas = abertas.filter(e => e.data_entrega < hoje);
  const comSaldo = abertas.filter(e => Number(e.valor_total) - Number(e.valor_sinal) > 0.009);
  const saldo = comSaldo.reduce((a, e) => a + Number(e.valor_total) - Number(e.valor_sinal), 0);
  if (compacto && !deHoje.length && !deAmanha.length && !atrasadas.length && !comSaldo.length) return null;

  const lista = (es: Encomenda[], mostrarSaldo = false) => es.slice(0, 5).map(e => (
    <li key={e.id} className="flex justify-between gap-2 text-xs">
      <span className="truncate">{e.cliente_nome}{mostrarSaldo ? ` · ${e.data_entrega.split('-').reverse().slice(0, 2).join('/')}` : ''}</span>
      <span className="text-muted-foreground shrink-0">{formatCurrencyBRL(mostrarSaldo ? Number(e.valor_total) - Number(e.valor_sinal) : Number(e.valor_total))}</span>
    </li>
  ));

  const Bloco = ({ titulo, icon: Icon, es, destaque, valor, saldoLista }: any) => (
    <Card className={cn(destaque && es.length > 0 && 'border-destructive')}>
      <CardContent className="p-3 space-y-1.5">
        <div className={cn('flex items-center gap-1.5 text-xs font-medium text-muted-foreground', destaque && es.length > 0 && 'text-destructive')}>
          <Icon className="h-3.5 w-3.5" /> {titulo}
        </div>
        <p className="text-lg font-bold">{valor ?? es.length}</p>
        {es.length > 0 && <ul className="space-y-0.5">{lista(es, saldoLista)}</ul>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-2">
      {compacto && <Link to="/encomendas" className="text-sm font-semibold hover:underline">Encomendas</Link>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Bloco titulo="Entregas de hoje" icon={CalendarClock} es={deHoje} />
        <Bloco titulo="Entregas de amanhã" icon={CalendarClock} es={deAmanha} />
        <Bloco titulo="Atrasadas" icon={AlertTriangle} es={atrasadas} destaque />
        <Bloco titulo="Saldo a receber" icon={Wallet} es={comSaldo} valor={formatCurrencyBRL(saldo)} saldoLista />
      </div>
    </div>
  );
}
