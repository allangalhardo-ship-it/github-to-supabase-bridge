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
  OpcionalSelecionado,
  GrupoOpcional,
  CardapioHeader,
  CategoryTabs,
  ProductCard,
  ProductDetailModal,
  FloatingCartButton,
  SearchBar,
} from "@/components/cardapio";
import { CheckoutDrawer } from "@/components/cardapio/checkout";

// Simulated badges - in production, these would come from the database
function getBadgeForProduct(_produto: Produto, index: number): 'mais_vendido' | 'favorito' | 'novidade' | null {
  if (index === 0) return 'mais_vendido';
  if (index === 1) return 'favorito';
  if (index === 2) return 'novidade';
  return null;
}

/** Generate a unique key for a cart item based on product + selected options */
function gerarCarrinhoKey(produtoId: string, opcionais: OpcionalSelecionado[]): string {
  const opIds = opcionais.map(o => o.item_id).sort().join(',');
  return `${produtoId}__${opIds}`;
}

export default function Cardapio() {
  const { slug } = useParams<{ slug: string }>();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [produtoDetalhe, setProdutoDetalhe] = useState<Produto | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("");
  const [busca, setBusca] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

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

      // Load opcionais for all products
      const { data: gruposData } = await supabase
        .from("grupos_opcionais")
        .select("id, produto_id, nome, min_selecao, max_selecao, ordem")
        .eq("empresa_id", empresaData.id)
        .order("ordem");

      const grupoIds = (gruposData || []).map(g => g.id);
      
      let itensData: any[] = [];
      if (grupoIds.length > 0) {
        const { data } = await supabase
          .from("itens_opcionais")
          .select("id, grupo_id, nome, preco_adicional, ordem, ativo")
          .in("grupo_id", grupoIds)
          .eq("ativo", true)
          .order("ordem");
        itensData = data || [];
      }

      // Map opcionais to products
      const produtosComOpcionais: Produto[] = (produtosData || []).map(p => {
        const grupos = (gruposData || [])
          .filter(g => g.produto_id === p.id)
          .map(g => ({
            ...g,
            itens: itensData.filter(i => i.grupo_id === g.id),
          })) as GrupoOpcional[];
        
        return { ...p, grupos_opcionais: grupos };
      });

      setProdutos(produtosComOpcionais);
      
      if (produtosComOpcionais.length > 0) {
        const primeiraCategoria = produtosComOpcionais[0].categoria || "Outros";
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

    const agrupado = produtosFiltrados.reduce((acc, produto) => {
      const categoria = produto.categoria || "Outros";
      if (categoriasOcultas.includes(categoria)) return acc;
      if (!acc[categoria]) acc[categoria] = [];
      acc[categoria].push(produto);
      return acc;
    }, {} as Record<string, Produto[]>);

    const ordem = config?.categorias_ordem || [];
    const todasCategorias = Object.keys(agrupado);
    
    const categoriasOrdenadas = [
      ...ordem.filter((c) => todasCategorias.includes(c)),
      ...todasCategorias.filter((c) => !ordem.includes(c)).sort(),
    ];

    return { produtosPorCategoria: agrupado, categorias: categoriasOrdenadas };
  }, [produtosFiltrados, empresa?.cardapio_config]);

  useEffect(() => {
    if (categorias.length > 0 && !categorias.includes(categoriaAtiva)) {
      setCategoriaAtiva(categorias[0]);
    }
  }, [categorias, categoriaAtiva]);

  const handleCategoriaChange = useCallback((categoria: string) => {
    setCategoriaAtiva(categoria);
    const section = sectionRefs.current[categoria];
    if (section) {
      const offset = 140;
      const top = section.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, []);

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

  // Cart functions
  const adicionarAoCarrinho = (produto: Produto, quantidade: number = 1, observacao: string = "", opcionais: OpcionalSelecionado[] = []) => {
    const key = gerarCarrinhoKey(produto.id, opcionais);
    setCarrinho((prev) => {
      const existente = prev.find((item) => item.carrinhoKey === key);
      if (existente) {
        return prev.map((item) =>
          item.carrinhoKey === key
            ? { ...item, quantidade: item.quantidade + quantidade, observacao: observacao || item.observacao }
            : item
        );
      }
      return [...prev, { produto, quantidade, observacao, opcionais, carrinhoKey: key }];
    });
    toast.success(`${produto.nome} adicionado!`, { duration: 1500 });
  };

  const adicionarUm = (carrinhoKey: string) => {
    setCarrinho((prev) =>
      prev.map((item) =>
        item.carrinhoKey === carrinhoKey
          ? { ...item, quantidade: item.quantidade + 1 }
          : item
      )
    );
  };

  const removerUm = (carrinhoKey: string) => {
    setCarrinho((prev) => {
      const existente = prev.find((item) => item.carrinhoKey === carrinhoKey);
      if (existente && existente.quantidade > 1) {
        return prev.map((item) =>
          item.carrinhoKey === carrinhoKey
            ? { ...item, quantidade: item.quantidade - 1 }
            : item
        );
      }
      return prev.filter((item) => item.carrinhoKey !== carrinhoKey);
    });
  };

  const removerItem = (carrinhoKey: string) => {
    setCarrinho((prev) => prev.filter((item) => item.carrinhoKey !== carrinhoKey));
  };

  const totalCarrinho = carrinho.reduce((total, item) => {
    const totalOpcionais = item.opcionais.reduce((sum, op) => sum + op.preco_adicional, 0);
    return total + (item.produto.preco_venda + totalOpcionais) * item.quantidade;
  }, 0);

  const quantidadeTotal = carrinho.reduce((total, item) => total + item.quantidade, 0);

  const handlePedidoEnviado = () => {
    setCarrinho([]);
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
      <CardapioHeader empresa={empresa} />

      <SearchBar 
        value={busca} 
        onChange={setBusca} 
        totalResultados={busca ? produtosFiltrados.length : undefined} 
      />

      {!busca && (
        <CategoryTabs
          categorias={categorias}
          categoriaAtiva={categoriaAtiva}
          onCategoriaChange={handleCategoriaChange}
        />
      )}

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
                    onAddToCart={(p) => adicionarAoCarrinho(p, 1, "", [])}
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

      <ProductDetailModal
        produto={produtoDetalhe}
        open={!!produtoDetalhe}
        onClose={() => setProdutoDetalhe(null)}
        onAddToCart={adicionarAoCarrinho}
        quantidadeInicial={itemCarrinhoDetalhe?.quantidade || 1}
        observacaoInicial={itemCarrinhoDetalhe?.observacao || ""}
        opcionaisIniciais={itemCarrinhoDetalhe?.opcionais || []}
      />

      <FloatingCartButton
        quantidade={quantidadeTotal}
        total={totalCarrinho}
        onClick={() => setCarrinhoAberto(true)}
      />

      {empresa && (
        <CheckoutDrawer
          open={carrinhoAberto}
          onOpenChange={setCarrinhoAberto}
          carrinho={carrinho}
          empresa={empresa}
          onAddItem={adicionarUm}
          onRemoveItem={removerUm}
          onDeleteItem={removerItem}
          onPedidoEnviado={handlePedidoEnviado}
        />
      )}
    </div>
  );
}
