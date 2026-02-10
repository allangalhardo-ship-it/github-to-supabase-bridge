import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Save, Loader2, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyBRL } from "@/lib/format";

interface Produto {
  id: string;
  nome: string;
  categoria: string | null;
}

interface ItemOpcional {
  id?: string;
  nome: string;
  preco_adicional: number;
  ordem: number;
  ativo: boolean;
  isNew?: boolean;
}

interface GrupoOpcional {
  id?: string;
  nome: string;
  min_selecao: number;
  max_selecao: number;
  ordem: number;
  produto_id: string;
  itens: ItemOpcional[];
  isNew?: boolean;
  expanded?: boolean;
}

export function GestaoOpcionais() {
  const { usuario } = useAuth();
  const empresaId = usuario?.empresa_id;

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string>("");
  const [grupos, setGrupos] = useState<GrupoOpcional[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (empresaId) carregarProdutos();
  }, [empresaId]);

  useEffect(() => {
    if (produtoSelecionado) carregarGrupos(produtoSelecionado);
    else setGrupos([]);
  }, [produtoSelecionado]);

  const carregarProdutos = async () => {
    const { data } = await supabase
      .from("produtos")
      .select("id, nome, categoria")
      .eq("empresa_id", empresaId!)
      .eq("ativo", true)
      .order("nome");
    if (data) setProdutos(data);
  };

  const carregarGrupos = async (produtoId: string) => {
    setLoading(true);
    try {
      const { data: gruposData } = await supabase
        .from("grupos_opcionais")
        .select("id, nome, min_selecao, max_selecao, ordem, produto_id")
        .eq("produto_id", produtoId)
        .order("ordem");

      if (!gruposData) { setGrupos([]); return; }

      const gruposComItens: GrupoOpcional[] = [];
      for (const g of gruposData) {
        const { data: itensData } = await supabase
          .from("itens_opcionais")
          .select("id, nome, preco_adicional, ordem, ativo")
          .eq("grupo_id", g.id)
          .order("ordem");
        gruposComItens.push({ ...g, itens: itensData || [], expanded: true });
      }
      setGrupos(gruposComItens);
    } finally {
      setLoading(false);
    }
  };

  const adicionarGrupo = () => {
    setGrupos(prev => [
      ...prev,
      {
        nome: "",
        min_selecao: 0,
        max_selecao: 1,
        ordem: prev.length,
        produto_id: produtoSelecionado,
        itens: [],
        isNew: true,
        expanded: true,
      },
    ]);
  };

  const removerGrupo = async (index: number) => {
    const grupo = grupos[index];
    if (grupo.id) {
      // Delete itens first, then grupo
      for (const item of grupo.itens) {
        if (item.id) await supabase.from("itens_opcionais").delete().eq("id", item.id);
      }
      await supabase.from("grupos_opcionais").delete().eq("id", grupo.id);
    }
    setGrupos(prev => prev.filter((_, i) => i !== index));
    toast.success("Grupo removido");
  };

  const adicionarItem = (grupoIndex: number) => {
    setGrupos(prev => prev.map((g, i) =>
      i === grupoIndex
        ? { ...g, itens: [...g.itens, { nome: "", preco_adicional: 0, ordem: g.itens.length, ativo: true, isNew: true }] }
        : g
    ));
  };

  const removerItem = async (grupoIndex: number, itemIndex: number) => {
    const item = grupos[grupoIndex].itens[itemIndex];
    if (item.id) {
      await supabase.from("itens_opcionais").delete().eq("id", item.id);
    }
    setGrupos(prev => prev.map((g, i) =>
      i === grupoIndex
        ? { ...g, itens: g.itens.filter((_, j) => j !== itemIndex) }
        : g
    ));
  };

  const updateGrupo = (index: number, field: string, value: any) => {
    setGrupos(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
  };

  const updateItem = (grupoIndex: number, itemIndex: number, field: string, value: any) => {
    setGrupos(prev => prev.map((g, gi) =>
      gi === grupoIndex
        ? { ...g, itens: g.itens.map((it, ii) => ii === itemIndex ? { ...it, [field]: value } : it) }
        : g
    ));
  };

  const salvarTudo = async () => {
    if (!empresaId || !produtoSelecionado) return;

    // Validate
    for (const g of grupos) {
      if (!g.nome.trim()) {
        toast.error("Preencha o nome de todos os grupos");
        return;
      }
      for (const it of g.itens) {
        if (!it.nome.trim()) {
          toast.error(`Preencha o nome de todos os itens do grupo "${g.nome}"`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      for (let gi = 0; gi < grupos.length; gi++) {
        const g = grupos[gi];
        let grupoId = g.id;

        if (g.isNew) {
          const { data, error } = await supabase
            .from("grupos_opcionais")
            .insert({
              nome: g.nome,
              min_selecao: g.min_selecao,
              max_selecao: g.max_selecao,
              ordem: gi,
              produto_id: produtoSelecionado,
              empresa_id: empresaId,
            })
            .select("id")
            .single();
          if (error) throw error;
          grupoId = data.id;
        } else {
          await supabase
            .from("grupos_opcionais")
            .update({ nome: g.nome, min_selecao: g.min_selecao, max_selecao: g.max_selecao, ordem: gi })
            .eq("id", grupoId!);
        }

        for (let ii = 0; ii < g.itens.length; ii++) {
          const it = g.itens[ii];
          if (it.isNew || !it.id) {
            await supabase.from("itens_opcionais").insert({
              nome: it.nome,
              preco_adicional: it.preco_adicional,
              ordem: ii,
              ativo: it.ativo,
              grupo_id: grupoId!,
            });
          } else {
            await supabase.from("itens_opcionais").update({
              nome: it.nome,
              preco_adicional: it.preco_adicional,
              ordem: ii,
              ativo: it.ativo,
            }).eq("id", it.id);
          }
        }
      }

      toast.success("Opcionais salvos com sucesso!");
      carregarGrupos(produtoSelecionado);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar opcionais");
    } finally {
      setSaving(false);
    }
  };

  const produtoNome = produtos.find(p => p.id === produtoSelecionado)?.nome;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-5 w-5" />
          Opcionais e Adicionais
        </CardTitle>
        <CardDescription>
          Configure grupos de opcionais (ex: Tamanho, Cobertura) e itens com preço adicional para cada produto
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seletor de produto */}
        <div className="space-y-2">
          <Label>Selecione o produto</Label>
          <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um produto..." />
            </SelectTrigger>
            <SelectContent>
              {produtos.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} {p.categoria && <span className="text-muted-foreground">({p.categoria})</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {produtoSelecionado && loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {produtoSelecionado && !loading && (
          <div className="space-y-4">
            {grupos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum grupo de opcionais cadastrado para "{produtoNome}".
              </p>
            )}

            {grupos.map((grupo, gi) => (
              <div key={gi} className="border rounded-lg overflow-hidden">
                {/* Grupo header */}
                <div
                  className="flex items-center gap-2 p-3 bg-muted/50 cursor-pointer"
                  onClick={() => updateGrupo(gi, "expanded", !grupo.expanded)}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-sm flex-1 truncate">
                    {grupo.nome || "Novo grupo"}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {grupo.itens.length} {grupo.itens.length === 1 ? "item" : "itens"}
                  </Badge>
                  {grupo.min_selecao > 0 && (
                    <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); removerGrupo(gi); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                  {grupo.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>

                {/* Grupo body */}
                {grupo.expanded && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome do grupo *</Label>
                        <Input
                          placeholder="Ex: Tamanho"
                          value={grupo.nome}
                          onChange={(e) => updateGrupo(gi, "nome", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Mín. seleção</Label>
                        <Input
                          type="number"
                          min={0}
                          value={grupo.min_selecao}
                          onChange={(e) => updateGrupo(gi, "min_selecao", parseInt(e.target.value) || 0)}
                        />
                        <p className="text-[10px] text-muted-foreground">0 = opcional</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Máx. seleção</Label>
                        <Input
                          type="number"
                          min={1}
                          value={grupo.max_selecao}
                          onChange={(e) => updateGrupo(gi, "max_selecao", parseInt(e.target.value) || 1)}
                        />
                      </div>
                    </div>

                    {/* Itens */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Itens</Label>
                      {grupo.itens.map((item, ii) => (
                        <div key={ii} className="flex items-center gap-2">
                          <Input
                            placeholder="Nome do item"
                            className="flex-1"
                            value={item.nome}
                            onChange={(e) => updateItem(gi, ii, "nome", e.target.value)}
                          />
                          <div className="relative w-28">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              className="pl-8"
                              value={item.preco_adicional}
                              onChange={(e) => updateItem(gi, ii, "preco_adicional", parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <Switch
                            checked={item.ativo}
                            onCheckedChange={(v) => updateItem(gi, ii, "ativo", v)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={() => removerItem(gi, ii)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => adicionarItem(gi)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={adicionarGrupo} className="flex-1">
                <Plus className="h-4 w-4 mr-2" /> Novo grupo de opcionais
              </Button>
              <Button onClick={salvarTudo} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar opcionais
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
