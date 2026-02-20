import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { formatCurrencyBRL } from "@/lib/format";

interface GrupoOpcional {
  id: string;
  produto_id: string;
  nome: string;
  min_selecao: number;
  max_selecao: number;
  itens: ItemOpcional[];
}

interface ItemOpcional {
  id: string;
  grupo_id: string;
  nome: string;
  preco_adicional: number;
  ativo: boolean;
}

interface ProdutoSimples {
  id: string;
  nome: string;
}

export function GestaoOpcionais() {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresa_id;
  const [produtos, setProdutos] = useState<ProdutoSimples[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [grupos, setGrupos] = useState<GrupoOpcional[]>([]);
  const [loading, setLoading] = useState(true);

  // Form new grupo
  const [novoGrupoNome, setNovoGrupoNome] = useState("");
  const [novoGrupoMin, setNovoGrupoMin] = useState(0);
  const [novoGrupoMax, setNovoGrupoMax] = useState(1);

  // Form new item
  const [novoItemGrupoId, setNovoItemGrupoId] = useState("");
  const [novoItemNome, setNovoItemNome] = useState("");
  const [novoItemPreco, setNovoItemPreco] = useState("");

  useEffect(() => {
    if (empresaId) carregarProdutos();
  }, [empresaId]);

  useEffect(() => {
    if (produtoSelecionado) carregarGrupos();
  }, [produtoSelecionado]);

  const carregarProdutos = async () => {
    const { data } = await supabase.from("produtos").select("id, nome").eq("empresa_id", empresaId).eq("ativo", true).order("nome");
    setProdutos(data || []);
    setLoading(false);
  };

  const carregarGrupos = async () => {
    const { data: gruposData } = await supabase.from("grupos_opcionais").select("id, produto_id, nome, min_selecao, max_selecao").eq("produto_id", produtoSelecionado).order("ordem");
    const grupoIds = (gruposData || []).map(g => g.id);
    let itensData: ItemOpcional[] = [];
    if (grupoIds.length > 0) {
      const { data } = await supabase.from("itens_opcionais").select("id, grupo_id, nome, preco_adicional, ativo").in("grupo_id", grupoIds).order("ordem");
      itensData = (data || []) as ItemOpcional[];
    }
    setGrupos((gruposData || []).map(g => ({ ...g, itens: itensData.filter(i => i.grupo_id === g.id) })));
  };

  const criarGrupo = async () => {
    if (!novoGrupoNome.trim() || !produtoSelecionado) return;
    const { error } = await supabase.from("grupos_opcionais").insert({
      empresa_id: empresaId!, produto_id: produtoSelecionado, nome: novoGrupoNome.trim(),
      min_selecao: novoGrupoMin, max_selecao: novoGrupoMax, ordem: grupos.length,
    });
    if (error) toast.error("Erro ao criar grupo");
    else { setNovoGrupoNome(""); carregarGrupos(); toast.success("Grupo criado!"); }
  };

  const removerGrupo = async (id: string) => {
    await supabase.from("itens_opcionais").delete().eq("grupo_id", id);
    await supabase.from("grupos_opcionais").delete().eq("id", id);
    carregarGrupos();
    toast.success("Grupo removido");
  };

  const adicionarItem = async () => {
    if (!novoItemNome.trim() || !novoItemGrupoId) return;
    const { error } = await supabase.from("itens_opcionais").insert({
      grupo_id: novoItemGrupoId, nome: novoItemNome.trim(), preco_adicional: Number(novoItemPreco) || 0,
    });
    if (error) toast.error("Erro ao adicionar item");
    else { setNovoItemNome(""); setNovoItemPreco(""); setNovoItemGrupoId(""); carregarGrupos(); toast.success("Item adicionado!"); }
  };

  const removerItem = async (id: string) => {
    await supabase.from("itens_opcionais").delete().eq("id", id);
    carregarGrupos();
  };

  if (loading) return <Card><CardContent className="p-6"><div className="animate-pulse space-y-4"><div className="h-10 bg-muted rounded" /></div></CardContent></Card>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Opcionais e Adicionais</CardTitle>
          <CardDescription>Configure grupos de opcionais para cada produto</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Selecione o produto</Label>
            <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
              <SelectTrigger><SelectValue placeholder="Escolha um produto" /></SelectTrigger>
              <SelectContent>
                {produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {produtoSelecionado && (
        <>
          {/* Criar grupo */}
          <Card>
            <CardHeader><CardTitle className="text-base">Novo grupo de opcionais</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input value={novoGrupoNome} onChange={e => setNovoGrupoNome(e.target.value)} placeholder="Ex: Borda, Molho extra" />
              <div className="flex gap-3">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Mín. seleção</Label>
                  <Input type="number" value={novoGrupoMin} onChange={e => setNovoGrupoMin(Number(e.target.value))} min={0} />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs">Máx. seleção</Label>
                  <Input type="number" value={novoGrupoMax} onChange={e => setNovoGrupoMax(Number(e.target.value))} min={1} />
                </div>
              </div>
              <Button onClick={criarGrupo} disabled={!novoGrupoNome.trim()} size="sm"><Plus className="h-4 w-4 mr-1" />Criar grupo</Button>
            </CardContent>
          </Card>

          {/* Grupos existentes */}
          {grupos.map(grupo => (
            <Card key={grupo.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{grupo.nome}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Min: {grupo.min_selecao} | Max: {grupo.max_selecao}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removerGrupo(grupo.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {grupo.itens.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded border">
                    <span className="text-sm">{item.nome}</span>
                    <div className="flex items-center gap-2">
                      {item.preco_adicional > 0 && <span className="text-xs text-muted-foreground">+{formatCurrencyBRL(item.preco_adicional)}</span>}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removerItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input value={novoItemGrupoId === grupo.id ? novoItemNome : ""} onChange={e => { setNovoItemGrupoId(grupo.id); setNovoItemNome(e.target.value); }} placeholder="Nome do item" className="flex-1" />
                  <Input value={novoItemGrupoId === grupo.id ? novoItemPreco : ""} onChange={e => { setNovoItemGrupoId(grupo.id); setNovoItemPreco(e.target.value); }} placeholder="Preço" type="number" className="w-24" />
                  <Button size="icon" onClick={adicionarItem} disabled={novoItemGrupoId !== grupo.id || !novoItemNome.trim()}><Plus className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
