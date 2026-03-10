import { useMemo } from 'react';
import { 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, format, isSameMonth, isToday, isSameDay 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Encomenda } from '@/hooks/useEncomendas';

interface Props {
  mesAtual: Date;
  encomendasPorDia: Record<string, Encomenda[]>;
  diaSelecionado: Date;
  onSelectDia: (dia: Date) => void;
}

const statusCores: Record<string, string> = {
  tranquilo: 'bg-emerald-500',
  cheio: 'bg-amber-500',
  lotado: 'bg-red-500',
};

function getNivelDia(count: number): string {
  if (count === 0) return '';
  if (count <= 2) return 'tranquilo';
  if (count <= 4) return 'cheio';
  return 'lotado';
}

export default function CalendarioMensal({ mesAtual, encomendasPorDia, diaSelecionado, onSelectDia }: Props) {
  const dias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mesAtual), { locale: ptBR });
    const fim = endOfWeek(endOfMonth(mesAtual), { locale: ptBR });
    return eachDayOfInterval({ start: inicio, end: fim });
  }, [mesAtual]);

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="bg-card rounded-xl border border-border p-3 md:p-4">
      {/* Header dias da semana */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {diasSemana.map(d => (
          <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="grid grid-cols-7 gap-1">
        {dias.map(dia => {
          const key = format(dia, 'yyyy-MM-dd');
          const encomendas = encomendasPorDia[key] || [];
          const ativas = encomendas.filter(e => e.status !== 'cancelada' && e.status !== 'entregue');
          const nivel = getNivelDia(ativas.length);
          const mesCorreto = isSameMonth(dia, mesAtual);
          const hoje = isToday(dia);
          const selecionado = isSameDay(dia, diaSelecionado);

          return (
            <button
              key={key}
              onClick={() => onSelectDia(dia)}
              className={cn(
                'relative flex flex-col items-center justify-center p-1.5 md:p-2 rounded-lg transition-all text-sm min-h-[40px] md:min-h-[48px]',
                !mesCorreto && 'opacity-30',
                mesCorreto && 'hover:bg-accent',
                selecionado && 'ring-2 ring-primary bg-primary/10',
                hoje && !selecionado && 'bg-accent font-bold',
              )}
            >
              <span className={cn(
                'text-xs md:text-sm',
                hoje && 'text-primary font-bold',
                !mesCorreto && 'text-muted-foreground',
              )}>
                {format(dia, 'd')}
              </span>
              
              {nivel && (
                <span className={cn(
                  'w-1.5 h-1.5 md:w-2 md:h-2 rounded-full mt-0.5',
                  statusCores[nivel]
                )} />
              )}
              
              {ativas.length > 0 && (
                <span className="text-[9px] md:text-[10px] text-muted-foreground font-medium mt-0.5">
                  {ativas.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border justify-center">
        {[
          { label: 'Tranquilo (1-2)', cor: 'bg-emerald-500' },
          { label: 'Cheio (3-4)', cor: 'bg-amber-500' },
          { label: 'Lotado (5+)', cor: 'bg-red-500' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', item.cor)} />
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
