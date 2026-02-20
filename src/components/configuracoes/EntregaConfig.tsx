import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { formatCurrencyBRL } from "@/lib/format";

interface Bairro {
  id: string;
  nome: string;
  taxa_entrega: number;
  ativo: boolean;
  ordem: number;
}

export function EntregaConfig() {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresa_id;
  const [entregaAtiva, setEntregaAtiva] = useState(false);
  const [pedidoMinimo, setPedidoMinimo] = useState(0);
  const [tempoEstimado, setTempoEstimado] = useState("30-50 min");
  const [chavePix, setChavePix] = useState("");
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [novoBairro, setNovoBairro] = useState("");
  const [novaTaxa, setNovaTaxa] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (empresaId) carregarDados();
  }, [empresaId]);

  const carregarDados = async () => {
    const { data: emp } = await supabase.from("empresas").select("entrega_ativa, pedido_minimo, tempo_estimado_entrega, chave_pix").eq("id", empresaId).single();
    if (emp) {
      setEntregaAtiva(emp.entrega_ativa);
      setPedidoMinimo(emp.pedido_minimo);
      setTempoEstimado(emp.tempo_estimado_entrega || "30-50 min");
      setChavePix(emp.chave_pix || "");
    }
    const { data: bairrosData } = await supabase.from("bairros_entrega").select("*").eq("empresa_id", empresaId).order("ordem");
    setBairros((bairrosData as Bairro[]) || []);
    setLoading(false);
  };

  const salvar = async () => {
    setSaving(true);
    const { error } = await supabase.from("empresas").update({
      entrega_ativa: entregaAtiva,
      pedido_minimo: pedidoMinimo,
      tempo_estimado_entrega: tempoEstimado,
      chave_pix: chavePix || null,
    }).eq("id", empresaId);
    if (error) toast.error("Erro ao salvar");
    else toast.success("Configurações salvas!");
    setSaving(false);
  };

  const adicionarBairro = async () => {
    if (!novoBairro.trim()) return;
    const { error } = await supabase.from("bairros_entrega").insert({
      empresa_id: empresaId!,
      nome: novoBairro.trim(),
      taxa_entrega: Number(novaTaxa) || 0,
      ordem: bairros.length,
    });
    if (error) toast.error("Erro ao adicionar bairro");
    else { setNovoBairro(""); setNovaTaxa(""); carregarDados(); toast.success("Bairro adicionado!"); }
  };

  const removerBairro = async (id: string) => {
    await supabase.from("bairros_entrega").delete().eq("id", id);
    carregarDados();
  };

  const toggleBairro = async (id: string, ativo: boolean) => {
    await supabase.from("bairros_entrega").update({ ativo }).eq("id", id);
    carregarDados();
  };

  if (loading) return <Card><CardContent className="p-6"><div className="animate-pulse space-y-4"><div className="h-10 bg-muted rounded" /><div className="h-10 bg-muted rounded" /></div></CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Entrega & Pagamento</CardTitle>
          <CardDescription>Configure opções de entrega, frete e pagamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Entrega ativa</Label>
              <p className="text-xs text-muted-foreground">Habilitar entrega além da retirada</p>
            </div>
            <Switch checked={entregaAtiva} onCheckedChange={setEntregaAtiva} />
          </div>

          {entregaAtiva && (
            <div className="space-y-4 pl-1 border-l-2 border-primary/20 ml-2 pl-4">
              <div className="space-y-2">
                <Label>Pedido mínimo para entrega (R$)</Label>
                <Input type="number" value={pedidoMinimo} onChange={e => setPedidoMinimo(Number(e.target.value))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Tempo estimado de entrega</Label>
                <Input value={tempoEstimado} onChange={e => setTempoEstimado(e.target.value)} placeholder="30-50 min" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Chave PIX</Label>
            <Input value={chavePix} onChange={e => setChavePix(e.target.value)} placeholder="CPF, email, telefone ou chave aleatória" />
            <p className="text-xs text-muted-foreground">Será exibida para o cliente ao escolher PIX</p>
          </div>

          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </CardContent>
      </Card>

      {entregaAtiva && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🏘️ Bairros e taxas de entrega</CardTitle>
            <CardDescription>Cadastre os bairros atendidos e o valor do frete</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={novoBairro} onChange={e => setNovoBairro(e.target.value)} placeholder="Nome do bairro" className="flex-1" />
              <Input value={novaTaxa} onChange={e => setNovaTaxa(e.target.value)} placeholder="Taxa (R$)" type="number" className="w-28" />
              <Button size="icon" onClick={adicionarBairro} disabled={!novoBairro.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {bairros.map(bairro => (
                <div key={bairro.id} className={`flex items-center justify-between p-3 rounded-lg border ${bairro.ativo ? "bg-background" : "bg-muted/50 opacity-60"}`}>
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{bairro.nome}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-emerald-700">
                      {bairro.taxa_entrega === 0 ? "Grátis" : formatCurrencyBRL(bairro.taxa_entrega)}
                    </span>
                    <Switch checked={bairro.ativo} onCheckedChange={checked => toggleBairro(bairro.id, checked)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removerBairro(bairro.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {bairros.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum bairro cadastrado</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
