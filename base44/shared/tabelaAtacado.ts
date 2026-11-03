import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

/**
 * Itens 022e/022f (pedidos do Sr. Leo, 02/11/2026): tabela de atacado da revenda.
 * Mesma regra de preço da tela "Sua Tabela": preço promocional quando houver, senão
 * preço × (1 + margem). Só sai o preço FINAL de venda: nunca preço de fábrica, margem,
 * fabricante, CNPJ, e-mail ou outro dado interno.
 */
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

/** null quando o id não é de uma revenda válida. */
export async function carregarTabela(db: any, supplierId: string) {
  if (!/^[a-f0-9]{24}$/i.test(String(supplierId || ""))) return null;
  const u = (await db.User.filter({ id: supplierId }))?.[0];
  if (!u || u.tipo_usuario === "fabricante" || u.tipo_usuario === "transportador") return null;

  const revenda = {
    empresa: u.empresa || u.full_name || "",
    logomarca: u.logomarca || "",
    whatsapp: u.whatsapp || "",
    site: u.site || "",
    cidade: u.cidade || "",
    estado: u.estado || ""
  };

  const sps = await todos((skip) => db.SupplierProduct.filter({ supplier_id: supplierId }, "-created_date", PAGE, skip));
  const ativos = sps.filter((sp: any) => sp.disponivel !== false && Number(sp.preco) > 0 && sp.product_id);
  const ids = [...new Set(ativos.map((sp: any) => sp.product_id))];
  const templates: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const lote = await db.ProductTemplate.filter({ id: { $in: ids.slice(i, i + 200) } }, "cod", 200);
    templates.push(...(lote || []));
  }
  const tpl = new Map(templates.map((t: any) => [t.id, t]));

  const vistos = new Set<string>();
  const itens = ativos.map((sp: any) => {
    const t: any = tpl.get(sp.product_id);
    if (!t || t.ativo === false || vistos.has(t.id)) return null;
    vistos.add(t.id);
    const preco = Number(sp.sale_price) > 0 ? Number(sp.sale_price) : Number(sp.preco) * (1 + (Number(sp.margem) || 0) / 100);
    return {
      cod: t.cod || "",
      nome: t.nome || "",
      categoria: t.categoria || "Outros",
      und: t.und || "peça",
      peso_kg: t.peso_kg ?? null,
      foto: t.foto || "",
      preco: Math.round(preco * 100) / 100
    };
  }).filter(Boolean)
    .sort((a: any, b: any) => String(a.categoria).localeCompare(String(b.categoria), "pt-BR") ||
      String(a.nome).localeCompare(String(b.nome), "pt-BR", { numeric: true }));

  return { revenda, itens, atualizado_em: new Date().toISOString() };
}

// Fonte padrão do PDF só tem Latin-1: troca aspas/travessões e descarta o resto (emoji etc.)
export function textoPdf(s: unknown): string {
  return String(s ?? "")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E -ÿ]/g, "");
}

export const moedaBR = (v: number) =>
  "R$ " + Number(v || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const pesoBR = (p: any) => (p === null || p === undefined || p === "" || !(Number(p) > 0)) ? "" :
  String(Math.round(Number(p) * 100) / 100).replace(".", ",") + " kg";

/** PDF A4 da tabela (Uint8Array). */
export async function pdfDaTabela(tabela: any): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 36;
  const empresa = textoPdf(tabela?.revenda?.empresa || "Tabela de atacado");
  const data = new Date(tabela?.atualizado_em || Date.now()).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  doc.setTitle(`Tabela de atacado - ${empresa}`);
  doc.setAuthor(empresa);
  doc.setCreator("PlaceFit");

  const col = { cod: M, nome: M + 78, und: W - M - 150, peso: W - M - 108, preco: W - M };
  const larguraNome = col.und - col.nome - 8;
  const cortar = (t: string, f: any, tam: number, max: number) => {
    if (f.widthOfTextAtSize(t, tam) <= max) return t;
    while (t.length > 1 && f.widthOfTextAtSize(t + "...", tam) > max) t = t.slice(0, -1);
    return t + "...";
  };

  let page: any, y = 0, n = 0;
  const novaPagina = () => {
    page = doc.addPage([W, H]);
    n++;
    y = H - M;
    page.drawText(empresa, { x: M, y: y - 14, size: 16, font: negrito, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(`Tabela de atacado - atualizada em ${data}`, { x: M, y: y - 30, size: 9, font: fonte, color: rgb(0.4, 0.4, 0.4) });
    y -= 44;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.8, 0.8, 0.8) });
    y -= 6;
  };
  const rodape = () => {
    const pages = doc.getPages();
    pages.forEach((p, i) => {
      p.drawText(textoPdf(`Para orçamento com frete, envie pelo WhatsApp a lista dos itens com quantidades e o CNPJ (ou CPF).   ${i + 1}/${pages.length}`),
        { x: M, y: 20, size: 7.5, font: fonte, color: rgb(0.45, 0.45, 0.45) });
    });
  };

  novaPagina();
  let categoria = "";
  for (const it of (tabela?.itens || [])) {
    const cat = textoPdf(it.categoria || "Outros");
    if (cat !== categoria) {
      if (y < M + 50) novaPagina();
      y -= 14;
      page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 16, color: rgb(0.93, 0.93, 0.93) });
      page.drawText(cat, { x: M + 4, y, size: 10, font: negrito, color: rgb(0.1, 0.1, 0.1) });
      y -= 16;
      categoria = cat;
    }
    if (y < M + 20) novaPagina();
    const tam = 8.5;
    page.drawText(cortar(textoPdf(it.cod), fonte, tam, 74), { x: col.cod, y, size: tam, font: fonte, color: rgb(0.35, 0.35, 0.35) });
    page.drawText(cortar(textoPdf(it.nome), fonte, tam, larguraNome), { x: col.nome, y, size: tam, font: fonte });
    page.drawText(cortar(textoPdf(it.und), fonte, tam, 38), { x: col.und, y, size: tam, font: fonte, color: rgb(0.35, 0.35, 0.35) });
    page.drawText(pesoBR(it.peso_kg), { x: col.peso, y, size: tam, font: fonte, color: rgb(0.35, 0.35, 0.35) });
    const preco = moedaBR(it.preco);
    page.drawText(preco, { x: col.preco - negrito.widthOfTextAtSize(preco, tam), y, size: tam, font: negrito });
    y -= 12.5;
  }
  rodape();
  return await doc.save();
}

export function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
