import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Store } from "lucide-react";
import { Empresa, Produto, CarrinhoItem, OpcionalSelecionado, GrupoOpcional, CardapioHeader, CategoryTabs, ProductCard, ProductDetailModal, FloatingCartButton, SearchBar } from "@/components/cardapio";
import { CheckoutDrawer } from "@/components/cardapio/checkout";

function gerarCarrinhoKey(produtoId: string, opcionais: OpcionalSelecionado[]): string {
  return `${produtoId}__${opcionais.map(o => o.item_id).sort().join(",")}`;
}

export default function Cardapio() {
  const { slug } = useParams<{ slug: string }>();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [produtoDetalhe, setProdutoDetalhe] = useState<Produto | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState("");
  const [busca, setBusca] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => { if (slug) carregarCardapio(); }, [slug]);

  const carregarCardapio = async () => {
    try {
      const { data: emp, error: empErr } = await supabase.from("empresas")
        .select("id, nome, cardapio_descricao, horario_funcionamento, whatsapp_dono, logo_url, banner_url, cardapio_config, slug, chave_pix, entrega_ativa, pedido_minimo, tempo_estimado_entrega")
        .eq("slug", slug).eq("cardapio_ativo", true).single();
      if (empErr || !emp) { toast.error("Cardápio não encontrado"); return; }
      const config = (emp.cardapio_config as any) ?? {};
      setEmpresa({ ...emp, cardapio_config: config } as Empresa);

      const { data: prods } = await supabase.from("produtos")
        .select("id, nome, preco_venda, categoria, imagem_url, observacoes_ficha, descricao_cardapio, destaque")
        .eq("empresa_id", emp.id).eq("ativo", true).order("categoria").order("nome");

      const { data: grupos } = await supabase.from("grupos_opcionais")
        .select("id, produto_id, nome, min_selecao, max_selecao, ordem").eq("empresa_id", emp.id).order("ordem");
      const grupoIds = (grupos || []).map(g => g.id);
      let itens: any[] = [];
      if (grupoIds.length > 0) {
        const { data } = await supabase.from("itens_opcionais")
          .select("id, grupo_id, nome, preco_adicional, ordem, ativo").in("grupo_id", grupoIds).eq("ativo", true).order("ordem");
        itens = data || [];
      }
      const produtosCompletos: Produto[] = (prods || []).map(p => ({
        ...p, grupos_opcionais: (grupos || []).filter(g => g.produto_id === p.id)
          .map(g => ({ ...g, itens: itens.filter(i => i.grupo_id === g.id) })) as GrupoOpcional[],
      }));
      setProdutos(produtosCompletos);
      if (produtosCompletos.length > 0) setCategoriaAtiva(produtosCompletos[0].categoria || "Outros");
    } catch (e) { console.error(e); toast.error("Erro ao carregar cardápio"); }
    finally { setLoading(false); }
  };

  const produtosFiltrados = useMemo(() => {
    if (!busca.trim()) return produtos;
    const t = busca.toLowerCase();
    return produtos.filter(p => p.nome.toLowerCase().includes(t) || p.categoria?.toLowerCase().includes(t) || p.descricao_cardapio?.toLowerCase().includes(t));
  }, [produtos, busca]);

  const { produtosPorCategoria, categorias } = useMemo(() => {
    const config = empresa?.cardapio_config;
    const ocultas = config?.categorias_ocultas || [];
    const agrupado = produtosFiltrados.reduce((acc, p) => {
      const cat = p.categoria || "Outros";
      if (ocultas.includes(cat)) return acc;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {} as Record<string, Produto[]>);
    const ordem = config?.categorias_ordem || [];
    const todas = Object.keys(agrupado);
    const ordenadas = [...ordem.filter(c => todas.includes(c)), ...todas.filter(c => !ordem.includes(c)).sort()];
    return { produtosPorCategoria: agrupado, categorias: ordenadas };
  }, [produtosFiltrados, empresa?.cardapio_config]);

  useEffect(() => { if (categorias.length > 0 && !categorias.includes(categoriaAtiva)) setCategoriaAtiva(categorias[0]); }, [categorias]);

  const handleCategoriaChange = useCallback((cat: string) => {
    setCategoriaAtiva(cat);
    const s = sectionRefs.current[cat];
    if (s) { window.scrollTo({ top: s.getBoundingClientRect().top + window.scrollY - 140, behavior: "smooth" }); }
  }, []);

  const adicionarAoCarrinho = (produto: Produto, qtd: number = 1, obs: string = "", opcionais: OpcionalSelecionado[] = []) => {
    const key = gerarCarrinhoKey(produto.id, opcionais);
    setCarrinho(prev => {
      const ex = prev.find(i => i.carrinhoKey === key);
      if (ex) return prev.map(i => i.carrinhoKey === key ? { ...i, quantidade: i.quantidade + qtd, observacao: obs || i.observacao } : i);
      return [...prev, { produto, quantidade: qtd, observacao: obs, opcionais, carrinhoKey: key }];
    });
    toast.success(`${produto.nome} adicionado!`, { duration: 1500 });
  };

  const adicionarUm = (key: string) => setCarrinho(prev => prev.map(i => i.carrinhoKey === key ? { ...i, quantidade: i.quantidade + 1 } : i));
  const removerUm = (key: string) => setCarrinho(prev => { const ex = prev.find(i => i.carrinhoKey === key); if (ex && ex.quantidade > 1) return prev.map(i => i.carrinhoKey === key ? { ...i, quantidade: i.quantidade - 1 } : i); return prev.filter(i => i.carrinhoKey !== key); });
  const removerItem = (key: string) => setCarrinho(prev => prev.filter(i => i.carrinhoKey !== key));

  const totalCarrinho = carrinho.reduce((t, i) => t + (i.produto.preco_venda + i.opcionais.reduce((s, o) => s + o.preco_adicional, 0)) * i.quantidade, 0);
  const quantidadeTotal = carrinho.reduce((t, i) => t + i.quantidade, 0);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center" style={{ overflow: 'auto' }}><div className="animate-spin rounded-full h-10 w-10 border-4 border-red-500 border-t-transparent" /></div>;
  if (!empresa) return <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4" style={{ overflow: 'auto' }}><Store className="h-16 w-16 text-gray-300 mb-4" /><h1 className="text-xl font-bold text-gray-700">Cardápio não encontrado</h1><p className="text-gray-400 mt-2 text-sm">Verifique o link e tente novamente</p></div>;

  return (
    <div className="min-h-screen bg-gray-50" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <CardapioHeader empresa={empresa} />
      <SearchBar value={busca} onChange={setBusca} totalResultados={busca ? produtosFiltrados.length : undefined} />
      {!busca && <CategoryTabs categorias={categorias} categoriaAtiva={categoriaAtiva} onCategoriaChange={handleCategoriaChange} />}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-32 space-y-8">
        {categorias.map(cat => (
          <section key={cat} ref={el => { sectionRefs.current[cat] = el; }} className="scroll-mt-36">
            <h2 className="text-lg font-bold text-gray-800 mb-3 px-1">{cat}</h2>
            <div className="space-y-3">
              {produtosPorCategoria[cat].map((p, i) => (
                <ProductCard key={p.id} produto={p} onOpenDetails={setProdutoDetalhe} index={i} />
              ))}
            </div>
          </section>
        ))}
        {produtosFiltrados.length === 0 && <div className="text-center py-16"><Store className="h-16 w-16 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">{busca ? `Nenhum resultado para "${busca}"` : "Nenhum produto disponível"}</p></div>}
      </main>
      <ProductDetailModal produto={produtoDetalhe} open={!!produtoDetalhe} onClose={() => setProdutoDetalhe(null)} onAddToCart={adicionarAoCarrinho} />
      <FloatingCartButton quantidade={quantidadeTotal} total={totalCarrinho} onClick={() => setCarrinhoAberto(true)} />
      {empresa && <CheckoutDrawer open={carrinhoAberto} onOpenChange={setCarrinhoAberto} carrinho={carrinho} empresa={empresa} onAddItem={adicionarUm} onRemoveItem={removerUm} onDeleteItem={removerItem} onPedidoEnviado={() => setCarrinho([])} />}
    </div>
  );
}
