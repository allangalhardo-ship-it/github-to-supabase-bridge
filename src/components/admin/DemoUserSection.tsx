import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, RotateCcw, Copy, CheckCircle2 } from "lucide-react";

const DEMO_EMAIL = "demo@gastrogestor.com.br";
const DEMO_PASSWORD = "GastroDemo@2026";

const DemoUserSection: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<"setup" | "reset" | null>(null);
  const [result, setResult] = useState<any>(null);

  const runAction = async (action: "setup" | "reset") => {
    setLoading(action);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("setup-demo-user", { body: { action } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast({
        title: action === "setup" ? "Usuário demo pronto!" : "Dados demo resetados!",
        description: `${data?.stats?.vendas || 0} vendas, ${data?.stats?.clientes || 0} clientes, ${data?.stats?.encomendas || 0} encomendas geradas.`,
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast({ title: "Copiado!", description: txt });
  };

  return (
    <Card className="border-purple-200 bg-purple-50/40 dark:bg-purple-950/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          Usuário de Demonstração
        </CardTitle>
        <CardDescription>
          Cria/reseta o usuário <strong>{DEMO_EMAIL}</strong> com catálogo clonado da empresa "Docesarin"
          e ~270 vendas dos últimos 90 dias, clientes, encomendas e movimentos de caixa — pronto pra gravar videoaulas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => runAction("setup")}
            disabled={loading !== null}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading === "setup" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Criar/Atualizar Usuário Demo
          </Button>
          <Button
            onClick={() => runAction("reset")}
            disabled={loading !== null}
            variant="outline"
          >
            {loading === "reset" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            Resetar Movimentos (manter catálogo)
          </Button>
        </div>

        <div className="rounded-lg border bg-background p-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Email:</span>
            <div className="flex items-center gap-2">
              <code className="font-mono">{DEMO_EMAIL}</code>
              <Button size="sm" variant="ghost" onClick={() => copy(DEMO_EMAIL)}><Copy className="h-3 w-3" /></Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Senha:</span>
            <div className="flex items-center gap-2">
              <code className="font-mono">{DEMO_PASSWORD}</code>
              <Button size="sm" variant="ghost" onClick={() => copy(DEMO_PASSWORD)}><Copy className="h-3 w-3" /></Button>
            </div>
          </div>
        </div>

        {result && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-sm space-y-1">
            <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" /> Concluído com sucesso!
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary">{result.stats?.vendas} vendas</Badge>
              <Badge variant="secondary">{result.stats?.clientes} clientes</Badge>
              <Badge variant="secondary">{result.stats?.encomendas} encomendas</Badge>
              <Badge variant="secondary">{result.stats?.caixa_movimentos} mov. caixa</Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DemoUserSection;
