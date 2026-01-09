import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Plus,
  Trash2,
  Calculator,
  Layers,
  Package,
  ChefHat,
  ArrowRight,
  Sparkles,
  FlaskConical,
  Search,
  Save,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// Dados mockados para o protótipo
const insumosDisponiveis = [
  { id: "1", nome: "Leite Condensado", unidade: "un (395g)", custo: 7.50 },
  { id: "2", nome: "Cacau 100%", unidade: "kg", custo: 45.00 },
  { id: "3", nome: "Manteiga", unidade: "kg", custo: 32.00 },
  { id: "4", nome: "Chocolate ao Leite", unidade: "kg", custo: 38.00 },
  { id: "5", nome: "Creme de Leite", unidade: "un (200g)", custo: 4.50 },
  { id: "6", nome: "Granulado", unidade: "kg", custo: 22.00 },
  { id: "7", nome: "Açúcar", unidade: "kg", custo: 5.00 },
  { id: "8", nome: "Farinha de Trigo", unidade: "kg", custo: 6.50 },
];

const receitasIntermediarias = [
  { 
    id: "r1", 
    nome: "Ganache de Chocolate", 
    rendimento: 500, 
    unidadeRendimento: "g",
    custoTotal: 18.50,
    custoPorUnidade: 0.037,
    ingredientes: [
      { tipo: "insumo", id: "4", nome: "Chocolate ao Leite", quantidade: 250, unidade: "g", custo: 9.50 },
      { tipo: "insumo", id: "5", nome: "Creme de Leite", quantidade: 2, unidade: "un", custo: 9.00 },
    ]
  },
  { 
    id: "r2", 
    nome: "Brigadeiro Base", 
    rendimento: 450, 
    unidadeRendimento: "g",
    custoTotal: 9.80,
    custoPorUnidade: 0.022,
    ingredientes: [
      { tipo: "insumo", id: "1", nome: "Leite Condensado", quantidade: 1, unidade: "un", custo: 7.50 },
      { tipo: "insumo", id: "2", nome: "Cacau 100%", quantidade: 20, unidade: "g", custo: 0.90 },
      { tipo: "insumo", id: "3", nome: "Manteiga", quantidade: 15, unidade: "g", custo: 0.48 },
    ]
  },
];

// Produtos mockados para vincular
const produtosDisponiveis = [
  { id: "p1", nome: "Brigadeiro Gourmet", categoria: "Doce", precoVenda: 3.50 },
  { id: "p2", nome: "Trufa de Chocolate", categoria: "Doce", precoVenda: 5.00 },
  { id: "p3", nome: "Coxinha de Frango", categoria: "Salgado", precoVenda: 4.00 },
  { id: "p4", nome: "Bolo de Cenoura (fatia)", categoria: "Doce", precoVenda: 8.00 },
];

interface Ingrediente {
  tipo: "insumo" | "receita";
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  custo: number;
}

export default function ReceitasPrototipo() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipoReceita, setTipoReceita] = useState<"intermediaria" | "final">("intermediaria");
  const [nomeReceita, setNomeReceita] = useState("");
  const [rendimento, setRendimento] = useState("");
  const [unidadeRendimento, setUnidadeRendimento] = useState("unidade");
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [tipoIngrediente, setTipoIngrediente] = useState<"insumo" | "receita">("insumo");
  const [ingredienteSelecionado, setIngredienteSelecionado] = useState("");
  const [quantidadeIngrediente, setQuantidadeIngrediente] = useState("");
  const [busca, setBusca] = useState("");
  const [produtoVinculado, setProdutoVinculado] = useState("");
  const [criarNovoProduto, setCriarNovoProduto] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const custoTotal = ingredientes.reduce((acc, ing) => acc + ing.custo, 0);
  const custoPorUnidade = rendimento ? custoTotal / parseFloat(rendimento) : 0;

  const handleAddIngrediente = () => {
    if (!ingredienteSelecionado || !quantidadeIngrediente) {
      toast.error("Selecione um ingrediente e quantidade");
      return;
    }

    const quantidade = parseFloat(quantidadeIngrediente);
    let novoIngrediente: Ingrediente;

    if (tipoIngrediente === "insumo") {
      const insumo = insumosDisponiveis.find(i => i.id === ingredienteSelecionado);
      if (!insumo) return;
      
      // Calcula custo proporcional
      let custoCalculado = 0;
      if (insumo.unidade.includes("kg")) {
        custoCalculado = (quantidade / 1000) * insumo.custo;
      } else if (insumo.unidade.includes("un")) {
        custoCalculado = quantidade * insumo.custo;
      } else {
        custoCalculado = quantidade * insumo.custo;
      }

      novoIngrediente = {
        tipo: "insumo",
        id: insumo.id,
        nome: insumo.nome,
        quantidade,
        unidade: insumo.unidade.includes("kg") ? "g" : "un",
        custo: custoCalculado,
      };
    } else {
      const receita = receitasIntermediarias.find(r => r.id === ingredienteSelecionado);
      if (!receita) return;

      novoIngrediente = {
        tipo: "receita",
        id: receita.id,
        nome: receita.nome,
        quantidade,
        unidade: receita.unidadeRendimento,
        custo: quantidade * receita.custoPorUnidade,
      };
    }

    setIngredientes([...ingredientes, novoIngrediente]);
    setIngredienteSelecionado("");
    setQuantidadeIngrediente("");
    toast.success("Ingrediente adicionado!");
  };

  const handleRemoveIngrediente = (index: number) => {
    setIngredientes(ingredientes.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!nomeReceita || !rendimento || ingredientes.length === 0) {
      toast.error("Preencha todos os campos");
      return;
    }
    toast.success("Receita salva com sucesso! (protótipo)");
    setDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setNomeReceita("");
    setRendimento("");
    setUnidadeRendimento("unidade");
    setIngredientes([]);
    setTipoReceita("intermediaria");
    setProdutoVinculado("");
    setCriarNovoProduto(false);
  };

  const receitasFiltradas = receitasIntermediarias.filter(r => 
    r.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Calculador de Receitas</h1>
            <Badge variant="secondary" className="ml-2">Protótipo</Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Monte receitas, calcule custos e vincule a produtos
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Receita
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ChefHat className="h-5 w-5" />
                Criar Nova Receita
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Tipo de Receita */}
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={tipoReceita === "intermediaria" ? "default" : "outline"}
                  className="flex-1 gap-2"
                  onClick={() => setTipoReceita("intermediaria")}
                >
                  <Layers className="h-4 w-4" />
                  Intermediária
                </Button>
                <Button
                  type="button"
                  variant={tipoReceita === "final" ? "default" : "outline"}
                  className="flex-1 gap-2"
                  onClick={() => setTipoReceita("final")}
                >
                  <Package className="h-4 w-4" />
                  Produto Final
                </Button>
              </div>
              
              {tipoReceita === "intermediaria" && (
                <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>
                    <strong>Receita Intermediária:</strong> Um componente que será usado em outras receitas 
                    (ex: ganache, recheio, massa). Pode ser adicionado como ingrediente em outras receitas.
                  </span>
                </div>
              )}

              {tipoReceita === "final" && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Vincular ao Produto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-2 p-3 bg-background rounded-lg text-sm">
                      <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>
                        <strong>Produto Final:</strong> Esta receita será a ficha técnica do produto selecionado. 
                        O custo unitário será calculado automaticamente.
                      </span>
                    </div>

                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant={!criarNovoProduto ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setCriarNovoProduto(false)}
                      >
                        Vincular a produto existente
                      </Button>
                      <Button
                        type="button"
                        variant={criarNovoProduto ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setCriarNovoProduto(true)}
                      >
                        Criar novo produto
                      </Button>
                    </div>

                    {!criarNovoProduto ? (
                      <div>
                        <Label>Selecione o Produto</Label>
                        <Select value={produtoVinculado} onValueChange={setProdutoVinculado}>
                          <SelectTrigger>
                            <SelectValue placeholder="Escolha um produto para vincular" />
                          </SelectTrigger>
                          <SelectContent>
                            {produtosDisponiveis.map((produto) => (
                              <SelectItem key={produto.id} value={produto.id}>
                                <div className="flex items-center justify-between gap-4">
                                  <span>{produto.nome}</span>
                                  <Badge variant="outline" className="ml-2">
                                    {produto.categoria}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {produtoVinculado && (
                          <p className="text-sm text-muted-foreground mt-2">
                            A ficha técnica deste produto será atualizada com esta receita.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Um novo produto será criado automaticamente ao salvar a receita.
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <Label>Nome do Produto</Label>
                            <Input placeholder="Ex: Brigadeiro Gourmet" />
                          </div>
                          <div>
                            <Label>Preço de Venda (R$)</Label>
                            <Input type="number" placeholder="0,00" step="0.01" />
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Informações Básicas */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Label htmlFor="nome">Nome da Receita</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Ganache de Chocolate"
                    value={nomeReceita}
                    onChange={(e) => setNomeReceita(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Select defaultValue="doce">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="doce">Doce</SelectItem>
                      <SelectItem value="salgado">Salgado</SelectItem>
                      <SelectItem value="base">Base/Componente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Rendimento */}
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Rendimento da Receita
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="rendimento">Quantidade que rende</Label>
                      <Input
                        id="rendimento"
                        type="number"
                        placeholder="Ex: 30"
                        value={rendimento}
                        onChange={(e) => setRendimento(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Unidade</Label>
                      <Select value={unidadeRendimento} onValueChange={setUnidadeRendimento}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unidade">Unidades</SelectItem>
                          <SelectItem value="g">Gramas (g)</SelectItem>
                          <SelectItem value="kg">Quilos (kg)</SelectItem>
                          <SelectItem value="ml">Mililitros (ml)</SelectItem>
                          <SelectItem value="l">Litros (L)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Adicionar Ingredientes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Ingredientes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tabs para tipo de ingrediente */}
                  <Tabs value={tipoIngrediente} onValueChange={(v) => setTipoIngrediente(v as "insumo" | "receita")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="insumo" className="gap-2">
                        <Package className="h-4 w-4" />
                        Insumo
                      </TabsTrigger>
                      <TabsTrigger value="receita" className="gap-2">
                        <Layers className="h-4 w-4" />
                        Receita Intermediária
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="insumo" className="mt-4">
                      <div className="grid gap-3 md:grid-cols-[1fr,120px,auto]">
                        <Select value={ingredienteSelecionado} onValueChange={setIngredienteSelecionado}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o insumo" />
                          </SelectTrigger>
                          <SelectContent>
                            {insumosDisponiveis.map((insumo) => (
                              <SelectItem key={insumo.id} value={insumo.id}>
                                {insumo.nome} ({insumo.unidade}) - {formatCurrency(insumo.custo)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Qtd"
                          value={quantidadeIngrediente}
                          onChange={(e) => setQuantidadeIngrediente(e.target.value)}
                        />
                        <Button onClick={handleAddIngrediente} className="gap-2">
                          <Plus className="h-4 w-4" />
                          Adicionar
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="receita" className="mt-4">
                      {receitasIntermediarias.length === 0 ? (
                        <p className="text-muted-foreground text-sm text-center py-4">
                          Nenhuma receita intermediária cadastrada ainda.
                        </p>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-[1fr,120px,auto]">
                          <Select value={ingredienteSelecionado} onValueChange={setIngredienteSelecionado}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a receita" />
                            </SelectTrigger>
                            <SelectContent>
                              {receitasIntermediarias.map((receita) => (
                                <SelectItem key={receita.id} value={receita.id}>
                                  {receita.nome} ({formatCurrency(receita.custoPorUnidade)}/{receita.unidadeRendimento})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            placeholder="Qtd (g)"
                            value={quantidadeIngrediente}
                            onChange={(e) => setQuantidadeIngrediente(e.target.value)}
                          />
                          <Button onClick={handleAddIngrediente} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Adicionar
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {/* Lista de ingredientes adicionados */}
                  {ingredientes.length > 0 && (
                    <div className="border rounded-lg overflow-hidden mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ingrediente</TableHead>
                            <TableHead className="text-right">Quantidade</TableHead>
                            <TableHead className="text-right">Custo</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AnimatePresence>
                            {ingredientes.map((ing, index) => (
                              <motion.tr
                                key={`${ing.id}-${index}`}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="border-b"
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {ing.tipo === "receita" ? (
                                      <Badge variant="secondary" className="text-xs">
                                        <Layers className="h-3 w-3 mr-1" />
                                        Receita
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">
                                        <Package className="h-3 w-3 mr-1" />
                                        Insumo
                                      </Badge>
                                    )}
                                    {ing.nome}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  {ing.quantidade} {ing.unidade}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(ing.custo)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveIngrediente(index)}
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
                </CardContent>
              </Card>

              {/* Resumo de Custos */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center p-4 bg-background rounded-lg">
                      <p className="text-sm text-muted-foreground">Custo Total</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(custoTotal)}
                      </p>
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="text-center p-4 bg-background rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Custo por {unidadeRendimento === "unidade" ? "Unidade" : unidadeRendimento}
                      </p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {rendimento ? formatCurrency(custoPorUnidade) : "R$ 0,00"}
                      </p>
                      {rendimento && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatCurrency(custoTotal)} ÷ {rendimento} {unidadeRendimento}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Botões de ação */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} className="gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Receita
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar receitas..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs de Receitas */}
      <Tabs defaultValue="todas">
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="intermediarias" className="gap-2">
            <Layers className="h-4 w-4" />
            Intermediárias
          </TabsTrigger>
          <TabsTrigger value="finais" className="gap-2">
            <Package className="h-4 w-4" />
            Finais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todas" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {receitasFiltradas.map((receita, index) => (
              <motion.div
                key={receita.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{receita.nome}</CardTitle>
                        <Badge variant="secondary" className="mt-1">
                          <Layers className="h-3 w-3 mr-1" />
                          Intermediária
                        </Badge>
                      </div>
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Rendimento</p>
                        <p className="font-medium">
                          {receita.rendimento} {receita.unidadeRendimento}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ingredientes</p>
                        <p className="font-medium">{receita.ingredientes.length} itens</p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Custo Total</p>
                          <p className="font-semibold">{formatCurrency(receita.custoTotal)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Custo/{receita.unidadeRendimento}
                          </p>
                          <p className="font-semibold text-emerald-600">
                            {formatCurrency(receita.custoPorUnidade)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        Duplicar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {/* Card de adicionar nova */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: receitasFiltradas.length * 0.1 }}
            >
              <Card 
                className="border-dashed hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer h-full min-h-[250px] flex items-center justify-center"
                onClick={() => setDialogOpen(true)}
              >
                <CardContent className="text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium">Criar Nova Receita</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Adicione ingredientes e calcule custos
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="intermediarias" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {receitasFiltradas.map((receita, index) => (
              <motion.div
                key={receita.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{receita.nome}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Rendimento</p>
                        <p className="font-medium">{receita.rendimento} {receita.unidadeRendimento}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Custo/unidade</p>
                        <p className="font-semibold text-emerald-600">
                          {formatCurrency(receita.custoPorUnidade)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="finais" className="mt-6">
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium">Nenhuma receita final ainda</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Crie receitas finais que usam insumos e receitas intermediárias
            </p>
            <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Criar Receita Final
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Explicação do fluxo */}
      <Card className="mt-8 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            Como funciona o fluxo
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-bold">
                1
              </div>
              <div>
                <p className="font-medium">Cadastre Receitas Base</p>
                <p className="text-sm text-muted-foreground">
                  Ganaches, recheios, massas - componentes reutilizáveis
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-bold">
                2
              </div>
              <div>
                <p className="font-medium">Crie Produtos Finais</p>
                <p className="text-sm text-muted-foreground">
                  Use insumos + receitas base para montar o produto
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-bold">
                3
              </div>
              <div>
                <p className="font-medium">Custo Automático</p>
                <p className="text-sm text-muted-foreground">
                  Sistema calcula custo unitário baseado no rendimento
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
