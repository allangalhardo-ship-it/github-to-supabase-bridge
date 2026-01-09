import { useState } from "react";
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
  Check,
  Divide,
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

const produtosDisponiveis = [
  { id: "p1", nome: "Brigadeiro Gourmet", categoria: "Doce", precoVenda: 3.50 },
  { id: "p2", nome: "Trufa de Chocolate", categoria: "Doce", precoVenda: 5.00 },
  { id: "p3", nome: "Coxinha de Frango", categoria: "Salgado", precoVenda: 4.00 },
  { id: "p4", nome: "Bolo de Cenoura (fatia)", categoria: "Doce", precoVenda: 8.00 },
];

interface Ingrediente {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  custoTotal: number;
}

export default function ReceitasPrototipo() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [rendimento, setRendimento] = useState("");
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [insumoSelecionado, setInsumoSelecionado] = useState("");
  const [quantidadeInsumo, setQuantidadeInsumo] = useState("");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const custoTotalLote = ingredientes.reduce((acc, ing) => acc + ing.custoTotal, 0);
  const custoUnitario = rendimento ? custoTotalLote / parseFloat(rendimento) : 0;
  
  const produtoInfo = produtosDisponiveis.find(p => p.id === produtoSelecionado);
  const margemLucro = produtoInfo && custoUnitario > 0 
    ? ((produtoInfo.precoVenda - custoUnitario) / produtoInfo.precoVenda) * 100 
    : 0;

  const handleAddInsumo = () => {
    if (!insumoSelecionado || !quantidadeInsumo) {
      toast.error("Selecione um insumo e informe a quantidade");
      return;
    }

    const insumo = insumosDisponiveis.find(i => i.id === insumoSelecionado);
    if (!insumo) return;

    const quantidade = parseFloat(quantidadeInsumo);
    
    // Calcula custo proporcional
    let custoCalculado = 0;
    let unidadeUsada = "";
    
    if (insumo.unidade.includes("kg")) {
      // Insumo é vendido por kg, usuário informa em gramas
      custoCalculado = (quantidade / 1000) * insumo.custo;
      unidadeUsada = "g";
    } else if (insumo.unidade.includes("un")) {
      // Insumo é vendido por unidade
      custoCalculado = quantidade * insumo.custo;
      unidadeUsada = "un";
    } else {
      custoCalculado = quantidade * insumo.custo;
      unidadeUsada = insumo.unidade;
    }

    const novoIngrediente: Ingrediente = {
      id: insumo.id,
      nome: insumo.nome,
      quantidade,
      unidade: unidadeUsada,
      custoTotal: custoCalculado,
    };

    setIngredientes([...ingredientes, novoIngrediente]);
    setInsumoSelecionado("");
    setQuantidadeInsumo("");
  };

  const handleRemoveIngrediente = (index: number) => {
    setIngredientes(ingredientes.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!produtoSelecionado || !rendimento || ingredientes.length === 0) {
      toast.error("Preencha todos os campos");
      return;
    }
    toast.success(`Ficha técnica do ${produtoInfo?.nome} atualizada! (protótipo)`);
    setDialogOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setProdutoSelecionado("");
    setRendimento("");
    setIngredientes([]);
    setInsumoSelecionado("");
    setQuantidadeInsumo("");
  };

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
            Monte a receita do lote e calcule o custo unitário automaticamente
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                  <Select value={produtoSelecionado} onValueChange={setProdutoSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Para qual produto é essa receita?" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtosDisponiveis.map((produto) => (
                        <SelectItem key={produto.id} value={produto.id}>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            <span>{produto.nome}</span>
                            <Badge variant="outline" className="ml-2">
                              {formatCurrency(produto.precoVenda)}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {produtoSelecionado && produtoInfo && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm">
                        <strong>{produtoInfo.nome}</strong> - Preço de venda: {formatCurrency(produtoInfo.precoVenda)}
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
                      Adicione os insumos da <strong>panela/lote inteiro</strong>, não da unidade. 
                      Ex: Para fazer brigadeiros, adicione 1 lata de leite condensado, 20g de cacau, etc.
                    </span>
                  </div>

                  {/* Adicionar insumo */}
                  <div className="grid gap-3 md:grid-cols-[1fr,120px,auto]">
                    <Select value={insumoSelecionado} onValueChange={setInsumoSelecionado}>
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
                      placeholder={
                        insumoSelecionado 
                          ? `Qtd (${insumosDisponiveis.find(i => i.id === insumoSelecionado)?.unidade.split(" ")[0] || "un"})`
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
                                <TableCell className="font-medium">{ing.nome}</TableCell>
                                <TableCell className="text-right">
                                  {ing.quantidade} {ing.unidade}
                                </TableCell>
                                <TableCell className="text-right font-medium text-primary">
                                  {formatCurrency(ing.custoTotal)}
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
                      <Label htmlFor="rendimento">Quantas unidades essa receita rende?</Label>
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
                          <p className="text-sm text-muted-foreground mb-1">Custo do Lote</p>
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
                          <p className="text-sm text-muted-foreground mb-1">Rendimento</p>
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
                            <span>Preço de venda: {formatCurrency(produtoInfo.precoVenda)}</span>
                            <Badge variant={margemLucro >= 50 ? "default" : margemLucro >= 30 ? "secondary" : "destructive"}>
                              Margem: {margemLucro.toFixed(1)}%
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Detalhamento da ficha técnica unitária */}
                      {rendimento && parseFloat(rendimento) > 0 && (
                        <div className="mt-4 p-4 bg-background rounded-lg">
                          <p className="font-medium mb-3 flex items-center gap-2">
                            <Check className="h-4 w-4 text-primary" />
                            Ficha Técnica por Unidade:
                          </p>
                          <div className="space-y-1 text-sm">
                            {ingredientes.map((ing, index) => {
                              const qtdPorUnidade = ing.quantidade / parseFloat(rendimento);
                              const custoPorUnidade = ing.custoTotal / parseFloat(rendimento);
                              return (
                                <div key={index} className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    {ing.nome}: {qtdPorUnidade.toFixed(2)}{ing.unidade}
                                  </span>
                                  <span>{formatCurrency(custoPorUnidade)}</span>
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

              {/* Botões de ação */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSave} 
                  className="gap-2"
                  disabled={!produtoSelecionado || !rendimento || ingredientes.length === 0}
                >
                  <Save className="h-4 w-4" />
                  Salvar Ficha Técnica
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Explicação do fluxo */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <FlaskConical className="h-5 w-5 text-primary" />
            Como funciona
          </h3>
          <div className="grid gap-6 md:grid-cols-4">
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-bold">
                1
              </div>
              <div>
                <p className="font-medium">Selecione o Produto</p>
                <p className="text-sm text-muted-foreground">
                  Escolha para qual produto está montando a receita
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-bold">
                2
              </div>
              <div>
                <p className="font-medium">Monte o Lote</p>
                <p className="text-sm text-muted-foreground">
                  Adicione os insumos da panela/receita completa
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-sm font-bold">
                3
              </div>
              <div>
                <p className="font-medium">Informe o Rendimento</p>
                <p className="text-sm text-muted-foreground">
                  Quantas unidades essa receita rende
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 text-sm font-bold">
                ✓
              </div>
              <div>
                <p className="font-medium">Custo Calculado</p>
                <p className="text-sm text-muted-foreground">
                  Sistema divide e atualiza a ficha técnica
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exemplo visual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Exemplo: Brigadeiro Gourmet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Receita do Lote (Panela)
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span>Leite Condensado</span>
                  <span className="font-medium">1 un - R$ 7,50</span>
                </li>
                <li className="flex justify-between">
                  <span>Cacau 100%</span>
                  <span className="font-medium">20g - R$ 0,90</span>
                </li>
                <li className="flex justify-between">
                  <span>Manteiga</span>
                  <span className="font-medium">15g - R$ 0,48</span>
                </li>
                <li className="flex justify-between">
                  <span>Granulado</span>
                  <span className="font-medium">30g - R$ 0,66</span>
                </li>
              </ul>
              <div className="pt-2 border-t">
                <div className="flex justify-between font-semibold">
                  <span>Total do Lote</span>
                  <span className="text-primary">R$ 9,54</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <Divide className="h-8 w-8 text-primary" />
                </div>
                <p className="font-medium">Rendimento</p>
                <p className="text-2xl font-bold text-primary">30 un</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Ficha Técnica Unitária
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span>Leite Condensado</span>
                  <span className="font-medium">0.03 un - R$ 0,25</span>
                </li>
                <li className="flex justify-between">
                  <span>Cacau 100%</span>
                  <span className="font-medium">0.67g - R$ 0,03</span>
                </li>
                <li className="flex justify-between">
                  <span>Manteiga</span>
                  <span className="font-medium">0.50g - R$ 0,02</span>
                </li>
                <li className="flex justify-between">
                  <span>Granulado</span>
                  <span className="font-medium">1.00g - R$ 0,02</span>
                </li>
              </ul>
              <div className="pt-2 border-t">
                <div className="flex justify-between font-semibold">
                  <span>Custo Unitário</span>
                  <span className="text-emerald-600">R$ 0,32</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
