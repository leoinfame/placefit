// Item 022f (pedido do Sr. Leo, 02/11/2026): o lead novo recebe o MESMO PDF do botão
// "Gerar PDF" da tela Sua Tabela (logo, contatos, endereço, fotos, rodapé comercial).
// O layout vem de tabelaPdfHtml.js (o mesmo arquivo que a tela usa); quem "imprime" é o
// serviço de PDF no Railway (Gotenberg), no lugar do navegador.
import { itensDaRevenda, buildPDFHTML } from "./tabelaPdfHtml.js";
import { paletaDaLoja } from "./identidadeCores.js";

const PAGE = 500;
async function todos(fn: (skip: number) => Promise<any[]>) {
  let out: any[] = [];
  for (let skip = 0; skip < 20000; skip += PAGE) {
    const lote = (await fn(skip)) || [];
    out = out.concat(lote);
    if (lote.length < PAGE) break;
  }
  return out;
}

/** Mesmos dados da Sua Tabela (getProdutosData modo "meus" + generatePreview). */
export async function itensSuaTabela(db: any, ownerId: string) {
  const sps = await todos((skip) => db.SupplierProduct.filter({ supplier_id: ownerId }, "-created_date", PAGE, skip));
  const ids = [...new Set(sps.map((sp: any) => sp.product_id).filter(Boolean))];
  const templates: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    templates.push(...((await db.ProductTemplate.filter({ id: { $in: ids.slice(i, i + 200) } }, "-created_date", 200)) || []));
  }
  const produtos = templates.map((t: any) => ({
    id: t.id, nome: t.nome, cod: t.cod, categoria: t.categoria, und: t.und,
    peso_kg: t.peso_kg, foto: t.foto, dimensoes: t.dimensoes
  }));
  return itensDaRevenda(produtos, sps);
}

// Cores tiradas da logo, igual ao useLogoColors da tela, calculadas dentro do próprio Chromium.
const CORES_PADRAO: Record<string, string> = {
  primary: "#1e3a5f", primaryDark: "#0f172a", secondary: "#1e40af", secondaryDark: "#1e3a8a",
  light: "#eff6ff", lightBorder: "#bfdbfe", textOnPrimary: "#ffffff", textAccent: "#1e40af"
};
const CORES_CSS = Object.fromEntries(Object.entries(CORES_PADRAO).map(([k, v]) => [k, `var(--pf-${k}, ${v})`]));

export function scriptCores(logo: string) {
  return `<script>
(function(){
  function fim(){ window.__pronto = true; }
  setTimeout(fim, 5000);
  var logo = ${JSON.stringify(logo || "")};
  if (!logo) return fim();
  function hex(c){ return '#' + [c.r,c.g,c.b].map(function(v){ return v.toString(16).padStart(2,'0'); }).join(''); }
  function dk(c,a){ return { r:Math.max(0,Math.round(c.r*(1-a))), g:Math.max(0,Math.round(c.g*(1-a))), b:Math.max(0,Math.round(c.b*(1-a))) }; }
  function lt(c,a){ return { r:Math.min(255,Math.round(c.r+(255-c.r)*a)), g:Math.min(255,Math.round(c.g+(255-c.g)*a)), b:Math.min(255,Math.round(c.b+(255-c.b)*a)) }; }
  var img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = function(){
    try {
      var cv = document.createElement('canvas'); cv.width = 80; cv.height = 80;
      var ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, 80, 80);
      var d = ctx.getImageData(0, 0, 80, 80).data, m = {};
      for (var i = 0; i < d.length; i += 4) {
        if (d[i+3] < 128) continue;
        var br = (d[i]+d[i+1]+d[i+2])/3; if (br > 240 || br < 15) continue;
        var q = function(v){ return Math.min(255, Math.round(v/32)*32); }; // 248→256 virava cor inválida (#100…)
        var k = q(d[i]) + ',' + q(d[i+1]) + ',' + q(d[i+2]);
        m[k] = (m[k]||0) + 1;
      }
      var s = Object.keys(m).map(function(k){ return [k, m[k]]; }).sort(function(a,b){ return b[1]-a[1]; });
      if (!s.length) return fim();
      var a = s[0][0].split(',').map(Number), p = { r:a[0], g:a[1], b:a[2] }, sec = null;
      for (var j = 1; j < s.length; j++) {
        var q = s[j][0].split(',').map(Number);
        if (Math.abs(a[0]-q[0]) + Math.abs(a[1]-q[1]) + Math.abs(a[2]-q[2]) > 80) { sec = { r:q[0], g:q[1], b:q[2] }; break; }
      }
      if (!sec) sec = dk(p, 0.3);
      var lum = 0.299*p.r + 0.587*p.g + 0.114*p.b;
      var c = { primary:hex(p), primaryDark:hex(dk(p,0.25)), secondary:hex(sec), secondaryDark:hex(dk(sec,0.25)),
        light:hex(lt(p,0.88)), lightBorder:hex(lt(p,0.70)), textOnPrimary: lum > 140 ? '#1e293b' : '#ffffff', textAccent:hex(dk(p,0.15)) };
      var st = document.documentElement.style;
      Object.keys(c).forEach(function(k){ st.setProperty('--pf-' + k, c[k]); });
    } catch (e) {}
    fim();
  };
  img.onerror = fim;
  img.src = logo;
})();
</script>`;
}

/**
 * Logo da revenda embutida no HTML (data URL): o PDF sempre sai com a logo e as cores tiradas dela,
 * sem depender de o serviço de PDF conseguir baixar a imagem. Falhou → devolve a URL original.
 */
export async function logoComoDataUrl(url: string): Promise<string> {
  if (!/^https:\/\//i.test(String(url || ''))) return String(url || '');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return url;
    const tipo = r.headers.get('content-type') || 'image/png';
    if (!/^image\//i.test(tipo)) return url;
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length > 3_000_000) return url;
    return `data:${tipo.split(';')[0]};base64,${base64Bytes(bytes)}`;
  } catch {
    return url;
  }
}

function base64Bytes(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** HTML da Sua Tabela pronto para o serviço de PDF. */
export async function htmlSuaTabela(owner: any, itens: any[], loja: any = null) {
  const logo = await logoComoDataUrl(owner?.logomarca || "");
  const dono = { ...owner, logomarca: logo };
  // Identidade visual configurada pela revenda manda; sem ela, cores tiradas da logo
  const paleta = paletaDaLoja(loja);
  if (paleta) return buildPDFHTML({ user: dono, colors: paleta, imageMap: {}, items: itens as any, extraHead: "<script>window.__pronto = true;</script>" });
  return buildPDFHTML({ user: dono, colors: CORES_CSS, imageMap: {}, items: itens as any, extraHead: scriptCores(logo) });
}

/** LojaConfig da revenda (identidade visual), ou null. */
export async function lojaDaRevenda(db: any, ownerId: string) {
  try {
    return (await db.LojaConfig.filter({ revendedor_id: ownerId }, "-created_date", 1))?.[0] || null;
  } catch {
    return null;
  }
}

/** Imprime o HTML no serviço de PDF (Railway). Lança erro se não estiver configurado ou falhar. */
export async function imprimirPdf(html: string, cfg: { url: string; user: string; pass: string }): Promise<Uint8Array> {
  if (!cfg.url || !cfg.user || !cfg.pass) throw new Error("serviço de PDF não configurado");
  const form = new FormData();
  form.append("files", new Blob([html], { type: "text/html" }), "index.html");
  form.append("preferCssPageSize", "true");
  form.append("printBackground", "true");
  form.append("waitForExpression", "window.__pronto === true");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch(cfg.url.replace(/\/+$/, "") + "/forms/chromium/convert/html", {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(cfg.user + ":" + cfg.pass) },
      body: form,
      signal: ctrl.signal
    });
    if (!r.ok) throw new Error("serviço de PDF respondeu " + r.status);
    return new Uint8Array(await r.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}
