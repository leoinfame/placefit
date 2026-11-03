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

export function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
