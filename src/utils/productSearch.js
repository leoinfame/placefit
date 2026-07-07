// Busca de produtos por palavras (tokens), tolerante a acento e plural.
// Usado no seletor do Orcamento (ProductAutoComplete) e no ProductCombobox
// (Vendas / PedidosVenda) para que buscas naturais como
// "kettlebell pintado 6" encontrem "Kettlebell Pintado 6kg".

const STOPWORDS = new Set([
  "de", "da", "do", "e", "a", "o", "os", "as", "com", "em", "para", "kg",
]);

const norm = (s) =>
  (s == null ? "" : String(s))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const productBlob = (p) =>
  norm(
    [
      p.nome,
      p.product_name,
      p.cod,
      p.product_cod,
      p.categoria,
      p.subcategoria,
      p.acabamento,
      p.fabricante_nome,
      p.peso_kg,
    ]
      .filter((v) => v != null && v !== "")
      .join(" ")
  );

export const tokenizeQuery = (q) =>
  norm(q)
    .split(/[\s,]+/)
    .filter((t) => t && !STOPWORDS.has(t));

// Cada token precisa aparecer no texto do produto. Tolera plural simples
// (kettlebells -> kettlebell) removendo o "s" final.
export const productMatches = (p, tokens) => {
  if (!tokens || tokens.length === 0) return true;
  const blob = productBlob(p);
  return tokens.every((t) => {
    if (blob.includes(t)) return true;
    if (t.length > 2 && t.endsWith("s") && blob.includes(t.slice(0, -1))) return true;
    return false;
  });
};
