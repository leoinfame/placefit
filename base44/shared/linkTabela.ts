// Item 022g (pedido do Sr. Leo, 02/11/2026): o link da tabela mostra no WhatsApp o NOME DA
// EMPRESA do cadastro da revenda (não "Public Table | PlaceFit", em inglês).
// O WhatsApp lê as etiquetas og:* do HTML sem rodar JavaScript; quem abre no navegador
// segue direto para a tabela (/PublicTable?supplier=...).

export const ICONE_APP = "https://media.base44.com/images/public/68c9d5dd3cf0f8fd8a834875/574e5a0a6_logo-ico-removebg-preview1.png";

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]);

export function linkDaTabela(painel: string, supplierId: string) {
  return `${String(painel || "https://app.placefit.com.br").replace(/\/+$/, "")}/functions/tabela?supplier=${supplierId}`;
}

export function htmlPreviaTabela(painel: string, supplierId: string, revenda: any) {
  const base = String(painel || "https://app.placefit.com.br").replace(/\/+$/, "");
  const destino = revenda ? `${base}/PublicTable?supplier=${supplierId}` : base;
  const empresa = String(revenda?.empresa || revenda?.full_name || "").trim() || "Tabela de atacado";
  const local = [revenda?.cidade, revenda?.estado].filter(Boolean).join("/");
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const titulo = `${empresa} — Tabela de atacado`;
  const desc = `Tabela de atacado atualizada em ${hoje}${local ? " · " + local : ""}. Envie a lista dos itens e o CNPJ para o orçamento com frete.`;
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(empresa)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${ICONE_APP}">
<meta property="og:url" content="${esc(destino)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(titulo)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${ICONE_APP}">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${esc(destino)}">
</head><body style="font-family:Arial,sans-serif;padding:24px">
<p>Abrindo a tabela de atacado de ${esc(empresa)}… <a href="${esc(destino)}">toque aqui</a> se não abrir.</p>
<script>location.replace(${JSON.stringify(destino)});</script>
</body></html>`;
}
