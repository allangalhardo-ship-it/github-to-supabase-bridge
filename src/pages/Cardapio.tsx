import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, Send, Store, Clock, Phone, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    toast.success(`${produto.nome} adicionado!`, { duration: 1500 });
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

  const removerItemCompleto = (produtoId: string) => {
    setCarrinho((prev) => prev.filter((item) => item.produto.id !== produtoId));
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

      const mensagem = montarMensagemWhatsApp();
      
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
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-4">
        <Store className="h-20 w-20 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Cardápio não encontrado</h1>
        <p className="text-gray-500 text-center max-w-md">
          Este cardápio não existe ou está temporariamente desativado.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white overflow-auto">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-5">
          <h1 className="text-2xl md:text-3xl font-bold">{empresa.nome}</h1>
          {empresa.cardapio_descricao && (
            <p className="mt-1 text-green-100 text-sm md:text-base">{empresa.cardapio_descricao}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-green-100">
            {empresa.horario_funcionamento && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {empresa.horario_funcionamento}
              </span>
            )}
            {empresa.whatsapp_dono && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4" />
                {empresa.whatsapp_dono}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Produtos */}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-32">
        {Object.entries(produtosPorCategoria).map(([categoria, produtosCategoria]) => (
          <section key={categoria} className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b-2 border-green-500 inline-block">
              {categoria}
            </h2>
            <div className="space-y-3">
              {produtosCategoria.map((produto) => {
                const itemCarrinho = carrinho.find((i) => i.produto.id === produto.id);
                return (
                  <Card 
                    key={produto.id} 
                    className="overflow-hidden hover:shadow-md transition-shadow border-gray-100"
                  >
                    <CardContent className="p-0">
                      <div className="flex">
                        {produto.imagem_url && (
                          <div className="w-24 h-24 md:w-28 md:h-28 flex-shrink-0 bg-gray-100">
                            <img
                              src={produto.imagem_url}
                              alt={produto.nome}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 p-3 md:p-4 flex flex-col justify-between min-w-0">
                          <div>
                            <h3 className="font-semibold text-gray-800 truncate">{produto.nome}</h3>
                            {produto.observacoes_ficha && (
                              <p className="text-xs md:text-sm text-gray-500 line-clamp-2 mt-0.5">
                                {produto.observacoes_ficha}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2 gap-2">
                            <span className="font-bold text-green-600 text-lg">
                              {formatCurrencyBRL(produto.preco_venda)}
                            </span>
                            {itemCarrinho ? (
                              <div className="flex items-center gap-1 bg-green-50 rounded-full p-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full text-green-700 hover:bg-green-100"
                                  onClick={() => removerDoCarrinho(produto.id)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <span className="w-8 text-center font-bold text-green-700">
                                  {itemCarrinho.quantidade}
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full text-green-700 hover:bg-green-100"
                                  onClick={() => adicionarAoCarrinho(produto)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white rounded-full px-4"
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
          </section>
        ))}

        {produtos.length === 0 && (
          <div className="text-center py-16">
            <Store className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Nenhum produto disponível no momento.</p>
          </div>
        )}
      </main>

      {/* Botão flutuante do carrinho - SEMPRE VISÍVEL */}
      <Sheet open={carrinhoAberto} onOpenChange={setCarrinhoAberto}>
        <SheetTrigger asChild>
          <Button
            className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-xl bg-green-600 hover:bg-green-700 text-white z-30"
            size="icon"
          >
            <div className="relative">
              <ShoppingCart className="h-7 w-7" />
              {quantidadeTotal > 0 && (
                <Badge className="absolute -top-3 -right-3 h-6 w-6 rounded-full p-0 flex items-center justify-center bg-red-500 text-white text-xs border-2 border-white">
                  {quantidadeTotal}
                </Badge>
              )}
            </div>
          </Button>
        </SheetTrigger>
        
        {/* Barra fixa com total - só aparece com itens */}
        {quantidadeTotal > 0 && !carrinhoAberto && (
          <div 
            className="fixed bottom-6 left-4 right-24 bg-green-600 text-white rounded-full shadow-xl py-3 px-5 flex items-center justify-between cursor-pointer hover:bg-green-700 transition-colors z-30"
            onClick={() => setCarrinhoAberto(true)}
          >
            <span className="font-medium">
              {quantidadeTotal} {quantidadeTotal === 1 ? 'item' : 'itens'}
            </span>
            <span className="font-bold text-lg">{formatCurrencyBRL(totalCarrinho)}</span>
          </div>
        )}

        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="px-5 py-4 border-b">
              <SheetTitle className="flex items-center gap-2 text-xl">
                <ShoppingCart className="h-6 w-6 text-green-600" />
                Seu Pedido
                {quantidadeTotal > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {quantidadeTotal} {quantidadeTotal === 1 ? 'item' : 'itens'}
                  </Badge>
                )}
              </SheetTitle>
            </SheetHeader>

            {carrinho.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
                <ShoppingCart className="h-20 w-20 mb-4 opacity-30" />
                <p className="text-lg font-medium">Seu carrinho está vazio</p>
                <p className="text-sm mt-1">Adicione produtos para fazer seu pedido</p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="px-5 py-4 space-y-4">
                  {/* Itens do carrinho */}
                  <div className="space-y-3">
                    {carrinho.map((item) => (
                      <div key={item.produto.id} className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-800 truncate">{item.produto.nome}</h4>
                            <p className="text-sm text-gray-500">
                              {formatCurrencyBRL(item.produto.preco_venda)} cada
                            </p>
                          </div>
                          <div className="flex items-center gap-1 bg-white rounded-full shadow-sm p-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-full"
                              onClick={() => removerDoCarrinho(item.produto.id)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center font-bold text-sm">{item.quantidade}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 rounded-full"
                              onClick={() => adicionarAoCarrinho(item.produto)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-green-600">
                              {formatCurrencyBRL(item.produto.preco_venda * item.quantidade)}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 ml-1"
                              onClick={() => removerItemCompleto(item.produto.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <Input
                          placeholder="Alguma observação? (ex: sem cebola)"
                          value={item.observacao}
                          onChange={(e) => atualizarObservacao(item.produto.id, e.target.value)}
                          className="mt-3 text-sm bg-white"
                        />
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />

                  {/* Total */}
                  <div className="flex items-center justify-between text-xl font-bold bg-green-50 rounded-xl p-4">
                    <span className="text-gray-700">Total</span>
                    <span className="text-green-600">{formatCurrencyBRL(totalCarrinho)}</span>
                  </div>

                  <Separator className="my-4" />

                  {/* Dados do cliente */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-800 text-lg">Seus dados para entrega</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome" className="text-gray-700">Nome *</Label>
                        <Input
                          id="nome"
                          placeholder="Seu nome completo"
                          value={dadosCliente.nome}
                          onChange={(e) => setDadosCliente({ ...dadosCliente, nome: e.target.value })}
                          className="bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="whatsapp" className="text-gray-700">WhatsApp *</Label>
                        <Input
                          id="whatsapp"
                          placeholder="(00) 00000-0000"
                          value={dadosCliente.whatsapp}
                          onChange={(e) => setDadosCliente({ ...dadosCliente, whatsapp: e.target.value })}
                          className="bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="endereco" className="text-gray-700">Endereço de entrega</Label>
                      <Textarea
                        id="endereco"
                        placeholder="Rua, número, bairro, ponto de referência..."
                        value={dadosCliente.endereco}
                        onChange={(e) => setDadosCliente({ ...dadosCliente, endereco: e.target.value })}
                        className="bg-white resize-none"
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="observacoes" className="text-gray-700">Observações gerais</Label>
                      <Textarea
                        id="observacoes"
                        placeholder="Precisa de troco? Horário preferido?"
                        value={dadosCliente.observacoes}
                        onChange={(e) => setDadosCliente({ ...dadosCliente, observacoes: e.target.value })}
                        className="bg-white resize-none"
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Botão enviar */}
                  <Button
                    className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 rounded-xl shadow-lg mt-4"
                    size="lg"
                    onClick={enviarPedido}
                    disabled={enviando || !dadosCliente.nome || !dadosCliente.whatsapp}
                  >
                    {enviando ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Enviando...
                      </span>
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Enviar Pedido via WhatsApp
                      </>
                    )}
                  </Button>

                  <p className="text-center text-xs text-gray-400 mt-2 pb-4">
                    Ao enviar, você será redirecionado para o WhatsApp
                  </p>
                </div>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
