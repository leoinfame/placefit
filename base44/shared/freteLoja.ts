// Tabela de frete MuscularFit (origem Claudio/MG) aplicada ao e-commerce PlaceFit.
// Sem frete gratis. Cargas ate 500kg pagam o tarifa minima do estado;
// acima de 500kg paga-se por kg (capital ou interior).
// Fonte: https://muscularfit.com.br/categorias/frete.html (2026)

export const FRETE_TABELA: Record<string, { min: number; capital_kg: number; interior_kg: number }> = {
  SP: { min: 450, capital_kg: 1.30, interior_kg: 1.40 },
  MG: { min: 450, capital_kg: 1.20, interior_kg: 1.30 },
  RJ: { min: 550, capital_kg: 1.30, interior_kg: 1.50 },
  ES: { min: 550, capital_kg: 1.20, interior_kg: 1.40 },
  PR: { min: 500, capital_kg: 1.40, interior_kg: 1.45 },
  SC: { min: 550, capital_kg: 1.45, interior_kg: 1.50 },
  RS: { min: 650, capital_kg: 1.50, interior_kg: 1.70 },
  DF: { min: 550, capital_kg: 1.20, interior_kg: 1.30 },
  GO: { min: 650, capital_kg: 1.30, interior_kg: 1.40 },
  MS: { min: 850, capital_kg: 2.20, interior_kg: 2.50 },
  MT: { min: 850, capital_kg: 2.30, interior_kg: 2.60 },
  BA: { min: 700, capital_kg: 1.20, interior_kg: 1.20 },
  CE: { min: 750, capital_kg: 1.20, interior_kg: 1.40 },
  PE: { min: 700, capital_kg: 1.20, interior_kg: 1.20 },
  MA: { min: 650, capital_kg: 1.50, interior_kg: 1.90 },
  PI: { min: 650, capital_kg: 1.50, interior_kg: 1.90 },
  PA: { min: 550, capital_kg: 1.40, interior_kg: 1.80 },
  AM: { min: 950, capital_kg: 3.40, interior_kg: 3.80 },
  RR: { min: 950, capital_kg: 3.40, interior_kg: 3.80 },
  AP: { min: 950, capital_kg: 3.40, interior_kg: 3.80 },
  // Estados nao listados explicitamente na tabela — estimativa regional:
  AL: { min: 700, capital_kg: 1.20, interior_kg: 1.40 },
  PB: { min: 700, capital_kg: 1.20, interior_kg: 1.40 },
  RN: { min: 750, capital_kg: 1.20, interior_kg: 1.40 },
  SE: { min: 700, capital_kg: 1.20, interior_kg: 1.40 },
  AC: { min: 950, capital_kg: 3.40, interior_kg: 3.80 },
  RO: { min: 950, capital_kg: 3.40, interior_kg: 3.80 },
  TO: { min: 650, capital_kg: 1.50, interior_kg: 1.90 },
};

export const CAPITAIS: Record<string, string> = {
  AC: "rio branco", AL: "maceio", AP: "macapa", AM: "manaus", BA: "salvador",
  CE: "fortaleza", DF: "brasilia", ES: "vitoria", GO: "goiania", MA: "sao luis",
  MT: "cuiaba", MS: "campo grande", MG: "belo horizonte", PA: "belem",
  PB: "joao pessoa", PR: "curitiba", PE: "recife", PI: "teresina",
  RJ: "rio de janeiro", RN: "natal", RS: "porto alegre", RO: "porto velho",
  RR: "boa vista", SC: "florianopolis", SP: "sao paulo", SE: "aracaju", TO: "palmas",
};

const norm = (s: string): string => (s || "")
  .trim().toLowerCase()
  .replace(/á|à|â|ã/g, "a").replace(/é|è|ê/g, "e").replace(/í|ì|î/g, "i")
  .replace(/ó|ò|ô|õ/g, "o").replace(/ú|ù|û/g, "u").replace(/ç/g, "c");

export const isCapital = (estado: string, cidade: string): boolean => {
  const uf = (estado || "").toUpperCase().trim();
  const cap = CAPITAIS[uf];
  if (!cap) return false;
  return norm(cidade) === cap;
};

// Retorna o valor do frete em R$, ou null quando nao eh possivel calcular
// (estado vazio ou fora da tabela).
export const computeFreteLoja = (estado: string, pesoKg: number, cidade?: string): number | null => {
  const uf = (estado || "").toUpperCase().trim();
  if (!uf) return null;
  const t = FRETE_TABELA[uf];
  if (!t) return null;
  const peso = Math.max(0, Number(pesoKg) || 0);
  // Ate 500kg: tarifa minima do estado. Acima de 500kg: preco por kg.
  if (peso <= 500) return t.min;
  const porKg = isCapital(uf, cidade || "") ? t.capital_kg : t.interior_kg;
  return Math.round(peso * porKg * 100) / 100;
};