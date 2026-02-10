import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingUp, DollarSign, Bell } from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/format';

interface AlertaInsumo {
  nome: string;
  variacao: number;
  precoAnterior: number;
  precoNovo: number;
}

interface AlertasInteligentesProps {
  historicoPrecos: any[] | undefined;
  cmvAtual: number;
  cmvAlvo: number;
  produtosDefasados: number;
}

const AlertasInteligentes: React.FC<AlertasInteligentesProps> = ({
  historicoPrecos,
  cmvAtual,
  cmvAlvo,
  produtosDefasados,
}) => {
  const navigate = useNavigate();

  const insumosComAlta = useMemo(() => {
    if (!historicoPrecos) return [];
    const porInsumo: Record<string, AlertaInsumo> = {};
    historicoPrecos.forEach(h => {
      if (h.variacao_percentual && h.variacao_percentual > 10) {
        const nome = h.insumos?.nome || 'Insumo';
        if (!porInsumo[nome]) {
          porInsumo[nome] = {
            nome,
            variacao: h.variacao_percentual,
            precoAnterior: h.preco_anterior || 0,
            precoNovo: h.preco_novo,
          };
        }
      }
    });
    return Object.values(porInsumo).slice(0, 3);
  }, [historicoPrecos]);

  const alertas: Array<{
    tipo: 'critico' | 'atencao' | 'info';
    icone: React.ReactNode;
    titulo: string;
    descricao: string;
    acao?: { label: string; rota: string };
  }> = [];

  if (cmvAtual > 0 && cmvAtual > cmvAlvo + 5) {
    alertas.push({
      tipo: 'critico',
      icone: <AlertTriangle className="h-4 w-4" />,
      titulo: `CMV em ${cmvAtual.toFixed(1)}% (alvo: ${cmvAlvo}%)`,
      descricao: 'Seu custo de mercadoria está acima do alvo. Revise preços ou negocie com fornecedores.',
      acao: { label: 'Revisar preços', rota: '/precificacao' },
    });
  }

  insumosComAlta.forEach(insumo => {
    alertas.push({
      tipo: 'atencao',
      icone: <TrendingUp className="h-4 w-4" />,
      titulo: `${insumo.nome} subiu ${insumo.variacao.toFixed(0)}%`,
      descricao: `De ${formatCurrencyBRL(insumo.precoAnterior)} para ${formatCurrencyBRL(insumo.precoNovo)}. Verifique seus produtos.`,
      acao: { label: 'Ver precificação', rota: '/precificacao' },
    });
  });

  if (produtosDefasados > 0) {
    alertas.push({
      tipo: 'atencao',
      icone: <DollarSign className="h-4 w-4" />,
      titulo: `${produtosDefasados} produto(s) com preço defasado`,
      descricao: 'O custo subiu mas o preço de venda não foi ajustado.',
      acao: { label: 'Ajustar preços', rota: '/precificacao' },
    });
  }

  if (alertas.length === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-5 w-5 text-amber-500" />
          Alertas Inteligentes
          <Badge variant="secondary" className="ml-auto">{alertas.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alertas.map((alerta, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg border text-sm ${
              alerta.tipo === 'critico'
                ? 'bg-destructive/5 border-destructive/20'
                : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className={alerta.tipo === 'critico' ? 'text-destructive' : 'text-amber-600'}>
                {alerta.icone}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{alerta.titulo}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{alerta.descricao}</p>
                {alerta.acao && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 mt-1 text-xs"
                    onClick={() => navigate(alerta.acao!.rota)}
                  >
                    {alerta.acao.label} →
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default AlertasInteligentes;
