// Calculo de preco da vitrine publica de um revendedor.
// Preco promocional (sale_price) tem prioridade; caso contrario aplica margem sobre o preco de fabrica.
export const computeStorePrice = (sp) => {
  const base = Number(sp.preco) || 0;
  const margem = Number(sp.margem) || 0;
  const sale = Number(sp.sale_price) || 0;
  const price = sale > 0 ? sale : Math.round((base * (1 + margem / 100)) * 100) / 100;
  return price;
};

// Grupo de variacao (ProductTemplate.grupo_variacao, criado em 12/10/2026): variacoes do
// mesmo item (peso, pecas, medida, cor) que a vitrine e os feeds mostram juntas.
// Foto do grupo = a foto https mais usada entre as variacoes. Variacao sem foto herda essa
// foto SO na exibicao (vitrine e feeds); o cadastro nao e alterado (decisao do Leandro, opcao a).
const isHttpsFoto = (u) => typeof u === "string" && /^https:\/\/\S+$/i.test(u.trim());

export const fotosPorGrupo = (templates) => {
  const cont = {};
  for (const t of templates || []) {
    if (!t || !t.grupo_variacao || !isHttpsFoto(t.foto)) continue;
    const g = (cont[t.grupo_variacao] = cont[t.grupo_variacao] || {});
    g[t.foto.trim()] = (g[t.foto.trim()] || 0) + 1;
  }
  const fotos = {};
  for (const [grupo, c] of Object.entries(cont)) {
    fotos[grupo] = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
  }
  return fotos;
};

// Template com a foto do grupo quando ele mesmo nao tem foto https.
export const comFotoDoGrupo = (t, fotos) =>
  t && !isHttpsFoto(t.foto) && t.grupo_variacao && fotos[t.grupo_variacao]
    ? { ...t, foto: fotos[t.grupo_variacao] }
    : t;

// Ordem natural das variacoes pelo rotulo ("30 cm" antes de "1,2 m"; lbs convertido p/ kg).
export const medidaDoRotulo = (rotulo) => {
  const m = String(rotulo || "").replace(",", ".").match(/(\d+(?:\.\d+)?)(?:\/(\d+))?\s*(kg|lbs|mm|cm|m|pares|peças|")?/i);
  if (!m) return Number.MAX_SAFE_INTEGER;
  let v = m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]);
  const u = (m[3] || "").toLowerCase();
  if (u === "lbs") v *= 0.4536;
  else if (u === "m") v *= 1000;
  else if (u === "cm") v *= 10;
  else if (u === '"') v *= 25.4;
  return v;
};