import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, Send, Store, Clock, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatCurrencyBRL } from "@/lib/format";

interface Produto {
  id: string;
  nome: string;
  preco_venda: number;
  categoria: string | null;
  imagem_url: string | null;
  observacoes_ficha: string | null;
}

interface Empresa {
  id: string;
  nome: string;
  cardapio_descricao: string | null;
  horario_funcionamento: string | null;
  whatsapp_dono: string | null;
}

interface CarrinhoItem {
  produto: Produto;
  quantidade: number;
  observacao: string;
}

interface DadosCliente {
  nome: string;
  whatsapp: string;
  endereco: string;
  observacoes: string;
}

export default function Cardapio() {
  const { slug } = useParams<{ slug: string }>();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [dadosCliente, setDadosCliente] = useState<DadosCliente>({
    nome: "",
    whatsapp: "",
    endereco: "",
    observacoes: "",
  });

  useEffect(() => {
    if (slug) {
      carregarCardapio();
    }
  }, [slug]);

  const carregarCardapio = async () => {
    try {
      // Buscar empresa pelo slug
      const { data: empresaData, error: empresaError } = await supabase
        .from("empresas")
        .select("id, nome, cardapio_descricao, horario_funcionamento, whatsapp_dono")
        .eq("slug", slug)
        .eq("cardapio_ativo", true)
        .single();

      if (empresaError || !empresaData) {
        toast.error("Cardápio não encontrado ou inativo");
        return;
      }

      setEmpresa(empresaData);

      // Buscar produtos ativos da empresa
      const { data: produtosData, error: produtosError } = await supabase
        .from("produtos")
        .select("id, nome, preco_venda, categoria, imagem_url, observacoes_ficha")
        .eq("empresa_id", empresaData.id)
        .eq("ativo", true)
        .order("categoria")
        .order("nome");

      if (produtosError) throw produtosError;

      setProdutos(produtosData || []);
    } catch (error) {
      console.error("Erro ao carregar cardápio:", error);
      toast.error("Erro ao carregar cardápio");
    } finally {
      setLoading(false);
    }
  };

  const adicionarAoCarrinho = (produto: Produto) => {
    setCarrinho((prev) => {
      const existente = prev.find((item) => item.produto.id === produto.id);
      if (existente) {
        return prev.map((item) =>
          item.produto.id === produto.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }
      return [...prev, { produto, quantidade: 1, observacao: "" }];
    });
    toast.success(`${produto.nome} adicionado ao carrinho`);
  };

  const removerDoCarrinho = (produtoId: string) => {
    setCarrinho((prev) => {
      const existente = prev.find((item) => item.produto.id === produtoId);
      if (existente && existente.quantidade > 1) {
        return prev.map((item) =>
          item.produto.id === produtoId
            ? { ...item, quantidade: item.quantidade - 1 }
            : item
        );
      }
      return prev.filter((item) => item.produto.id !== produtoId);
    });
  };

  const atualizarObservacao = (produtoId: string, observacao: string) => {
    setCarrinho((prev) =>
      prev.map((item) =>
        item.produto.id === produtoId ? { ...item, observacao } : item
      )
    );
  };

  const totalCarrinho = carrinho.reduce(
    (total, item) => total + item.produto.preco_venda * item.quantidade,
    0
  );

  const quantidadeTotal = carrinho.reduce((total, item) => total + item.quantidade, 0);

  const enviarPedido = async () => {
    if (!dadosCliente.nome || !dadosCliente.whatsapp) {
      toast.error("Preencha seu nome e WhatsApp");
      return;
    }

    if (carrinho.length === 0) {
      toast.error("Adicione itens ao carrinho");
      return;
    }

    setEnviando(true);

    try {
      // Salvar pedido no banco
      const itensJson = carrinho.map((item) => ({
        produto_id: item.produto.id,
        nome: item.produto.nome,
        quantidade: item.quantidade,
        preco_unitario: item.produto.preco_venda,
        observacao: item.observacao,
      }));

      const { error: pedidoError } = await supabase.from("pedidos").insert({
        empresa_id: empresa!.id,
        itens: itensJson,
        valor_total: totalCarrinho,
        origem: "cardapio",
        status: "pendente",
        observacoes: `Cliente: ${dadosCliente.nome}\nWhatsApp: ${dadosCliente.whatsapp}\nEndereço: ${dadosCliente.endereco}\n\n${dadosCliente.observacoes}`,
        endereco_entrega: dadosCliente.endereco,
      });

      if (pedidoError) throw pedidoError;

      // Montar mensagem para WhatsApp
      const mensagem = montarMensagemWhatsApp();
      
      // Abrir WhatsApp com a mensagem
      if (empresa?.whatsapp_dono) {
        const numeroLimpo = empresa.whatsapp_dono.replace(/\D/g, "");
        const urlWhatsApp = `https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagem)}`;
        window.open(urlWhatsApp, "_blank");
      }

      toast.success("Pedido enviado com sucesso!");
      setCarrinho([]);
      setDadosCliente({ nome: "", whatsapp: "", endereco: "", observacoes: "" });
      setCarrinhoAberto(false);
    } catch (error) {
      console.error("Erro ao enviar pedido:", error);
      toast.error("Erro ao enviar pedido");
    } finally {
      setEnviando(false);
    }
  };

  const montarMensagemWhatsApp = () => {
    let mensagem = `🛒 *NOVO PEDIDO*\n\n`;
    mensagem += `👤 *Cliente:* ${dadosCliente.nome}\n`;
    mensagem += `📱 *WhatsApp:* ${dadosCliente.whatsapp}\n`;
    if (dadosCliente.endereco) {
      mensagem += `📍 *Endereço:* ${dadosCliente.endereco}\n`;
    }
    mensagem += `\n📋 *ITENS:*\n`;

    carrinho.forEach((item) => {
      mensagem += `\n• ${item.quantidade}x ${item.produto.nome} - ${formatCurrencyBRL(item.produto.preco_venda * item.quantidade)}`;
      if (item.observacao) {
        mensagem += `\n  _Obs: ${item.observacao}_`;
      }
    });

    mensagem += `\n\n💰 *TOTAL: ${formatCurrencyBRL(totalCarrinho)}*`;

    if (dadosCliente.observacoes) {
      mensagem += `\n\n📝 *Observações:* ${dadosCliente.observacoes}`;
    }

    return mensagem;
  };

  // Agrupar produtos por categoria
  const produtosPorCategoria = produtos.reduce((acc, produto) => {
    const categoria = produto.categoria || "Outros";
    if (!acc[categoria]) {
      acc[categoria] = [];
    }
    acc[categoria].push(produto);
    return acc;
  }, {} as Record<string, Produto[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Store className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Cardápio não encontrado</h1>
        <p className="text-muted-foreground text-center">
          Este cardápio não existe ou está temporariamente desativado.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold">{empresa.nome}</h1>
          {empresa.cardapio_descricao && (
            <p className="mt-2 text-primary-foreground/80">{empresa.cardapio_descricao}</p>
          )}
          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            {empresa.horario_funcionamento && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{empresa.horario_funcionamento}</span>
              </div>
            )}
            {empresa.whatsapp_dono && (
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                <span>{empresa.whatsapp_dono}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Produtos */}
      <div className="max-w-3xl mx-auto p-4">
        {Object.entries(produtosPorCategoria).map(([categoria, produtosCategoria]) => (
          <div key={categoria} className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4 sticky top-0 bg-background py-2 z-10">
              {categoria}
            </h2>
            <div className="grid gap-4">
              {produtosCategoria.map((produto) => {
                const itemCarrinho = carrinho.find((i) => i.produto.id === produto.id);
                return (
                  <Card key={produto.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex">
                        {produto.imagem_url && (
                          <div className="w-24 h-24 flex-shrink-0">
                            <img
                              src={produto.imagem_url}
                              alt={produto.nome}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 p-4 flex flex-col justify-between">
                          <div>
                            <h3 className="font-medium text-foreground">{produto.nome}</h3>
                            {produto.observacoes_ficha && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {produto.observacoes_ficha}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="font-semibold text-primary">
                              {formatCurrencyBRL(produto.preco_venda)}
                            </span>
                            {itemCarrinho ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8"
                                  onClick={() => removerDoCarrinho(produto.id)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-6 text-center font-medium">
                                  {itemCarrinho.quantidade}
                                </span>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8"
                                  onClick={() => adicionarAoCarrinho(produto)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => adicionarAoCarrinho(produto)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Adicionar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}

        {produtos.length === 0 && (
          <div className="text-center py-12">
            <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum produto disponível no momento.</p>
          </div>
        )}
      </div>

      {/* Botão flutuante do carrinho */}
      {carrinho.length > 0 && (
        <Sheet open={carrinhoAberto} onOpenChange={setCarrinhoAberto}>
          <SheetTrigger asChild>
            <Button
              className="fixed bottom-4 left-4 right-4 h-14 text-lg shadow-lg max-w-3xl mx-auto"
              size="lg"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Ver Carrinho ({quantidadeTotal})
              <span className="ml-auto">{formatCurrencyBRL(totalCarrinho)}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Seu Pedido
              </SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              {/* Itens do carrinho */}
              <div className="space-y-3">
                {carrinho.map((item) => (
                  <div key={item.produto.id} className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.produto.nome}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrencyBRL(item.produto.preco_venda)} cada
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => removerDoCarrinho(item.produto.id)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-6 text-center font-medium">{item.quantidade}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => adicionarAoCarrinho(item.produto)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <span className="w-20 text-right font-semibold">
                        {formatCurrencyBRL(item.produto.preco_venda * item.quantidade)}
                      </span>
                    </div>
                    <Input
                      placeholder="Observação do item (ex: sem cebola)"
                      value={item.observacao}
                      onChange={(e) => atualizarObservacao(item.produto.id, e.target.value)}
                      className="mt-2 text-sm"
                    />
                  </div>
                ))}
              </div>

              <Separator />

              {/* Total */}
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrencyBRL(totalCarrinho)}</span>
              </div>

              <Separator />

              {/* Dados do cliente */}
              <div className="space-y-4">
                <h4 className="font-semibold">Seus dados</h4>
                
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    placeholder="Seu nome"
                    value={dadosCliente.nome}
                    onChange={(e) => setDadosCliente({ ...dadosCliente, nome: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp *</Label>
                  <Input
                    id="whatsapp"
                    placeholder="(00) 00000-0000"
                    value={dadosCliente.whatsapp}
                    onChange={(e) => setDadosCliente({ ...dadosCliente, whatsapp: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endereco">Endereço de entrega</Label>
                  <Textarea
                    id="endereco"
                    placeholder="Rua, número, bairro..."
                    value={dadosCliente.endereco}
                    onChange={(e) => setDadosCliente({ ...dadosCliente, endereco: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações gerais</Label>
                  <Textarea
                    id="observacoes"
                    placeholder="Troco, horário preferido, etc."
                    value={dadosCliente.observacoes}
                    onChange={(e) => setDadosCliente({ ...dadosCliente, observacoes: e.target.value })}
                  />
                </div>
              </div>

              {/* Botão enviar */}
              <Button
                className="w-full h-14 text-lg"
                size="lg"
                onClick={enviarPedido}
                disabled={enviando || !dadosCliente.nome || !dadosCliente.whatsapp}
              >
                {enviando ? (
                  "Enviando..."
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    Enviar Pedido via WhatsApp
                  </>
                )}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
