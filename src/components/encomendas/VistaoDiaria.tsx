import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Encomenda, EncomendaStatus } from '@/hooks/useEncomendas';
import EncomendaCard from './EncomendaCard';
import { CalendarDays } from 'lucide-react';

interface Props {
  dia: Date;
  encomendas: Encomenda[];
  onAtualizarStatus: (id: string, status: EncomendaStatus) => void;
  onExcluir: (id: string) => void;
  onEditar?: (e: Encomenda) => void;
  onCancelar?: (id: string, sinalDevolvido: boolean) => void;
  onReabrir?: (id: string) => void;
  onEnviar?: (e: Encomenda, tipo: 'orcamento' | 'recibo') => void;
}

export default function VistaoDiaria({ dia, encomendas, onAtualizarStatus, onExcluir, ...acoes }: Props) {
  const diaFormatado = format(dia, "EEEE, dd 'de' MMMM", { locale: ptBR });
  
  // Ordenar: pendentes e em produção primeiro, depois prontas, entregues por último
  const ordenadas = [...encomendas].sort((a, b) => {
    const ordem: Record<string, number> = { orcamento: 0, pendente: 1, em_producao: 2, pronta: 3, entregue: 4, cancelada: 5 };
    return (ordem[a.status] || 0) - (ordem[b.status] || 0);
  });

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground capitalize mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        {diaFormatado}
        <span className="text-muted-foreground font-normal">
          ({encomendas.length} {encomendas.length === 1 ? 'encomenda' : 'encomendas'})
        </span>
      </h3>

      {encomendas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma encomenda para este dia</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ordenadas.map(enc => (
            <EncomendaCard
              key={enc.id}
              encomenda={enc}
              onAtualizarStatus={onAtualizarStatus}
              onExcluir={onExcluir}
              {...acoes}
            />
          ))}
        </div>
      )}
    </div>
  );
}
