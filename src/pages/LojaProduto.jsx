import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ShoppingCart, Store, Loader2, ArrowLeft, Package, Check } from "lucide-react";
import { getStoreData } from "@/functions/getStoreData";
import { getStoredCart, setStoredCart } from "@/lib/lojaCart";

const fmt = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function LojaProduto() {
  const { slug, cod } = useParams();
  const [config, setConfig] = useState(null);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selIdx, setSelIdx] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => { load(); }, [slug, cod]);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const preview = new URLSearchParams(window.location.search).get("preview") === "1";
      const res = await getStoreData({ slug, preview });
      const data = res.data || res;
      setConfig(data.config);
      const products = data.products || [];
      const g = products.find((p) => p.variacoes.some((v) => v.cod === cod));
      if (!g) { setError("Produto não encontrado"); setLoading(false); return; }
      setGroup(g);
      const idx = g.variacoes.findIndex((v) => v.cod === cod);
      setSelIdx(idx >= 0 ? idx : 0);
    } catch (e) {
      setError(e?.response?.data?.error || "Produto não encontrado");
    }
    setLoading(false);
  };

  const primary = config?.cor_primaria || "#1e40af";
  const sel = group?.variacoes[selIdx];

  const addToCart = () => {
    if (!sel) return;
    const cart = getStoredCart(slug);
    const ex = cart.find((i) => i.sp_id === sel.sp_id);
    let updated;
    if (ex) {
      updated = cart.map((i) => i.sp_id === sel.sp_id ? { ...i, quantidade: i.quantidade + 1 } : i);
    } else {
      updated = [...cart, {
        sp_id: sel.sp_id,
        product: {
          id: sel.sp_id, sp_id: sel.sp_id, product_id: sel.product_id,
          nome: sel.nome, preco: sel.preco, foto: group.foto, und: group.und, peso_kg: sel.peso_kg,
        },
        quantidade: 1,
      }];
    }
    setStoredCart(slug, updated);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" style={{ color: primary }} /></div>;
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50">
      <Package className="w-12 h-12 text-gray-300" />
      <p className="text-gray-500">{error}</p>
      <Link to={`/loja/${slug}`} className="text-sm font-medium" style={{ color: primary }}>Voltar para a loja</Link>
    </div>
  );
  if (!config || !group) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="shadow-sm" style={{ backgroundColor: primary }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to={`/loja/${slug}`} className="flex items-center gap-2 text-white">
            {config.logo_url ? <img src={config.logo_url} className="h-8 w-8 rounded-lg object-cover" alt={config.nome_loja} /> : <Store className="w-6 h-6" />}
            <span className="font-semibold hidden sm:block">{config.nome_loja}</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Link to={`/loja/${slug}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar para a loja
        </Link>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="aspect-square bg-white rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden">
            {group.foto ? <img src={group.foto} alt={group.nome} className="w-full h-full object-cover" /> : <Package className="w-24 h-24 text-gray-300" />}
          </div>

          <div className="flex flex-col">
            <p className="text-xs uppercase text-gray-400">{group.categoria}</p>
            <h1 className="font-bold text-xl text-gray-900 leading-tight mt-1">{group.nome}</h1>

            {group.tem_pesos && (
              <p className="text-sm text-gray-500 mt-1">a partir de <span className="font-bold text-lg" style={{ color: primary }}>R$ {fmt(group.preco_por_kg)}/kg</span></p>
            )}

            {group.variacoes.length > 1 && (
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-700">Variação</label>
                <select value={selIdx} onChange={(e) => setSelIdx(Number(e.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                  {group.variacoes.map((v, i) => (
                    <option key={v.sp_id} value={i}>{v.peso_kg ? v.peso_kg + ' kg' : v.nome} — R$ {fmt(v.preco)}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-bold text-3xl" style={{ color: primary }}>R$ {fmt(sel.preco)}</span>
              {group.und && <span className="text-sm text-gray-400">/ {group.und}</span>}
            </div>

            <button onClick={addToCart} className="mt-6 w-full text-white font-semibold py-3 rounded-xl shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2" style={{ backgroundColor: primary }}>
              {added ? <><Check className="w-5 h-5" /> Adicionado!</> : <><ShoppingCart className="w-5 h-5" /> Adicionar ao carrinho</>}
            </button>

            {group.descricao && (
              <div className="mt-6">
                <h2 className="font-semibold text-gray-900 mb-2">Descrição</h2>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{group.descricao}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}