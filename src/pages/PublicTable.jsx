import React, { useEffect, useMemo, useState } from "react";
import { getTabelaPublica } from "@/functions/getTabelaPublica";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Dumbbell, Printer, Search, MessageCircle, Globe } from "lucide-react";

// Item 022e (02/11/2026): tabela de atacado PÚBLICA da revenda (abre sem login).
// Os dados vêm da function getTabelaPublica, que só devolve o preço final de venda.
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pesoTxt = (p) => (p ? `${String(p).replace(".", ",")} kg` : "");
const soDigitos = (s) => String(s || "").replace(/\D/g, "");

export default function PublicTable() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const supplier = new URLSearchParams(window.location.search).get("supplier");
    if (!supplier) { setErro("Link inválido."); return; }
    getTabelaPublica({ supplier })
      .then((res) => {
        const d = res?.data || res;
        if (d?.error) setErro(d.error);
        else {
          setDados(d);
          // 022g: aba do navegador com o nome da empresa, em português
          if (d?.revenda?.empresa) document.title = `${d.revenda.empresa} — Tabela de atacado`;
        }
      })
      .catch(() => setErro("Não foi possível carregar a tabela agora. Tente de novo em instantes."));
  }, []);

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const itens = (dados?.itens || []).filter((i) =>
      !termo || `${i.nome} ${i.cod} ${i.categoria}`.toLowerCase().includes(termo));
    const mapa = new Map();
    for (const i of itens) {
      if (!mapa.has(i.categoria)) mapa.set(i.categoria, []);
      mapa.get(i.categoria).push(i);
    }
    return [...mapa.entries()];
  }, [dados, busca]);

  if (erro) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-sm text-center bg-white rounded-2xl border p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-slate-700">{erro}</p>
        </div>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <Dumbbell className="w-8 h-8 mx-auto mb-2 animate-pulse" />
          Carregando tabela...
        </div>
      </div>
    );
  }

  const r = dados.revenda || {};
  const wpp = soDigitos(r.whatsapp);
  const linkWpp = wpp ? `https://wa.me/${wpp.startsWith("55") ? wpp : "55" + wpp}?text=${encodeURIComponent("Olá! Vi a tabela de atacado e quero um orçamento.")}` : "";
  const total = (dados.itens || []).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } }`}</style>
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center gap-4">
          {r.logomarca ? (
            <img src={r.logomarca} alt={r.empresa} className="w-14 h-14 object-contain rounded-lg bg-white" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center"><Dumbbell className="w-7 h-7 text-slate-500" /></div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900 truncate">{r.empresa}</h1>
            <p className="text-sm text-slate-500">
              Tabela de atacado · atualizada em {new Date(dados.atualizado_em).toLocaleDateString("pt-BR")} · {total} produtos
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        <div className="no-print flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto ou código" className="pl-9 bg-white" />
          </div>
          {linkWpp && (
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <a href={linkWpp} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-4 h-4 mr-2" />Pedir orçamento</a>
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />Imprimir / PDF</Button>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          Para o orçamento com frete, envie pelo WhatsApp a lista dos itens com quantidades e o seu CNPJ (ou CPF).
        </div>

        {grupos.length === 0 && (
          <p className="text-center text-slate-500 py-10">Nenhum produto encontrado.</p>
        )}

        {grupos.map(([categoria, itens]) => (
          <section key={categoria} className="bg-white rounded-xl border overflow-hidden">
            <h2 className="px-4 py-3 bg-slate-100 font-semibold text-slate-800">{categoria} <span className="text-slate-500 font-normal">({itens.length})</span></h2>
            <ul className="divide-y">
              {itens.map((i) => (
                <li key={i.cod + i.nome} className="px-4 py-3 flex items-center gap-3">
                  {i.foto ? <img src={i.foto} alt="" loading="lazy" className="w-12 h-12 object-contain rounded bg-white shrink-0 no-print" /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{i.nome}</p>
                    <p className="text-xs text-slate-500">{[i.cod, i.und, pesoTxt(i.peso_kg)].filter(Boolean).join(" · ")}</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-700 whitespace-nowrap">{brl(i.preco)}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <footer className="text-center text-xs text-slate-500 py-6 space-y-1">
          <p>Preços por unidade indicada. Frete calculado no orçamento. Valores sujeitos a alteração sem aviso.</p>
          {r.site && <p><Globe className="inline w-3 h-3 mr-1" /><a className="underline" href={r.site} target="_blank" rel="noopener noreferrer">{r.site.replace(/https?:\/\//, "")}</a></p>}
          <p>Tabela gerada pelo PlaceFit</p>
        </footer>
      </main>
    </div>
  );
}
