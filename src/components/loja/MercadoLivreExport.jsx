import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Loader2,
  ShoppingBag,
  Check,
  X,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Calculator,
} from "lucide-react";

// Configurar do Mercado Livre:
// 1. lista AGRUPADA (pai = grupo_variacao, ou nome sem o "N kg" do fim, igual à vitrine);
// 2. "Ver prévia" → mlAnuncios {acao:"previa"}: comissão real da categoria (Clássico, sem
//    frete grátis) e preço final por variação — nada é enviado ao ML;
// 3. "Exportar" manda os preços que a pessoa viu; o servidor recalcula e recusa o que mudou.
// 1 anúncio por variação (a conta está no modelo antigo do ML). Variação que já tem
// anúncio (MLAnuncio) só tem o preço atualizado — nunca duplica.

const MAX_POR_VEZ = 200;
const brl = (v) => (v == null || isNaN(v) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const fmtData = (iso) => {
  if (!iso) return "nunca";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
};
const precoLoja = (sp) => {
  const sale = Number(sp.sale_price) || 0;
  if (sale > 0) return sale;
  return Math.round((Number(sp.preco) || 0) * (1 + (Number(sp.margem) || 0) / 100) * 100) / 100;
};
const baseName = (nome) => (nome || "").replace(/\s+\d+([.,]\d+)?\s*kg$/i, "").trim();
// Ordem natural das variações (mesma ideia do medidaDoRotulo do servidor)
const medida = (s) => {
  const m = String(s || "").replace(",", ".").match(/(\d+(?:\.\d+)?)(?:\/(\d+))?\s*(kg|lbs|mm|cm|m|")?/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  let v = m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]);
  const u = (m[3] || "").toLowerCase();
  if (u === "lbs") v *= 0.4536; else if (u === "m") v *= 1000; else if (u === "cm") v *= 10; else if (u === '"') v *= 25.4;
  return v;
};
const STATUS_ML = {
  active: { label: "Ativo no ML", cls: "bg-green-100 text-green-800" },
  paused: { label: "Pausado no ML", cls: "bg-gray-200 text-gray-700" },
  closed: { label: "Encerrado", cls: "bg-gray-200 text-gray-700" },
  under_review: { label: "Em revisão", cls: "bg-amber-100 text-amber-800" },
  inactive: { label: "Inativo", cls: "bg-gray-200 text-gray-700" },
};
const Selo = ({ a }) => {
  if (!a?.ml_item_id) return null;
  const st = STATUS_ML[a.status] || { label: a.status || "No ML", cls: "bg-blue-100 text-blue-800" };
  return (
    <a href={a.permalink || "#"} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
      className={`text-[11px] px-1.5 py-0.5 rounded ${st.cls} inline-flex items-center gap-1 whitespace-nowrap`}>
      {st.label} <ExternalLink className="w-3 h-3" />
    </a>
  );
};

export default function MercadoLivreExport({ config, onSaved }) {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [anuncios, setAnuncios] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [abertos, setAbertos] = useState(new Set());
  const [busca, setBusca] = useState("");
  const [pctManual, setPctManual] = useState("");
  const [previa, setPrevia] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [results, setResults] = useState(null);
  const [connecting, setConnecting] = useState(false);

  // Volta do OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ml_connected")) {
      toast({ title: "Mercado Livre conectado!", description: "Sua conta foi vinculada com sucesso." });
      window.history.replaceState({}, "", window.location.pathname);
      onSaved?.();
    }
    if (params.get("ml_error")) {
      const vencido = params.get("ml_error") === "state";
      toast({
        title: "Erro ao conectar",
        description: vencido ? "O link de conexão venceu ou não é válido. Clique em Conectar de novo." : "Não foi possível conectar sua conta do ML.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (config?.ml_access_token) loadProducts();
    else setLoading(false);
  }, [config?.ml_access_token]);

  // Qualquer mudança de seleção ou percentual invalida a prévia
  useEffect(() => { setPrevia(null); }, [selected, pctManual]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const u = await base44.auth.me();
      const sps = await base44.entities.SupplierProduct.filter({ supplier_id: u.id }, "-created_date", 2000);
      const productIds = [...new Set(sps.map((sp) => sp.product_id).filter(Boolean))];
      const templates = productIds.length
        ? await base44.entities.ProductTemplate.filter({ id: { $in: productIds } }, "-created_date", 2000)
        : [];
      const tplById = {};
      for (const t of templates) tplById[t.id] = t;
      setProducts(
        sps
          .filter((sp) => sp.disponivel !== false && sp.product_id)
          .map((sp) => ({ ...sp, template: tplById[sp.product_id], preco_loja: precoLoja(sp) }))
          .filter((sp) => sp.template && sp.template.ativo !== false),
      );
      const mapa = await base44.entities.MLAnuncio.filter({ revendedor_id: u.id }, "-updated_date", 2000).catch(() => []);
      const porSp = {};
      for (const a of mapa) {
        if (a.ml_item_id && (!a.ml_user_id || a.ml_user_id === String(config.ml_user_id))) porSp[a.supplier_product_id] = a;
      }
      setAnuncios(porSp);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar produtos", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  // Agrupa variações pelo pai
  const grupos = useMemo(() => {
    const mapa = {};
    for (const sp of products) {
      const t = sp.template;
      const chave = t.grupo_variacao ? `gv|${t.grupo_variacao}` : `nm|${baseName(t.nome)}|${t.categoria || ""}`;
      const g = (mapa[chave] = mapa[chave] || { chave, nome: t.grupo_variacao || baseName(t.nome), categoria: t.categoria, itens: [] });
      g.itens.push(sp);
      if (!g.foto && t.foto) g.foto = t.foto;
    }
    const lista = Object.values(mapa);
    for (const g of lista) {
      g.itens.sort((a, b) => medida(a.template.variacao_rotulo || a.template.nome) - medida(b.template.variacao_rotulo || b.template.nome) || a.preco_loja - b.preco_loja);
    }
    const q = busca.trim().toLowerCase();
    return lista
      .filter((g) => !q || g.nome.toLowerCase().includes(q) || g.itens.some((sp) => (sp.template.nome || "").toLowerCase().includes(q)))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [products, busca]);

  const connect = async () => {
    setConnecting(true);
    try {
      const res = await base44.functions.invoke("mlAuth", { info: 1 });
      const authUrl = res?.auth_url || res?.data?.auth_url;
      if (!authUrl) throw new Error(res?.data?.error || res?.error || "URL de autorização não recebida");
      window.location.href = authUrl;
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setConnecting(false);
  };

  const disconnect = async () => {
    try {
      await base44.entities.LojaConfig.update(config.id, {
        ml_access_token: "",
        ml_refresh_token: "",
        ml_expires_at: "",
        ml_user_id: "",
        ml_nickname: "",
      });
      toast({ title: "Mercado Livre desconectado" });
      onSaved?.();
    } catch (e) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const toggle = (ids, marcar) => {
    const next = new Set(selected);
    for (const id of ids) marcar ? next.add(id) : next.delete(id);
    setSelected(next);
  };
  const toggleAberto = (chave) => {
    const next = new Set(abertos);
    next.has(chave) ? next.delete(chave) : next.add(chave);
    setAbertos(next);
  };

  const pctNum = pctManual === "" ? null : Number(String(pctManual).replace(",", "."));
  const pctValido = pctNum === null || (pctNum >= 0 && pctNum < 60);

  const invoke = async (payload) => {
    const res = await base44.functions.invoke("mlAnuncios", payload);
    const d = res?.data || res;
    if (d?.error) throw new Error(d.error);
    return d;
  };

  const verPrevia = async () => {
    if (!selected.size) return toast({ title: "Selecione ao menos uma variação", variant: "destructive" });
    if (selected.size > MAX_POR_VEZ) return toast({ title: `Máximo de ${MAX_POR_VEZ} variações por vez`, variant: "destructive" });
    if (!pctValido) return toast({ title: "Percentual manual inválido (0 a 59)", variant: "destructive" });
    setCalculando(true);
    setResults(null);
    try {
      setPrevia(await invoke({ acao: "previa", sp_ids: [...selected], pct_manual: pctNum }));
    } catch (e) {
      toast({ title: "Erro na prévia", description: e.message, variant: "destructive" });
    }
    setCalculando(false);
  };

  const exportar = async () => {
    const prontos = (previa?.itens || []).filter((i) => i.ok);
    if (!prontos.length) return;
    setExporting(true);
    try {
      const precos = {};
      for (const i of prontos) precos[i.sp_id] = i.preco_final;
      const res = await invoke({ acao: "exportar", sp_ids: prontos.map((i) => i.sp_id), pct_manual: pctNum, precos });
      setResults(res);
      setPrevia(null);
      const ok = (res.criados || 0) + (res.atualizados || 0);
      toast({
        title: ok ? `${res.criados || 0} criado(s), ${res.atualizados || 0} atualizado(s)` : "Nada foi enviado",
        description: res.falhas ? `${res.falhas} falha(s) — veja abaixo` : "Tudo certo!",
        variant: ok ? undefined : "destructive",
      });
      await loadProducts();
      onSaved?.();
    } catch (e) {
      toast({ title: "Erro na exportação", description: e.message, variant: "destructive" });
    }
    setExporting(false);
  };

  if (!config?.slug) {
    return <p className="text-gray-500 text-sm">Salve sua loja (defina o slug) antes de conectar o Mercado Livre.</p>;
  }

  const connected = !!config.ml_access_token;
  const prontos = (previa?.itens || []).filter((i) => i.ok);
  const comErro = (previa?.itens || []).filter((i) => !i.ok);

  return (
    <div className="space-y-5">
      {/* Conexão */}
      <div className={`rounded-xl border p-4 ${connected ? "bg-yellow-50/60 border-yellow-200" : "bg-gray-50 border-gray-200"}`}>
        <div className="flex items-start gap-3">
          <ShoppingBag className={`w-5 h-5 mt-0.5 shrink-0 ${connected ? "text-yellow-600" : "text-gray-400"}`} />
          <div className="flex-1">
            <p className="font-semibold text-gray-900">
              {connected ? `Conectado: ${config.ml_nickname || "Conta ML"}` : "Mercado Livre não conectado"}
            </p>
            {connected ? (
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <Button variant="outline" size="sm" onClick={disconnect}>Desconectar</Button>
                {config.ml_ultima_exportacao && (
                  <span className="text-xs text-gray-500">
                    Última exportação: {fmtData(config.ml_ultima_exportacao)} • {config.ml_itens_exportados || 0} anúncios no mapa
                  </span>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mt-1">
                  Conecte sua conta do Mercado Livre para anunciar seus produtos com categoria e comissão calculadas automaticamente.
                </p>
                <Button onClick={connect} disabled={connecting} className="mt-3 bg-yellow-500 hover:bg-yellow-600 text-white">
                  {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShoppingBag className="w-4 h-4 mr-2" />}
                  Conectar Mercado Livre
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {connected && (loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          {/* Lista agrupada */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm">
              <span className="font-medium">{grupos.length} produtos</span>
              <span className="text-gray-400"> • </span>
              <span className="text-gray-500">{selected.size} variações selecionadas</span>
            </div>
            <div className="flex gap-2 items-center">
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto" className="h-8 w-44" />
              <Button variant="outline" size="sm" onClick={() => toggle(grupos.flatMap((g) => g.itens.map((sp) => sp.id)), true)}>Todos</Button>
              <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Limpar</Button>
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              {grupos.length === 0 ? (
                <p className="p-4 text-center text-gray-500 text-sm">Nenhum produto disponível.</p>
              ) : grupos.map((g) => {
                const ids = g.itens.map((sp) => sp.id);
                const marcados = ids.filter((id) => selected.has(id)).length;
                const noMl = ids.filter((id) => anuncios[id]).length;
                const aberto = abertos.has(g.chave) || g.itens.length === 1;
                const unico = g.itens.length === 1 ? g.itens[0] : null;
                return (
                  <div key={g.chave} className="border-b last:border-0">
                    <div className="flex items-center gap-3 p-3 hover:bg-gray-50">
                      <Checkbox
                        checked={marcados === ids.length ? true : marcados ? "indeterminate" : false}
                        onCheckedChange={() => toggle(ids, marcados !== ids.length)}
                      />
                      <button type="button" className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => !unico && toggleAberto(g.chave)}>
                        {g.foto ? <img src={g.foto} alt="" className="w-10 h-10 rounded object-cover" /> : (
                          <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-gray-400" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{unico ? unico.template.nome : g.nome}</p>
                          <p className="text-xs text-gray-500">
                            {g.categoria}{!unico && ` • ${g.itens.length} variações`}{noMl ? ` • ${noMl} já no ML` : ""}
                          </p>
                        </div>
                        {unico ? <span className="text-sm font-semibold">{brl(unico.preco_loja)}</span>
                          : aberto ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </button>
                      {unico && <Selo a={anuncios[unico.id]} />}
                    </div>
                    {aberto && !unico && (
                      <div className="pl-12 pb-2 bg-gray-50/50">
                        {g.itens.map((sp) => (
                          <label key={sp.id} className="flex items-center gap-3 py-1.5 pr-3 cursor-pointer">
                            <Checkbox checked={selected.has(sp.id)} onCheckedChange={(v) => toggle([sp.id], !!v)} />
                            <span className="text-sm flex-1 min-w-0 truncate">{sp.template.variacao_rotulo || sp.template.nome}</span>
                            <Selo a={anuncios[sp.id]} />
                            <span className="text-sm font-semibold w-24 text-right">{brl(sp.preco_loja)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comissão e prévia */}
          <div className="rounded-xl border p-4 space-y-3">
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Percentual manual (só se a consulta ao ML falhar)</label>
                <div className="flex items-center gap-1">
                  <Input value={pctManual} onChange={(e) => setPctManual(e.target.value)} placeholder="ex.: 14" className="h-9 w-24" inputMode="decimal" />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
              <Button onClick={verPrevia} disabled={calculando || !selected.size || !pctValido} variant="outline">
                {calculando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
                {calculando ? "Consultando comissão..." : `Ver prévia (${selected.size})`}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              A prévia consulta a comissão real da categoria no Mercado Livre (anúncio Clássico, sem frete grátis) e calcula o
              preço final para você receber o preço PlaceFit depois da comissão. Nada é enviado ao ML na prévia.
            </p>

            {previa && (
              <div className="space-y-3">
                {previa?.aviso_conta && (
                  <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                    <strong>O Mercado Livre não está deixando esta conta anunciar.</strong> {previa.aviso_conta}. Resolva isso na conta do Mercado Livre e gere a prévia de novo.
                  </div>
                )}
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-600">
                      <tr>
                        <th className="text-left p-2">Anúncio</th>
                        <th className="text-left p-2">Ação</th>
                        <th className="text-right p-2">Preço PlaceFit</th>
                        <th className="text-right p-2">Comissão</th>
                        <th className="text-right p-2">Preço final no ML</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prontos.map((i) => (
                        <tr key={i.sp_id} className="border-t">
                          <td className="p-2">
                            <p className="font-medium">{i.titulo}</p>
                            <p className="text-xs text-gray-500">{i.categoria_ml}{i.foto_do_grupo ? " • foto do grupo" : ""}</p>
                          </td>
                          <td className="p-2 text-xs whitespace-nowrap">
                            {i.acao === "atualizar" ? (
                              <span>Atualizar preço{i.preco_atual_ml != null ? ` (hoje ${brl(i.preco_atual_ml)})` : ""}</span>
                            ) : "Criar anúncio"}
                          </td>
                          <td className="p-2 text-right whitespace-nowrap">{brl(i.preco_placefit)}</td>
                          <td className="p-2 text-right whitespace-nowrap">
                            {brl(i.comissao)}
                            <p className="text-xs text-gray-500">
                              {String(i.comissao_pct).replace(".", ",")}%{i.comissao_fixa ? ` + ${brl(i.comissao_fixa)}` : ""} • {i.comissao_fonte === "api" ? "ML" : "manual"}
                            </p>
                          </td>
                          <td className="p-2 text-right font-semibold whitespace-nowrap">{brl(i.preco_final)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {comErro.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-700">Fora desta exportação ({comErro.length}):</p>
                    {comErro.map((i) => (
                      <div key={i.sp_id} className="text-xs text-red-600 flex gap-2">
                        <X className="w-3 h-3 mt-0.5 shrink-0" /><span><strong>{i.titulo || i.nome}</strong>: {i.erro}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Button onClick={exportar} disabled={exporting || !prontos.length || previa?.conta_pode_anunciar === false} className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShoppingBag className="w-4 h-4 mr-2" />}
                  {exporting ? "Enviando..." : `Confirmar e enviar ${prontos.length} ao Mercado Livre`}
                </Button>
              </div>
            )}
          </div>

          {/* Resultado */}
          {results && (
            <div className="border rounded-xl p-4 space-y-3">
              {results.aviso_conta && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{results.aviso_conta}</div>
              )}
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-2 text-green-600 font-medium"><Check className="w-4 h-4" />{results.criados || 0} criados</span>
                <span className="flex items-center gap-2 text-blue-600 font-medium"><Check className="w-4 h-4" />{results.atualizados || 0} atualizados</span>
                {results.falhas > 0 && <span className="flex items-center gap-2 text-red-600 font-medium"><X className="w-4 h-4" />{results.falhas} falhas</span>}
              </div>
              {(results.results || []).map((r, i) => (
                <div key={i} className={`text-xs flex gap-2 ${r.success ? "text-gray-700" : "text-red-600"}`}>
                  {r.success ? <Check className="w-3 h-3 mt-0.5 shrink-0 text-green-600" /> : <X className="w-3 h-3 mt-0.5 shrink-0" />}
                  <span>
                    <strong>{r.titulo || r.nome}</strong>{" "}
                    {r.success ? (
                      <a href={r.permalink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        {r.acao === "atualizar" ? "preço atualizado" : "anúncio criado"} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : `: ${r.error}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-sm text-gray-700">
            <p className="font-semibold mb-1">Como funciona</p>
            <ul className="list-disc ml-5 space-y-0.5 text-gray-600">
              <li>Cada variação vira um anúncio próprio, com o rótulo no título (ex.: "Caneleira (Par) 10 kg"). O ML desta conta não aceita variação de peso ou medida com preço diferente no mesmo anúncio.</li>
              <li>Variação que já tem anúncio não é duplicada: só o preço é atualizado. Título, fotos e pausa feitos no ML ficam como estão.</li>
              <li>Anúncios Novo, Clássico, sem frete grátis. Variação sem foto usa a foto do grupo; sem nenhuma foto não é exportada.</li>
            </ul>
          </div>
        </>
      ))}
    </div>
  );
}
