import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyBRL } from "@/lib/format";
import { toast } from "sonner";

interface ResumoData {
  resumo: string;
  metricas: {
    receitaHoje: number;
    receitaOntem: number;
    qtdVendasHoje: number;
    ticketMedio: number;
    mediaDiaria: number;
    variacaoOntem: number | null;
    variacaoMedia: number | null;
    topProdutos: { nome: string; qtd: number; receita: number }[];
    estoqueBaixo: string[];
  };
  geradoEm: string;
  cached?: boolean;
}

export default function ResumoDiarioIA() {
  const [data, setData] = useState<ResumoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResumo = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: fnError } = await supabase.functions.invoke("ai-daily-summary");
      if (fnError) throw fnError;
      if (res?.error === "quota_excedida") {
        setError("Limite diário do resumo IA atingido. Volte amanhã!");
        return;
      }
      if (res?.error === "credits_exhausted") {
        setError("Créditos de IA esgotados. Avise o suporte.");
        return;
      }
      if (res?.error) {
        setError("Não consegui gerar o resumo agora. Tente novamente em instantes.");
        return;
      }
      setData(res as ResumoData);
    } catch (e) {
      console.error(e);
      setError("Erro ao carregar o resumo do dia.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumo();
  }, []);

  const handleRefresh = async () => {
    toast.info("Atualizando análise (consome 1 do seu limite diário)…");
    await fetchResumo();
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-purple-500/5 overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold text-sm sm:text-base flex items-center gap-2">
                Resumo do dia
                <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">IA</span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                className="h-7 w-7 p-0"
                title="Atualizar"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {loading && !data ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ) : error ? (
              <p className="text-sm text-muted-foreground">{error}</p>
            ) : data ? (
              <>
                <p className="text-sm sm:text-base text-foreground leading-relaxed whitespace-pre-line">
                  {data.resumo}
                </p>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  <span>
                    Hoje: <strong className="text-foreground">{formatCurrencyBRL(data.metricas.receitaHoje)}</strong>
                    {" "}({data.metricas.qtdVendasHoje} vendas)
                  </span>
                  {data.metricas.variacaoMedia !== null && (
                    <span className="flex items-center gap-1">
                      vs média 7d:
                      <strong className={data.metricas.variacaoMedia >= 0 ? "text-green-600" : "text-destructive"}>
                        {data.metricas.variacaoMedia >= 0 ? <TrendingUp className="inline h-3 w-3" /> : <TrendingDown className="inline h-3 w-3" />}
                        {" "}{data.metricas.variacaoMedia >= 0 ? "+" : ""}{data.metricas.variacaoMedia.toFixed(0)}%
                      </strong>
                    </span>
                  )}
                  {data.metricas.estoqueBaixo.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      {data.metricas.estoqueBaixo.length} {data.metricas.estoqueBaixo.length === 1 ? "item" : "itens"} em falta
                    </span>
                  )}
                  {data.cached && (
                    <span className="text-[10px] opacity-60">• cache do dia</span>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
