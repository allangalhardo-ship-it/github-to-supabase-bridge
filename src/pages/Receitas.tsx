import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Trash2,
  Calculator,
  Package,
  ChefHat,
  ArrowRight,
  FlaskConical,
  Save,
  AlertCircle,
  Divide,
} from "lucide-react";
import { toast } from "sonner";

interface IngredienteLote {
  id: string;
  insumoId: string;
  nome: string;
  quantidadeLote: number;
  unidade: string;
  custoUnitarioInsumo: number;
  custoTotal: number;
}

export default function Receitas() {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [rendimento, setRendimento] = useState("");
  const [ingredientes, setIngredientes] = useState<IngredienteLote[]>([]);
  const [insumoSelecionado, setInsumoSelecionado] = useState("");
  const [quantidadeInsumo, setQuantidadeInsumo] = useState("");

  // Fetch produtos
  const { data: produtos, isLoading: loadingProdutos } = useQuery({
    queryKey: ["produtos-receitas", usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select(`
          id, 
          nome, 
          preco_venda, 
          categoria,
          rendimento_padrao,
          fichas_tecnicas (
            id,
            quantidade,
            insumos (
              id,
              nome,
              unidade_medida,
              custo_unitario
            )
          )
        `)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  // Fetch insumos (inclui intermediários para poder usar em receitas)
  const { data: insumos, isLoading: loadingInsumos } = useQuery({
    queryKey: ["insumos-receitas", usuario?.empresa_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insumos")
        .select("id, nome, unidade_medida, custo_unitario, is_intermediario")
        .order("nome");

      if (error) throw error;
      return data;
    },
    enabled: !!usuario?.empresa_id,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const custoTotalLote = useMemo(() => 
    ingredientes.reduce((acc, ing) => acc + ing.custoTotal, 0), 
    [ingredientes]
  );
  
  const custoUnitario = useMemo(() => 
    rendimento && parseFloat(rendimento) > 0 ? custoTotalLote / parseFloat(rendimento) : 0,
    [custoTotalLote, rendimento]
  );

  const produtoInfo = useMemo(() => 
    produtos?.find((p) => p.id === produtoSelecionado),
    [produtos, produtoSelecionado]
  );

  const margemLucro = useMemo(() => 
    produtoInfo && custoUnitario > 0
      ? ((produtoInfo.preco_venda - custoUnitario) / produtoInfo.preco_venda) * 100
      : 0,
    [produtoInfo, custoUnitario]
  );

  const insumoInfo = useMemo(() => 
    insumos?.find((i) => i.id === insumoSelecionado),
    [insumos, insumoSelecionado]
  );

  const handleAddInsumo = () => {
    if (!insumoSelecionado || !quantidadeInsumo) {
      toast.error("Selecione um insumo e informe a quantidade");
      return;
    }

    const insumo = insumos?.find((i) => i.id === insumoSelecionado);
    if (!insumo) return;

    const quantidade = parseFloat(quantidadeInsumo);
    const custoCalculado = quantidade * insumo.custo_unitario;

    const novoIngrediente: IngredienteLote = {
      id: crypto.randomUUID(),
      insumoId: insumo.id,
      nome: insumo.nome,
      quantidadeLote: quantidade,
      unidade: insumo.unidade_medida,
      custoUnitarioInsumo: insumo.custo_unitario,
      custoTotal: custoCalculado,
    };

    setIngredientes([...ingredientes, novoIngrediente]);
    setInsumoSelecionado("");
    setQuantidadeInsumo("");
  };

  const handleRemoveIngrediente = (id: string) => {
    setIngredientes(ingredientes.filter((ing) => ing.id !== id));
  };

  // Mutation para salvar ficha técnica
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!produtoSelecionado || !rendimento || ingredientes.length === 0) {
        throw new Error("Preencha todos os campos");
      }

      const rendimentoNum = parseFloat(rendimento);
      if (rendimentoNum <= 0) {
        throw new Error("Rendimento deve ser maior que zero");
      }

      // 1. Atualizar rendimento_padrao do produto
      const { error: produtoError } = await supabase
        .from("produtos")
        .update({ rendimento_padrao: rendimentoNum })
        .eq("id", produtoSelecionado);

      if (produtoError) throw produtoError;

      // 2. Deletar ficha técnica existente
      const { error: deleteError } = await supabase
        .from("fichas_tecnicas")
        .delete()
        .eq("produto_id", produtoSelecionado);

      if (deleteError) throw deleteError;

      // 3. Inserir nova ficha técnica com quantidades unitárias
      const fichasTecnicas = ingredientes.map((ing) => ({
        produto_id: produtoSelecionado,
        insumo_id: ing.insumoId,
        quantidade: ing.quantidadeLote / rendimentoNum, // Quantidade por unidade
      }));

      const { error: insertError } = await supabase
        .from("fichas_tecnicas")
        .insert(fichasTecnicas);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      queryClient.invalidateQueries({ queryKey: ["produtos-receitas"] });
      toast.success(`Ficha técnica de ${produtoInfo?.nome} salva com sucesso!`);
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setProdutoSelecionado("");
    setRendimento("");
    setIngredientes([]);
    setInsumoSelecionado("");
    setQuantidadeInsumo("");
  };

  const handleLoadExistingRecipe = (produtoId: string) => {
    const produto = produtos?.find((p) => p.id === produtoId);
    if (!produto) return;

    setProdutoSelecionado(produtoId);
    
    // Carregar rendimento existente
    if (produto.rendimento_padrao) {
      setRendimento(produto.rendimento_padrao.toString());
    }

    // Carregar ingredientes da ficha técnica (convertendo de unitário para lote)
    if (produto.fichas_tecnicas && produto.fichas_tecnicas.length > 0) {
      const rendimentoExistente = produto.rendimento_padrao || 1;
      const ingredientesCarregados: IngredienteLote[] = produto.fichas_tecnicas.map((ft) => ({
        id: ft.id,
        insumoId: ft.insumos.id,
        nome: ft.insumos.nome,
        quantidadeLote: ft.quantidade * rendimentoExistente, // Converter de unitário para lote
        unidade: ft.insumos.unidade_medida,
        custoUnitarioInsumo: ft.insumos.custo_unitario,
        custoTotal: ft.quantidade * rendimentoExistente * ft.insumos.custo_unitario,
      }));
      setIngredientes(ingredientesCarregados);
    } else {
      setIngredientes([]);
    }
  };

  // Calcular custo de um produto baseado na ficha técnica
  const calcularCustoProduto = (produto: typeof produtos extends (infer T)[] | undefined ? T : never) => {
    if (!produto?.fichas_tecnicas) return 0;
    return produto.fichas_tecnicas.reduce((sum, ft) => {
      return sum + (ft.quantidade * (ft.insumos?.custo_unitario || 0));
    }, 0);
  };

  const isLoading = loadingProdutos || loadingInsumos;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Calculador de Receitas</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Monte a receita do lote e calcule o custo unitário automaticamente
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Calculator className="h-4 w-4" />
              Calcular Ficha Técnica
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ChefHat className="h-5 w-5" />
                Calculador de Ficha Técnica
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Passo 1: Selecionar Produto */}
              <Card className="border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    Selecione o Produto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={produtoSelecionado}
                    onValueChange={handleLoadExistingRecipe}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Para qual produto é essa receita?" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos?.map((produto) => (
                        <SelectItem key={produto.id} value={produto.id}>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            <span>{produto.nome}</span>
                            <Badge variant="outline" className="ml-2">
                              {formatCurrency(produto.preco_venda)}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {produtoSelecionado && produtoInfo && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm">
                        <strong>{produtoInfo.nome}</strong> - Preço de venda:{" "}
                        {formatCurrency(produtoInfo.preco_venda)}
                        {produtoInfo.rendimento_padrao && (
                          <span className="ml-2 text-muted-foreground">
                            (Rendimento atual: {produtoInfo.rendimento_padrao} un)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Passo 2: Montar Receita do Lote */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    Monte a Receita do Lote
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>
                      Adicione os insumos da{" "}
                      <strong>panela/lote inteiro</strong>, não da unidade. Ex:
                      Para fazer brigadeiros, adicione 1 lata de leite
                      condensado, 0.02kg de cacau, etc.
                    </span>
                  </div>

                  {/* Adicionar insumo */}
                  <div className="grid gap-3 md:grid-cols-[1fr,120px,auto]">
                    <Select
                      value={insumoSelecionado}
                      onValueChange={setInsumoSelecionado}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o insumo" />
                      </SelectTrigger>
                      <SelectContent>
                        {insumos?.map((insumo) => (
                          <SelectItem key={insumo.id} value={insumo.id}>
                            <div className="flex items-center gap-2">
                              {insumo.is_intermediario && (
                                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-purple-100 dark:bg-purple-900/30">
                                  <FlaskConical className="h-3 w-3 text-purple-500" />
                                </span>
                              )}
                              <span>{insumo.nome} ({insumo.unidade_medida})</span>
                              <span className="text-muted-foreground">- {formatCurrency(insumo.custo_unitario)}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.001"
                      placeholder={
                        insumoInfo
                          ? `Qtd (${insumoInfo.unidade_medida})`
                          : "Qtd"
                      }
                      value={quantidadeInsumo}
                      onChange={(e) => setQuantidadeInsumo(e.target.value)}
                    />
                    <Button onClick={handleAddInsumo} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>

                  {/* Lista de ingredientes */}
                  {ingredientes.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Insumo</TableHead>
                            <TableHead className="text-right">
                              Quantidade
                            </TableHead>
                            <TableHead className="text-right">Custo</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AnimatePresence>
                            {ingredientes.map((ing) => (
                              <motion.tr
                                key={ing.id}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="border-b"
                              >
                                <TableCell className="font-medium">
                                  {ing.nome}
                                </TableCell>
                                <TableCell className="text-right">
                                  {ing.quantidadeLote} {ing.unidade}
                                </TableCell>
                                <TableCell className="text-right font-medium text-primary">
                                  {formatCurrency(ing.custoTotal)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveIngrediente(ing.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {ingredientes.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <ChefHat className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Adicione os insumos da receita</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Passo 3: Rendimento */}
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    Informe o Rendimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor="rendimento">
                        Quantas unidades essa receita rende?
                      </Label>
                      <Input
                        id="rendimento"
                        type="number"
                        placeholder="Ex: 30 brigadeiros"
                        value={rendimento}
                        onChange={(e) => setRendimento(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="text-center pt-6">
                      <p className="text-sm text-muted-foreground">unidades</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resultado: Cálculo Automático */}
              {ingredientes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Card className="bg-gradient-to-r from-primary/10 to-emerald-500/10 border-primary/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-primary" />
                        Resultado do Cálculo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-4 items-center">
                        {/* Custo do Lote */}
                        <div className="text-center p-4 bg-background rounded-lg">
                          <p className="text-sm text-muted-foreground mb-1">
                            Custo do Lote
                          </p>
                          <p className="text-2xl font-bold">
                            {formatCurrency(custoTotalLote)}
                          </p>
                        </div>

                        {/* Divisão */}
                        <div className="flex items-center justify-center">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Divide className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>

                        {/* Rendimento */}
                        <div className="text-center p-4 bg-background rounded-lg">
                          <p className="text-sm text-muted-foreground mb-1">
                            Rendimento
                          </p>
                          <p className="text-2xl font-bold">
                            {rendimento || "0"} un
                          </p>
                        </div>

                        {/* Igual */}
                        <div className="hidden md:flex items-center justify-center">
                          <ArrowRight className="h-6 w-6 text-primary" />
                        </div>
                      </div>

                      {/* Custo Unitário */}
                      <div className="mt-4 p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          Custo por Unidade (CMV)
                        </p>
                        <p className="text-4xl font-bold text-emerald-600">
                          {formatCurrency(custoUnitario)}
                        </p>
                        {produtoInfo && custoUnitario > 0 && (
                          <div className="mt-3 flex items-center justify-center gap-4 text-sm">
                            <span>
                              Preço de venda:{" "}
                              {formatCurrency(produtoInfo.preco_venda)}
                            </span>
                            <Badge
                              variant={
                                margemLucro >= 50
                                  ? "default"
                                  : margemLucro >= 30
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              Margem: {margemLucro.toFixed(1)}%
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Detalhamento da ficha técnica unitária */}
                      {rendimento && parseFloat(rendimento) > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">
                            Ficha Técnica por Unidade:
                          </p>
                          <div className="grid gap-1 text-sm">
                            {ingredientes.map((ing) => {
                              const qtdUnitaria =
                                ing.quantidadeLote / parseFloat(rendimento);
                              return (
                                <div
                                  key={ing.id}
                                  className="flex justify-between p-2 bg-background rounded"
                                >
                                  <span>{ing.nome}</span>
                                  <span className="text-muted-foreground">
                                    {qtdUnitaria.toFixed(4)} {ing.unidade} ={" "}
                                    {formatCurrency(
                                      qtdUnitaria * ing.custoUnitarioInsumo
                                    )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Botão Salvar */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={
                    !produtoSelecionado ||
                    !rendimento ||
                    ingredientes.length === 0 ||
                    saveMutation.isPending
                  }
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? "Salvando..." : "Salvar Ficha Técnica"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Produtos com Fichas Técnicas */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : produtos && produtos.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {produtos.map((produto) => {
            const custo = calcularCustoProduto(produto);
            const margem =
              produto.preco_venda > 0
                ? ((produto.preco_venda - custo) / produto.preco_venda) * 100
                : 0;
            const temFicha =
              produto.fichas_tecnicas && produto.fichas_tecnicas.length > 0;

            return (
              <Card
                key={produto.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  handleLoadExistingRecipe(produto.id);
                  setDialogOpen(true);
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{produto.nome}</CardTitle>
                    </div>
                    <Badge variant={temFicha ? "default" : "secondary"}>
                      {temFicha
                        ? `${produto.fichas_tecnicas?.length} insumos`
                        : "Sem ficha"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Preço Venda</p>
                      <p className="font-bold text-lg">
                        {formatCurrency(produto.preco_venda)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Custo Unitário</p>
                      <p className="font-medium">
                        {temFicha ? formatCurrency(custo) : "-"}
                      </p>
                    </div>
                  </div>

                  {temFicha && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Margem: {margem.toFixed(1)}%</span>
                          {produto.rendimento_padrao && (
                            <span className="text-muted-foreground">
                              Rende: {produto.rendimento_padrao} un
                            </span>
                          )}
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              margem >= 50
                                ? "bg-emerald-500"
                                : margem >= 30
                                ? "bg-amber-500"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${Math.min(margem, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <Button variant="ghost" className="w-full justify-center gap-2">
                    <Calculator className="h-4 w-4" />
                    {temFicha ? "Editar Receita" : "Criar Receita"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <ChefHat className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum produto cadastrado</h3>
          <p className="text-muted-foreground mb-4">
            Cadastre produtos primeiro para criar as fichas técnicas.
          </p>
        </Card>
      )}
    </div>
  );
}
