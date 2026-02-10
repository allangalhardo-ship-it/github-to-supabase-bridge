import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { formatCurrencyBRL } from "@/lib/format";
import {
  Produto,
  Empresa,
  CarrinhoItem,
  DadosCliente,
  CardapioHeader,
  CategoryTabs,
  ProductCard,
  ProductDetailModal,
  CartDrawer,
  FloatingCartButton,
  SearchBar,
} from "@/components/cardapio";

// Simulated badges - in production, these would come from the database
function getBadgeForProduct(produto: Produto, index: number): 'mais_vendido' | 'favorito' | 'novidade' | null {
  if (index === 0) return 'mais_vendido';
  if (index === 1) return 'favorito';
  if (index === 2) return 'novidade';
  return null;
}

export default function Cardapio() {
  const { slug } = useParams<{ slug: string }>();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [produtoDetalhe, setProdutoDetalhe] = useState<Produto | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("");
  const [busca, setBusca] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  
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
        .select("id, nome, cardapio_descricao, horario_funcionamento, whatsapp_dono, logo_url, banner_url, cardapio_config")
        .eq("slug", slug)
        .eq("cardapio_ativo", true)
        .single();

      if (empresaError || !empresaData) {
        toast.error("Cardápio não encontrado ou inativo");
        return;
      }

      // Parse cardapio_config safely
      const config = empresaData.cardapio_config as Empresa['cardapio_config'] ?? {};
      setEmpresa({ ...empresaData, cardapio_config: config });

      const { data: produtosData, error: produtosError } = await supabase
        .from("produtos")
        .select("id, nome, preco_venda, categoria, imagem_url, observacoes_ficha")
        .eq("empresa_id", empresaData.id)
        .eq("ativo", true)
        .order("categoria")
        .order("nome");

      if (produtosError) throw produtosError;

      setProdutos(produtosData || []);
      
      if (produtosData && produtosData.length > 0) {
        const primeiraCategoria = produtosData[0].categoria || "Outros";
        setCategoriaAtiva(primeiraCategoria);
      }
    } catch (error) {
      console.error("Erro ao carregar cardápio:", error);
      toast.error("Erro ao carregar cardápio");
    } finally {
      setLoading(false);
    }
  };

  // Filtrar produtos pela busca
  const produtosFiltrados = useMemo(() => {
    if (!busca.trim()) return produtos;
    const termo = busca.toLowerCase().trim();
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        (p.categoria && p.categoria.toLowerCase().includes(termo)) ||
        (p.observacoes_ficha && p.observacoes_ficha.toLowerCase().includes(termo))
    );
  }, [produtos, busca]);

  // Agrupar e ordenar categorias com config
  const { produtosPorCategoria, categorias } = useMemo(() => {
    const config = empresa?.cardapio_config;
    const categoriasOcultas = config?.categorias_ocultas || [];

    // Agrupar
    const agrupado = produtosFiltrados.reduce((acc, produto) => {
      const categoria = produto.categoria || "Outros";
      // Ocultar categorias configuradas
      if (categoriasOcultas.includes(categoria)) return acc;
      if (!acc[categoria]) acc[categoria] = [];
      acc[categoria].push(produto);
      return acc;
    }, {} as Record<string, Produto[]>);

    // Ordenar categorias
    const ordem = config?.categorias_ordem || [];
    const todasCategorias = Object.keys(agrupado);
    
    const categoriasOrdenadas = [
      ...ordem.filter((c) => todasCategorias.includes(c)),
      ...todasCategorias.filter((c) => !ordem.includes(c)).sort(),
    ];

    return { produtosPorCategoria: agrupado, categorias: categoriasOrdenadas };
  }, [produtosFiltrados, empresa?.cardapio_config]);

  // Set primeira categoria quando muda
  useEffect(() => {
    if (categorias.length > 0 && !categorias.includes(categoriaAtiva)) {
      setCategoriaAtiva(categorias[0]);
    }
  }, [categorias, categoriaAtiva]);

  // Scroll para categoria ao clicar na tab
  const handleCategoriaChange = useCallback((categoria: string) => {
    setCategoriaAtiva(categoria);
    const section = sectionRefs.current[categoria];
    if (section) {
      const offset = 140; // altura da barra de categorias + search
      const top = section.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

  // Detectar categoria visível ao scrollar
  useEffect(() => {
    const handleScroll = () => {
      for (const categoria of categorias) {
        const section = sectionRefs.current[categoria];
        if (section) {
          const { top, bottom } = section.getBoundingClientRect();
          if (top <= 160 && bottom > 160) {
            setCategoriaAtiva(categoria);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [categorias]);

  // Funções do carrinho
  const adicionarAoCarrinho = (produto: Produto, quantidade: number = 1, observacao: string = "") => {
    setCarrinho((prev) => {
      const existente = prev.find((item) => item.produto.id === produto.id);
      if (existente) {
        return prev.map((item) =>
          item.produto.id === produto.id
            ? { ...item, quantidade: item.quantidade + quantidade, observacao: observacao || item.observacao }
            : item
        );
      }
      return [...prev, { produto, quantidade, observacao }];
    });
    toast.success(`${produto.nome} adicionado!`, { duration: 1500 });
  };

  const adicionarUm = (produtoId: string) => {
    setCarrinho((prev) =>
      prev.map((item) =>
        item.produto.id === produtoId
          ? { ...item, quantidade: item.quantidade + 1 }
          : item
      )
    );
  };

  const removerUm = (produtoId: string) => {
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

  const removerItem = (produtoId: string) => {
    setCarrinho((prev) => prev.filter((item) => item.produto.id !== produtoId));
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-rose-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center p-4">
        <Store className="h-20 w-20 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Cardápio não encontrado</h1>
        <p className="text-gray-500 text-center max-w-md">
          Este cardápio não existe ou está temporariamente desativado.
        </p>
      </div>
    );
  }

  const itemCarrinhoDetalhe = produtoDetalhe 
    ? carrinho.find((item) => item.produto.id === produtoDetalhe.id) 
    : undefined;

  return (
    <div 
      className="min-h-screen overflow-auto"
      style={{ 
        backgroundColor: '#faf9f7',
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5e0d8' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}
    >
      {/* Header com banner */}
      <CardapioHeader empresa={empresa} />

      {/* Busca de produtos */}
      <SearchBar 
        value={busca} 
        onChange={setBusca} 
        totalResultados={busca ? produtosFiltrados.length : undefined} 
      />

      {/* Navegação por categorias */}
      {!busca && (
        <CategoryTabs
          categorias={categorias}
          categoriaAtiva={categoriaAtiva}
          onCategoriaChange={handleCategoriaChange}
        />
      )}

      {/* Produtos */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 pb-36">
        {categorias.map((categoria, catIndex) => (
          <section
            key={categoria}
            ref={(el) => { sectionRefs.current[categoria] = el; }}
            className={`mb-12 scroll-mt-36 py-8 px-4 md:px-6 rounded-3xl ${
              catIndex % 2 === 0 
                ? 'bg-white/60 backdrop-blur-sm' 
                : 'bg-gradient-to-br from-rose-50/50 to-orange-50/50'
            }`}
          >
            {/* Título da categoria com estilo decorativo */}
            <div className="text-center mb-8">
              <h2 
                className="text-2xl md:text-3xl font-bold text-gray-800 inline-block"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {categoria}
              </h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-rose-300" />
                <div className="w-2 h-2 rounded-full bg-rose-400" />
                <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-rose-300" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {produtosPorCategoria[categoria].map((produto, index) => {
                const itemCarrinho = carrinho.find((i) => i.produto.id === produto.id);
                const badge = catIndex === 0 ? getBadgeForProduct(produto, index) : null;
                
                return (
                  <ProductCard
                    key={produto.id}
                    produto={produto}
                    itemCarrinho={itemCarrinho}
                    onAddToCart={(p) => adicionarAoCarrinho(p, 1, "")}
                    onOpenDetails={setProdutoDetalhe}
                    badge={badge}
                    index={index}
                  />
                );
              })}
            </div>
          </section>
        ))}

        {produtosFiltrados.length === 0 && (
          <div className="text-center py-16">
            <Store className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {busca ? `Nenhum produto encontrado para "${busca}"` : "Nenhum produto disponível no momento."}
            </p>
          </div>
        )}
      </main>

      {/* Modal de detalhes do produto */}
      <ProductDetailModal
        produto={produtoDetalhe}
        open={!!produtoDetalhe}
        onClose={() => setProdutoDetalhe(null)}
        onAddToCart={adicionarAoCarrinho}
        quantidadeInicial={itemCarrinhoDetalhe?.quantidade || 1}
        observacaoInicial={itemCarrinhoDetalhe?.observacao || ""}
      />

      {/* Botão flutuante do carrinho */}
      <FloatingCartButton
        quantidade={quantidadeTotal}
        total={totalCarrinho}
        onClick={() => setCarrinhoAberto(true)}
      />

      {/* Drawer do carrinho */}
      <CartDrawer
        open={carrinhoAberto}
        onOpenChange={setCarrinhoAberto}
        carrinho={carrinho}
        dadosCliente={dadosCliente}
        onDadosClienteChange={setDadosCliente}
        onAddItem={adicionarUm}
        onRemoveItem={removerUm}
        onDeleteItem={removerItem}
        onEnviarPedido={enviarPedido}
        enviando={enviando}
      />
    </div>
  );
}
