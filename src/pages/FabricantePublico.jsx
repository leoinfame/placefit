import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Building2, CalendarDays, ExternalLink, Factory, Globe2, MapPin, PackageCheck, ShieldCheck, Sparkles } from "lucide-react";

const PLACEFIT = "https://app.placefit.com.br";

function setMeta(name, content, property = false) {
  if (!content) return;
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(property ? "property" : "name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function PublicSeo({ perfil }) {
  useEffect(() => {
    if (!perfil) return;
    const canonicalUrl = `${PLACEFIT}/fabricantes/${perfil.slug}`;
    document.title = perfil.seo_title || `${perfil.nome} | Fabricante Fitness | PlaceFit`;
    setMeta("description", perfil.seo_description || perfil.resumo);
    setMeta("robots", "index,follow,max-image-preview:large");
    setMeta("og:type", "profile", true);
    setMeta("og:title", document.title, true);
    setMeta("og:description", perfil.seo_description || perfil.resumo, true);
    setMeta("og:url", canonicalUrl, true);
    setMeta("og:site_name", "PlaceFit", true);
    setMeta("og:image", perfil.logo_url || `${PLACEFIT}/cpfit-logo.svg`, true);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    const orgId = `${canonicalUrl}#organization`;
    const sameAs = [perfil.site, perfil.instagram].filter(Boolean);
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "ProfilePage",
          "@id": `${canonicalUrl}#webpage`,
          url: canonicalUrl,
          name: document.title,
          description: perfil.seo_description || perfil.resumo,
          inLanguage: "pt-BR",
          mainEntity: { "@id": orgId },
          isPartOf: { "@id": `${PLACEFIT}/#website` }
        },
        {
          "@type": "Organization",
          "@id": orgId,
          name: perfil.nome,
          legalName: perfil.razao_social || undefined,
          url: canonicalUrl,
          foundingDate: perfil.data_fundacao || undefined,
          taxID: perfil.cnpj || undefined,
          description: perfil.resumo,
          logo: perfil.logo_url || undefined,
          image: perfil.logo_url || undefined,
          sameAs,
          address: perfil.cidade ? {
            "@type": "PostalAddress",
            addressLocality: perfil.cidade,
            addressRegion: perfil.estado,
            addressCountry: "BR"
          } : undefined,
          employee: perfil.responsavel_nome ? {
            "@type": "Person",
            name: perfil.responsavel_nome,
            jobTitle: perfil.responsavel_cargo || undefined
          } : undefined,
          knowsAbout: perfil.capacidades || undefined,
          subjectOf: (perfil.fontes_externas || []).map(f => ({
            "@type": f.tipo === "video" ? "VideoObject" : "Article",
            name: f.titulo,
            url: f.url,
            publisher: f.veiculo ? { "@type": "Organization", name: f.veiculo } : undefined
          }))
        },
        ...((perfil.produtos_destaque || []).map((p, index) => ({
          "@type": "Product",
          "@id": `${canonicalUrl}#produto-${index + 1}`,
          name: p.nome,
          description: p.descricao,
          category: p.categoria,
          brand: { "@id": orgId },
          manufacturer: { "@id": orgId }
        }))),
        {
          "@type": "WebSite",
          "@id": `${PLACEFIT}/#website`,
          url: `${PLACEFIT}/`,
          name: "PlaceFit",
          inLanguage: "pt-BR"
        }
      ]
    };
    let script = document.getElementById("fabricante-publico-jsonld");
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "fabricante-publico-jsonld";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);
    return () => { script?.remove(); };
  }, [perfil]);
  return null;
}

export default function FabricantePublico() {
  const { slug } = useParams();
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await base44.entities.FabricantePerfilPublico.filter({ slug, publicado: true });
        if (active) setPerfil(rows?.[0] || null);
      } catch (e) {
        console.error("Erro ao carregar perfil público do fabricante", e);
        if (active) setPerfil(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug]);

  const ano = useMemo(() => perfil?.data_fundacao?.slice(0, 4), [perfil]);

  if (loading) return <div className="min-h-screen grid place-items-center bg-[#f7f7f5]"><div className="animate-pulse text-neutral-500">Carregando fabricante...</div></div>;
  if (!perfil) return <div className="min-h-screen grid place-items-center bg-[#f7f7f5] p-6"><div className="max-w-lg text-center"><div className="text-7xl font-black text-neutral-200">404</div><h1 className="mt-4 text-2xl font-bold">Fabricante não encontrado</h1><p className="mt-2 text-neutral-600">Este perfil não existe ou ainda não foi publicado pela PlaceFit.</p><Link to="/Marketplace" className="inline-flex mt-6 items-center gap-2 rounded-full bg-black px-5 py-3 text-white"><ArrowLeft className="w-4 h-4"/> Marketplace</Link></div></div>;

  return <>
    <PublicSeo perfil={perfil} />
    <div className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <header className="border-b border-neutral-200 bg-white/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link to="/" className="font-black tracking-tight text-xl">PLACE<span className="text-green-600">FIT</span></Link>
          <Link to="/Marketplace" className="text-sm font-medium text-neutral-600 hover:text-black">Marketplace</Link>
        </div>
      </header>

      <main>
        <section className="bg-neutral-950 text-white">
          <div className="max-w-6xl mx-auto px-5 py-16 md:py-24 grid md:grid-cols-[1fr_340px] gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-400 uppercase tracking-wider"><ShieldCheck className="w-4 h-4"/> Fabricante verificado na PlaceFit</div>
              <h1 className="mt-6 text-5xl md:text-7xl font-black tracking-[-0.05em] leading-none">{perfil.nome}</h1>
              <p className="mt-6 text-xl md:text-2xl text-neutral-300 leading-relaxed max-w-3xl">{perfil.resumo}</p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm">
                {perfil.cidade && <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"><MapPin className="w-4 h-4 text-green-400"/>{perfil.cidade}/{perfil.estado}</span>}
                {ano && <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"><CalendarDays className="w-4 h-4 text-green-400"/>Desde {ano}</span>}
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"><Factory className="w-4 h-4 text-green-400"/>Indústria fitness</span>
              </div>
            </div>
            <div className="rounded-3xl bg-white p-8 text-neutral-950 shadow-2xl">
              {perfil.logo_url && <img src={perfil.logo_url} alt={`Logo oficial ${perfil.nome}`} className="w-full h-20 object-contain object-left mb-6" />}
              <div className="text-xs uppercase tracking-widest font-bold text-neutral-400">Identidade oficial</div>
              <div className="mt-4 text-3xl font-black">{perfil.nome}</div>
              {perfil.cnpj && <div className="mt-2 text-sm text-neutral-500">CNPJ {perfil.cnpj}</div>}
              <div className="mt-7 space-y-3">
                {perfil.site && <a href={perfil.site} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border p-3 hover:bg-neutral-50"><span className="inline-flex items-center gap-2"><Globe2 className="w-4 h-4"/>Site oficial</span><ExternalLink className="w-4 h-4"/></a>}
                {perfil.instagram && <a href={perfil.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl border p-3 hover:bg-neutral-50"><span>Instagram oficial</span><ExternalLink className="w-4 h-4"/></a>}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-5 py-16 md:py-24 grid md:grid-cols-[.8fr_1.2fr] gap-12">
          <div><div className="text-green-700 font-black text-xs uppercase tracking-widest">Quem é a CPFit</div><h2 className="mt-3 text-4xl font-black tracking-tight">Fabricação, catálogo e desenvolvimento sob medida.</h2></div>
          <div><p className="text-lg text-neutral-700 leading-8">{perfil.historia}</p>{perfil.responsavel_nome && <div className="mt-8 flex items-center gap-4"><img src={perfil.responsavel_foto || "/ricardo-cpfit.svg"} alt={`${perfil.responsavel_nome} - ${perfil.responsavel_cargo || perfil.nome}`} className="w-20 h-20 rounded-2xl object-cover bg-neutral-100"/><div className="border-l-4 border-green-600 pl-5"><div className="font-bold">{perfil.responsavel_nome}</div><div className="text-sm text-neutral-500">{perfil.responsavel_cargo}</div></div></div>}</div>
        </section>

        <section className="border-y border-neutral-200 bg-white"><div className="max-w-6xl mx-auto px-5 py-16 md:py-20"><div className="text-green-700 font-black text-xs uppercase tracking-widest">Capacidades do fabricante</div><div className="mt-7 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{(perfil.capacidades || []).map((c,i)=><div key={i} className="rounded-2xl border border-neutral-200 p-6"><Factory className="w-6 h-6 text-green-600"/><h3 className="mt-4 font-bold text-lg">{c}</h3></div>)}</div></div></section>

        <section className="max-w-6xl mx-auto px-5 py-16 md:py-24"><div className="flex items-end justify-between gap-6"><div><div className="text-green-700 font-black text-xs uppercase tracking-widest">Produtos que representam a marca</div><h2 className="mt-3 text-4xl font-black tracking-tight">Destaques CPFit</h2></div><PackageCheck className="hidden md:block w-12 h-12 text-neutral-300"/></div><div className="mt-9 grid md:grid-cols-3 gap-5">{(perfil.produtos_destaque || []).map((p,i)=><article key={i} className="rounded-3xl bg-white border border-neutral-200 p-7"><div className="text-xs font-bold uppercase tracking-wider text-green-700">{p.categoria}</div><h3 className="mt-3 text-2xl font-black">{p.nome}</h3><p className="mt-4 text-neutral-600 leading-7">{p.descricao}</p></article>)}</div></section>

        <section className="bg-[#102116] text-white"><div className="max-w-6xl mx-auto px-5 py-16 md:py-24"><div className="max-w-3xl"><div className="text-green-400 font-black text-xs uppercase tracking-widest">Projetos especiais</div><h2 className="mt-3 text-4xl md:text-5xl font-black tracking-tight">Desenvolvimento para treinamento esportivo.</h2><p className="mt-6 text-lg text-neutral-300 leading-8">A experiência da CPFit inclui o desenvolvimento de soluções específicas para treinamento. Uma reportagem do Globo Esporte MG sobre equipamentos para preparação de goleiros registra esse trabalho em ambiente de fabricação, incluindo equipamentos especiais como rebatedor de bolas e cortina de gols.</p></div><div className="mt-10 grid md:grid-cols-2 gap-4">{(perfil.fontes_externas || []).map((f,i)=><a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-white/15 bg-white/5 p-6 hover:bg-white/10"><div className="text-xs text-green-400 font-bold uppercase tracking-wider">{f.veiculo}</div><h3 className="mt-2 text-lg font-bold">{f.titulo}</h3><div className="mt-4 inline-flex items-center gap-2 text-sm text-neutral-300">Ver fonte <ExternalLink className="w-4 h-4"/></div></a>)}</div></div></section>

        <section className="max-w-6xl mx-auto px-5 py-16 md:py-24"><div className="rounded-[2rem] border border-neutral-200 bg-white p-8 md:p-12 grid md:grid-cols-[1fr_auto] gap-8 items-center"><div><div className="inline-flex items-center gap-2 text-green-700 font-bold text-sm"><Sparkles className="w-4 h-4"/>Entidade verificada</div><h2 className="mt-3 text-3xl font-black">CPFit na PlaceFit</h2><p className="mt-3 text-neutral-600 max-w-2xl">Este perfil organiza dados públicos, produtos, capacidades e fontes externas da fabricante em uma única entidade B2B. O catálogo comercial será conectado ao cadastro ativo da CPFit na plataforma.</p></div><Link to="/Marketplace" className="inline-flex items-center justify-center rounded-full bg-neutral-950 text-white px-6 py-3 font-bold">Ver Marketplace</Link></div></section>
      </main>
      <footer className="border-t bg-white"><div className="max-w-6xl mx-auto px-5 py-8 text-sm text-neutral-500 flex flex-wrap justify-between gap-3"><span>© 2026 PlaceFit</span><span>Perfil público de fabricante · dados revisados em {perfil.revisado_em || "2026"}</span></div></footer>
    </div>
  </>;
}
