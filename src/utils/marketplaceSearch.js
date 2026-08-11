// Motor de busca do Marketplace: normalização, tokens, fuzzy e scoring.
// Tolerante a acentos, plurais, troca de palavras e pequenos erros de digitação.

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "os", "as",
  "com", "em", "para", "p", "no", "na", "nos", "nas", "que", "the", "and"
]);

export const normalize = (s) =>
  (s == null ? "" : String(s))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const buildSearchBlob = (p) =>
  normalize(
    [
      p.nome,
      p.cod,
      p.categoria,
      p.subcategoria,
      p.tipo_anilha,
      p.tipo_furo,
      p.acabamento,
      p.pegada,
      p.barra_acabamento,
      p.bojo_formato,
      p.dumbell_tipo,
      p.piso_formato,
      p.tijolinho_tipo,
      p.suporte_modelo,
      Array.isArray(p.suporte_para) ? p.suporte_para.join(" ") : p.suporte_para,
      p.descricao_padrao,
      p.peso_faixa,
      p.peso || p.peso_kg ? `${p.peso || p.peso_kg}kg` : "",
    ]
      .filter((v) => v != null && v !== "")
      .join(" ")
  );

export const tokenize = (q) =>
  normalize(q).split(/\s+/).filter((t) => t && !STOPWORDS.has(t));

// Distância de Levenshtein limitada (early-exit quando excede o limite)
const levenshtein = (a, b, maxDist) => {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > maxDist) return maxDist + 1;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array(n + 1)
    .fill(0)
    .map((_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[n];
};

// Verifica se um token casa com alguma palavra do blob.
// Retorna um score: 3 = exato, 2 = prefixo, 1 = fuzzy, 0 = sem match.
const matchToken = (token, words) => {
  for (const w of words) {
    if (w === token) return 3;
  }
  for (const w of words) {
    if (w.startsWith(token)) return 2;
  }
  for (const w of words) {
    if (w.includes(token) && token.length >= 3) return 2;
  }
  const maxDist = token.length >= 6 ? 2 : 1;
  for (const w of words) {
    if (Math.abs(w.length - token.length) <= maxDist) {
      const d = levenshtein(token, w, maxDist);
      if (d <= maxDist) return 1;
    }
  }
  return 0;
};

export const searchProducts = (products, query) => {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const results = [];
  for (const p of products) {
    const blob = buildSearchBlob(p);
    const words = blob.split(/\s+/).filter(Boolean);
    let totalScore = 0;
    let allMatched = true;

    for (const token of tokens) {
      const s = matchToken(token, words);
      if (s === 0) {
        allMatched = false;
        break;
      }
      totalScore += s;
    }

    if (!allMatched) continue;

    // Bônus: tokens que casam no nome (campo principal) pesam mais
    const nomeWords = normalize(p.nome).split(/\s+/).filter(Boolean);
    let nameBonus = 0;
    for (const token of tokens) {
      if (nomeWords.some((w) => w === token || w.startsWith(token))) {
        nameBonus += 3;
      }
    }

    // Bônus: match exato no código
    const codNorm = normalize(p.cod);
    let codBonus = 0;
    if (codNorm && tokens.some((t) => codNorm.includes(t))) codBonus += 2;

    results.push({ product: p, score: totalScore + nameBonus + codBonus });
  }

  results.sort((a, b) => b.score - a.score);
  return results.map((r) => r.product);
};

// "Você quis dizer?" — sugere correções para tokens sem match
export const suggestCorrections = (products, query) => {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const allWords = new Set();
  products.forEach((p) => {
    normalize(p.nome)
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
      .forEach((w) => allWords.add(w));
  });

  const suggestions = [];
  const seen = new Set();
  for (const token of tokens) {
    if (token.length < 3) continue;
    let best = null;
    let bestDist = Infinity;
    for (const w of allWords) {
      if (w === token) continue;
      const maxD = Math.min(2, Math.floor(token.length / 3));
      const d = levenshtein(token, w, maxD);
      if (d > 0 && d <= maxD && d < bestDist) {
        bestDist = d;
        best = w;
      }
    }
    if (best && !seen.has(token)) {
      seen.add(token);
      suggestions.push({ from: token, to: best });
    }
  }
  return suggestions;
};

// Normalização que preserva o comprimento do texto (1:1 char a char).
// Usada para mapear posições de match de volta ao texto original no highlight.
const normalizePreserveLength = (s) =>
  (s == null ? "" : String(s))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ");

// Destaca os tokens encontrados no texto (retorna HTML para dangerouslySetInnerHTML)
export const highlightMatches = (text, query) => {
  const tokens = tokenize(query);
  if (tokens.length === 0) return text;
  const normText = normalizePreserveLength(text);
  if (normText.length !== text.length) return text;

  const ranges = [];
  for (const token of tokens) {
    let idx = normText.indexOf(token);
    while (idx !== -1) {
      ranges.push([idx, idx + token.length]);
      idx = normText.indexOf(token, idx + 1);
    }
  }
  if (ranges.length === 0) return text;
  ranges.sort((a, b) => a[0] - b[0]);

  const merged = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i][0] <= last[1]) {
      last[1] = Math.max(last[1], ranges[i][1]);
    } else {
      merged.push(ranges[i]);
    }
  }

  let html = "";
  let lastEnd = 0;
  for (const [start, end] of merged) {
    html += text.slice(lastEnd, start);
    html += `<mark class="bg-yellow-200 rounded px-0.5 font-semibold">${text.slice(
      start,
      end
    )}</mark>`;
    lastEnd = end;
  }
  html += text.slice(lastEnd);
  return html;
};