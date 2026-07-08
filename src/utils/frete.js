// Capitais dos 27 estados brasileiros — usado para diferenciar preço capital x interior
export const CAPITAIS_POR_UF = {
  AC: "Rio Branco",
  AL: "Maceió",
  AP: "Macapá",
  AM: "Manaus",
  BA: "Salvador",
  CE: "Fortaleza",
  DF: "Brasília",
  ES: "Vitória",
  GO: "Goiânia",
  MA: "São Luís",
  MT: "Cuiabá",
  MS: "Campo Grande",
  MG: "Belo Horizonte",
  PA: "Belém",
  PB: "João Pessoa",
  PR: "Curitiba",
  PE: "Recife",
  PI: "Teresina",
  RJ: "Rio de Janeiro",
  RN: "Natal",
  RS: "Porto Alegre",
  RO: "Porto Velho",
  RR: "Boa Vista",
  SC: "Florianópolis",
  SP: "São Paulo",
  SE: "Aracaju",
  TO: "Palmas",
};

// Nome completo do estado (sem acento/espaço) -> UF, para quando o cadastro do cliente usa o nome por extenso
const NOME_PARA_UF = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  distritofederal: "DF",
  espiritosanto: "ES",
  goias: "GO",
  maranhao: "MA",
  matogrosso: "MT",
  matogrossodosul: "MS",
  minasgerais: "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  riodejaneiro: "RJ",
  riograndedonorte: "RN",
  riograndedosul: "RS",
  rondonia: "RO",
  roraima: "RR",
  santacatarina: "SC",
  saopaulo: "SP",
  sergipe: "SE",
  tocantins: "TO",
};

const normalizar = (s) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

// Aceita tanto a sigla (SP) quanto o nome por extenso (São Paulo) vindos do cadastro do cliente
export function resolverUF(estado) {
  if (!estado) return null;
  const sigla = estado.trim().toUpperCase();
  if (CAPITAIS_POR_UF[sigla]) return sigla;
  return NOME_PARA_UF[normalizar(estado)] || null;
}

export function ehCapital(uf, cidade) {
  if (!uf || !cidade) return false;
  return normalizar(CAPITAIS_POR_UF[uf]) === normalizar(cidade);
}

/**
 * Sugere o valor do frete com base na tabela cadastrada (TabelaFrete), no estado/cidade
 * do cliente e no peso total do pedido.
 *
 * Regra: até o peso_limite (padrão 500kg) cobra o valor_minimo fixo da faixa; acima disso,
 * multiplica o peso total pelo preço/kg (capital ou interior, conforme a cidade do cliente).
 *
 * Retorna null se não houver faixa cadastrada e ativa para o estado do cliente.
 */
export function sugerirFrete({ estado, cidade, pesoTotal, tabelaFrete }) {
  const uf = resolverUF(estado);
  if (!uf || !Array.isArray(tabelaFrete)) return null;

  const faixa = tabelaFrete.find((f) => f.estado === uf && f.ativo !== false);
  if (!faixa) return null;

  const pesoLimite = faixa.peso_limite || 500;
  const capital = ehCapital(uf, cidade);
  const peso = pesoTotal || 0;

  const valor =
    peso <= pesoLimite
      ? faixa.valor_minimo
      : peso * (capital ? faixa.preco_kg_capital : faixa.preco_kg_interior);

  return { valor, uf, capital, pesoLimite, faixa };
}
