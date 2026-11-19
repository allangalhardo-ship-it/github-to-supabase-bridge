import { Encomenda, EncomendaStatus } from '@/hooks/useEncomendas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, Phone, MapPin, ChevronRight, Trash2, 
  Package, CheckCircle2, XCircle, ChefHat, FileText, Pencil, RotateCcw, Share2, AlertTriangle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrencyBRL } from '@/lib/format';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Props {
  encomenda: Encomenda;
  onAtualizarStatus: (id: string, status: EncomendaStatus) => void;
  onExcluir: (id: string) => void;
  onEditar?: (e: Encomenda) => void;
  onCancelar?: (id: string, sinalDevolvido: boolean) => void;
  onReabrir?: (id: string) => void;
  onEnviar?: (e: Encomenda, tipo: 'orcamento' | 'recibo') => void;
}

const statusConfig: Record<EncomendaStatus, { label: string; cor: string; icon: any }> = {
  orcamento: { label: 'Orçamento', cor: 'bg-violet-500/10 text-violet-600 border-violet-200', icon: FileText },
  pendente: { label: 'Pendente', cor: 'bg-slate-500/10 text-slate-600 border-slate-200', icon: Clock },
  em_producao: { label: 'Em Produção', cor: 'bg-amber-500/10 text-amber-600 border-amber-200', icon: ChefHat },
  pronta: { label: 'Pronta', cor: 'bg-blue-500/10 text-blue-600 border-blue-200', icon: Package },
  entregue: { label: 'Entregue', cor: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada', cor: 'bg-red-500/10 text-red-600 border-red-200', icon: XCircle },
};

const proximoStatus: Partial<Record<EncomendaStatus, EncomendaStatus>> = {
  orcamento: 'pendente',
  pendente: 'em_producao',
  em_producao: 'pronta',
  pronta: 'entregue',
};

const labelProximo: Record<string, string> = {
  em_producao: 'Iniciar Produção',
  pronta: 'Marcar Pronta',
  entregue: 'Marcar Entregue',
  pendente: 'Aprovar orçamento',
};

export default function EncomendaCard({ encomenda, onAtualizarStatus, onExcluir, onEditar, onCancelar, onReabrir, onEnviar }: Props) {
  const hoje = new Date().toLocaleDateString('en-CA');
  const atrasada = encomenda.data_entrega < hoje && !['entregue', 'cancelada', 'orcamento'].includes(encomenda.status);
  const status = statusConfig[encomenda.status] || statusConfig.pendente;
  const StatusIcon = status.icon;
  const proximo = proximoStatus[encomenda.status];
  const itens = encomenda.encomenda_itens || [];
  const saldoRestante = encomenda.valor_total - encomenda.valor_sinal;

  return (
    <div className={cn(
      'bg-card border border-border rounded-xl p-4 space-y-3 transition-all hover:shadow-md',
      encomenda.status === 'cancelada' && 'opacity-60',
      atrasada && 'border-destructive bg-destructive/5',
    )}>
      {atrasada && (
        <p className="text-xs font-semibold text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" /> Atrasada — entrega era {encomenda.data_entrega.split('-').reverse().join('/')}
        </p>
      )}
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-sm truncate">{encomenda.cliente_nome}</h4>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {encomenda.hora_entrega && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {encomenda.hora_entrega}
              </span>
            )}
            {encomenda.cliente_whatsapp && (
              <a 
                href={`https://wa.me/55${encomenda.cliente_whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-emerald-600 hover:underline"
              >
                <Phone className="h-3 w-3" />
                WhatsApp
              </a>
            )}
          </div>
        </div>
        <Badge className={cn('text-[10px] border', status.cor)}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {status.label}
        </Badge>
      </div>

      {/* Itens */}
      <div className="space-y-1">
        {itens.map(item => (
          <div key={item.id} className="flex items-center justify-between text-xs">
            <span className="text-foreground">
              {item.quantidade}x {item.produto_nome}
            </span>
            <span className="text-muted-foreground font-medium">
              {formatCurrencyBRL(item.quantidade * item.preco_unitario)}
            </span>
          </div>
        ))}
      </div>

      {/* Valores */}
      <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
        <div className="space-y-0.5">
          <div className="font-semibold text-sm">{formatCurrencyBRL(encomenda.valor_total)}</div>
          {encomenda.valor_sinal > 0 && (
            <div className="text-muted-foreground">
              Sinal: {formatCurrencyBRL(encomenda.valor_sinal)} · Restante: {formatCurrencyBRL(saldoRestante)}
            </div>
          )}
        </div>

        {encomenda.local_entrega && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{encomenda.local_entrega}</span>
          </span>
        )}
      </div>

      {encomenda.observacoes && (
        <p className="text-xs text-muted-foreground italic bg-muted/50 rounded-md px-2 py-1">
          {encomenda.observacoes}
        </p>
      )}

      {/* Ações */}
      {encomenda.status !== 'cancelada' && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2">
            {proximo && (
              <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => onAtualizarStatus(encomenda.id, proximo)}>
                <ChevronRight className="h-3.5 w-3.5 mr-1" />
                {labelProximo[proximo]}
              </Button>
            )}
            {encomenda.status === 'entregue' && onReabrir && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reabrir encomenda
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reabrir encomenda?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A venda sai da tela de Vendas, o estoque volta e o saldo sai do Caixa. O sinal continua lançado.
                      A encomenda volta para "Pronta" e pode ser editada.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onReabrir(encomenda.id)}>Reabrir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {encomenda.status !== 'entregue' && onEditar && (
              <Button size="icon" variant="outline" className="h-8 w-8" aria-label="Editar" onClick={() => onEditar(encomenda)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onEnviar && (
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs"
                onClick={() => onEnviar(encomenda, encomenda.status === 'orcamento' ? 'orcamento' : 'recibo')}>
                <Share2 className="h-3.5 w-3.5 mr-1" />
                {encomenda.status === 'orcamento' ? 'Enviar orçamento' : 'Enviar recibo'}
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs text-destructive">Cancelar</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar encomenda?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {encomenda.status === 'entregue' ? 'A venda e o saldo saem do Caixa e o estoque volta. ' : ''}
                    {encomenda.valor_sinal > 0
                      ? `O sinal de ${formatCurrencyBRL(encomenda.valor_sinal)} foi devolvido para a cliente?`
                      : 'Esta encomenda não tem sinal pago.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  {encomenda.valor_sinal > 0 ? (
                    <>
                      <AlertDialogAction onClick={() => onCancelar?.(encomenda.id, false)}>Não, fica comigo</AlertDialogAction>
                      <AlertDialogAction onClick={() => onCancelar?.(encomenda.id, true)}>Sim, devolvi</AlertDialogAction>
                    </>
                  ) : (
                    <AlertDialogAction onClick={() => onCancelar?.(encomenda.id, false)}>Cancelar encomenda</AlertDialogAction>
                  )}
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {encomenda.status !== 'entregue' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label="Excluir">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir encomenda?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A encomenda e o lançamento do sinal no Caixa serão removidos. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onExcluir(encomenda.id)}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
