import { useState } from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEncomendas } from '@/hooks/useEncomendas';
import CalendarioMensal from '@/components/encomendas/CalendarioMensal';
import VistaoDiaria from '@/components/encomendas/VistaoDiaria';
import EncomendaFormDialog from '@/components/encomendas/EncomendaFormDialog';
import { Button } from '@/components/ui/button';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Encomendas() {
  const [mesAtual, setMesAtual] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);

  const { encomendas, encomendasPorDia, isLoading, criarEncomenda, atualizarStatus, excluirEncomenda } = useEncomendas(mesAtual);

  const diaKey = format(diaSelecionado, 'yyyy-MM-dd');
  const encomendasDoDia = encomendasPorDia[diaKey] || [];

  // Contadores
  const pendentes = encomendas.filter(e => e.status === 'pendente').length;
  const emProducao = encomendas.filter(e => e.status === 'em_producao').length;
  const prontas = encomendas.filter(e => e.status === 'pronta').length;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Agenda de Encomendas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie suas encomendas e produção
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova Encomenda</span>
        </Button>
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {pendentes > 0 && (
          <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-200">
            {pendentes} pendente{pendentes > 1 ? 's' : ''}
          </Badge>
        )}
        {emProducao > 0 && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
            {emProducao} em produção
          </Badge>
        )}
        {prontas > 0 && (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
            {prontas} pronta{prontas > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
          {/* Calendário */}
          <div className="lg:col-span-2 space-y-3">
            {/* Navegação do mês */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMesAtual(subMonths(mesAtual, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-sm font-semibold capitalize">
                {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMesAtual(addMonths(mesAtual, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <CalendarioMensal
              mesAtual={mesAtual}
              encomendasPorDia={encomendasPorDia}
              diaSelecionado={diaSelecionado}
              onSelectDia={setDiaSelecionado}
            />
          </div>

          {/* Visão diária */}
          <div className="lg:col-span-3">
            <VistaoDiaria
              dia={diaSelecionado}
              encomendas={encomendasDoDia}
              onAtualizarStatus={(id, status) => atualizarStatus.mutate({ id, status })}
              onExcluir={(id) => excluirEncomenda.mutate(id)}
            />
          </div>
        </div>
      )}

      {/* Form dialog */}
      <EncomendaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={(data) => criarEncomenda.mutate(data)}
        dataPadrao={diaSelecionado}
      />
    </div>
  );
}
