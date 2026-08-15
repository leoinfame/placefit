import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { ShoppingCart, Search, Loader2, Store, MessageCircle, User } from "lucide-react";
import { Link } from "react-router-dom";
import { getStoreData } from "@/functions/getStoreData";
import { getSession, clearSession } from "@/lib/lojaSession";
import LojaProductCard from "@/components/loja/LojaProductCard";
import LojaCart from "@/components/loja/LojaCart";
import LojaCheckout from "@/components/loja/LojaCheckout";

export default function LojaPublica() {
  const { slug } = useParams();
  const [config, setConfig] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("Todos");
  const [sessao, setSessao] = useState(null);

  const isEmbedded = typeof window !== "undefined" && window.self !== window.top;

  useEffect(() => { load(); refreshSessao(); }, [slug]);
  useEffect(() => { refreshSessao(); }, [checkoutOpen]);

  const refreshSessao = () => setSessao(getSession(slug));
  const logout = () => { clearSession(slug); setSessao(null); };

  const load = async () => {
    setLoading(true); setError("");
    try {
      const preview = new URLSearchParams(window.location.search).get("preview") === "1";
      const res = await getStoreData({ slug, preview });
      const data = res.data || res;
      setConfig(data.config);
      setProducts(data.products || []);
    } catch (e) {
      setError(e?.response?.data?.error || "Loja não encontrada");
    }
    setLoading(false);
  };

  const primary = config?.cor_primaria || "#1e40af";

  const addToCart = (product) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.sp_id === product.id);
      if (ex) return prev.map((i) => (i.sp_id === product.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      return [...prev, { sp_id: product.id, product, quantidade: 1 }];
    });
    setCartOpen(true);
  };
  const inc = (id) => setCart((p) => p.map((i) => (i.sp_id === id ? { ...i, quantidade: i.quantidade + 1 } : i)));
  const dec = (id) => setCart((p) => p.flatMap((i) => (i.sp_id === id ? (i.quantidade > 1 ? [{ ...i, quantidade: i.quantidade - 1 }] : []) : [i])));
  const remove = (id) => setCart((p) => p.filter((i) => i.sp_id !== id));

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.product.preco * i.quantidade, 0), [cart]);
  // Frete calculado no checkout pela tabela MuscularFit (estado + peso). Sem frete gratis.

  const categorias = useMemo(() => {
    const set = new Set(products.map((p) => p.categoria).filter(Boolean));
    return ["Todos", ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return products.filter((p) => {
      const okCat = categoria === "Todos" || p.categoria === categoria;
      const okSearch = !s || (p.nome || "").toLowerCase().includes(s) || (p.categoria || "").toLowerCase().includes(s);
      return okCat && okSearch;
    });
  }, [products, search, categoria]);

  // Reporta a altura real do conteúdo ao site que embutiu esta loja via iframe,
  // para que o iframe possa crescer/encolher sem barra de rolagem interna.
  useEffect(() => {
    if (!isEmbedded) return;
    // Oculta a barra de rolagem vertical dentro do iframe: o pai rola a página.
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    let raf = null;
    const postHeight = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = document.documentElement.scrollHeight;
        window.parent.postMessage({ type: "placefit-loja-resize", slug, height: h }, "*");
      });
    };
    const ro = new ResizeObserver(postHeight);
    ro.observe(document.documentElement);
    postHeight();
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [isEmbedded, loading, filtered.length, slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: primary }} /></div>;
  if (error) return <div className="min-h-screen flex flex-col items-center justify-center gap-3"><Store className="w-12 h-12 text-gray-300" /><p className="text-gray-500">{error}</p></div>;
  if (!config) return null;

  return (
    <div className={isEmbedded ? "bg-gray-50" : "min-h-screen bg-gray-50"}>
      <header className="shadow-sm" style={{ backgroundColor: primary }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          {config.logo_url ? <img src={config.logo_url} className="h-10 w-10 rounded-lg object-cover" alt={config.nome_loja} /> : <Store className="w-8 h-8 text-white" />}
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-lg leading-tight truncate">{config.nome_loja}</h1>
            {config.descricao && <p className="text-white/80 text-xs truncate">{config.descricao}</p>}
          </div>
          <div className="relative hidden sm:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produtos..." className="pl-9 pr-3 py-2 rounded-lg text-sm w-56" />
          </div>
          {sessao ? (
            <div className="flex items-center gap-2">
              <Link to={`/loja/${slug}/conta`} className="text-white text-sm font-medium hidden sm:flex items-center gap-1" title={sessao.cliente.nome}>
                <User className="w-5 h-5" /> <span className="max-w-24 truncate">Olá, {sessao.cliente.nome?.split(" ")[0]}</span>
              </Link>
              <button onClick={logout} className="text-white/70 hover:text-white text-xs hidden sm:block">Sair</button>
            </div>
          ) : (
            <Link to={`/loja/${slug}/conta`} className="text-white text-sm font-medium flex items-center gap-1" title="Entrar / Criar conta">
              <User className="w-5 h-5" /> <span className="hidden sm:inline">Entrar</span>
            </Link>
          )}
          <button onClick={() => setCartOpen(true)} className="relative text-white p-2">
            <ShoppingCart className="w-6 h-6" />
            {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-white text-xs font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center" style={{ color: primary }}>{cart.reduce((s, i) => s + i.quantidade, 0)}</span>}
          </button>
        </div>
        <div className="sm:hidden px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produtos..." className="pl-9 pr-3 py-2 rounded-lg text-sm w-full" />
          </div>
        </div>
      </header>

      {config.banner_url && <div className="max-w-6xl mx-auto px-4 mt-4"><img src={config.banner_url} className="w-full h-40 sm:h-56 object-cover rounded-xl" alt="banner" /></div>}

      <main className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="font-bold text-gray-900 mb-3">Produtos</h2>
        {categorias.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-3 mb-2 -mx-1 px-1">
            {categorias.map((c) => (
              <button key={c} onClick={() => setCategoria(c)} className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap font-medium transition-colors ${categoria === c ? "text-white" : "bg-white border text-gray-600 hover:bg-gray-100"}`} style={categoria === c ? { backgroundColor: primary } : {}}>
                {c}
              </button>
            ))}
          </div>
        )}
        {filtered.length === 0 ? (
          <p className="text-gray-400 text-center py-20">Nenhum produto encontrado.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((p) => <LojaProductCard key={p.id} group={p} onAdd={addToCart} primaryColor={primary} />)}
          </div>
        )}
      </main>

      <footer className="border-t mt-8 py-6 text-center text-xs text-gray-400">
        <p>Powered by PlaceFit</p>
        {config.whatsapp_contato && <p className="flex items-center justify-center gap-1 mt-1"><MessageCircle className="w-3 h-3" /> {config.whatsapp_contato}</p>}
      </footer>

      <LojaCart open={cartOpen} onClose={() => setCartOpen(false)} items={cart} onInc={inc} onDec={dec} onRemove={remove} subtotal={subtotal} frete={null} total={subtotal} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} primaryColor={primary} />
      <LojaCheckout open={checkoutOpen} onClose={() => setCheckoutOpen(false)} config={config} cart={cart} subtotal={subtotal} primaryColor={primary} sessao={sessao} slug={slug} onLogin={() => setCheckoutOpen(false)} onOrdered={refreshSessao} onClear={() => setCart([])} />
    </div>
  );
}