// Item 023 (Sr. Leo, 03/11/2026): PDFs usam a IDENTIDADE VISUAL configurada pela revenda
// (Perfil → Identidade visual, salva na LojaConfig: cor principal e secundária).
// Só sem identidade configurada é que as cores saem da logo (comportamento antigo).
// Usado no painel (PDF de orçamento/pedido, Sua Tabela) e pelo CRM (PDFs enviados ao cliente).

const PADRAO_PRINCIPAL = "#1e40af";
const PADRAO_SECUNDARIA = "#059669";
const hexOk = (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim());
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const escurecer = (h, a) => hex(rgb(h).map((v) => v * (1 - a)));
const clarear = (h, a) => hex(rgb(h).map((v) => v + (255 - v) * a));

/** Cores da identidade da loja, ou null se a revenda não configurou (mesma regra da tela Identidade visual). */
export function identidadeDaLoja(loja) {
  if (!loja || !hexOk(loja.cor_primaria)) return null;
  const p = loja.cor_primaria.trim().toLowerCase();
  const s = hexOk(loja.cor_secundaria) ? loja.cor_secundaria.trim().toLowerCase() : p;
  if (!loja.identidade_configurada && p === PADRAO_PRINCIPAL && s === PADRAO_SECUNDARIA) return null;
  return { principal: p, secundaria: s };
}

/** Paleta no formato que os PDFs usam. */
export function paletaPdf({ principal, secundaria }) {
  const [r, g, b] = rgb(principal);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return {
    primary: principal,
    primaryDark: escurecer(principal, 0.25),
    secondary: secundaria,
    secondaryDark: escurecer(secundaria, 0.25),
    light: clarear(principal, 0.88),
    lightBorder: clarear(principal, 0.70),
    textOnPrimary: lum > 140 ? "#1e293b" : "#ffffff",
    textAccent: escurecer(principal, 0.15)
  };
}

/** Atalho: paleta da LojaConfig ou null. */
export const paletaDaLoja = (loja) => {
  const id = identidadeDaLoja(loja);
  return id ? paletaPdf(id) : null;
};
