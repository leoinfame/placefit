// Checklist fiscal NF-e modelo 55 — validadores puros, sem efeito colateral.
//
// Este módulo NÃO grava nada, NÃO chama servidor nem provedor e NÃO decide
// tratamento tributário. Ele só avalia o que foi digitado/declarado e devolve
// pendências com motivo e ação. Toda "prontidão" aqui é SIMULAÇÃO local:
// a prontidão real será calculada no servidor (unidade 2).
//
// Testes: npx esbuild src/lib/fiscalChecklist.test.mjs --bundle --platform=node \
//   --outfile=/tmp/fiscalChecklist.test.mjs && node /tmp/fiscalChecklist.test.mjs

/** Emissão sempre bloqueada nesta fase, independentemente do checklist. */
export const EMISSAO_BLOQUEADA = true;

export const UFS: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35",
  PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
};

/** Código de Regime Tributário (CRT) da NF-e. Sempre escolhido e confirmado pelo contador. */
export const CRT_OPCOES = [
  { valor: "1", rotulo: "1 — Simples Nacional" },
  { valor: "2", rotulo: "2 — Simples Nacional, excesso de sublimite de receita bruta" },
  { valor: "3", rotulo: "3 — Regime Normal" },
  { valor: "4", rotulo: "4 — Simples Nacional, Microempreendedor Individual (MEI)" },
];

/** Estados do certificado A1. Só exibição: quem define é o servidor, nunca o navegador. */
export const A1_ESTADOS: Record<string, string> = {
  pendente: "Pendente — nenhum certificado recebido",
  recebido_canal_seguro: "Recebido em canal seguro — aguardando validação",
  validado: "Validado pelo servidor",
  expirado: "Expirado",
  incompativel: "Incompatível com o CNPJ do emitente",
};

/** Credenciamento é sempre declaração da revenda, nunca verificação na SEFAZ. */
export const CREDENCIAMENTO_ESTADOS: Record<string, string> = {
  nao_informado: "Não informado",
  declarado_credenciado: "Declarado credenciado pela revenda (não verificado na SEFAZ)",
  declarado_nao_credenciado: "Declarado não credenciado pela revenda",
};

/** Itens de tributação que dependem de confirmação do contador, por operação/item. */
export const ITENS_TRIBUTACAO = [
  { chave: "ncm", rotulo: "NCM de cada produto" },
  { chave: "cfop", rotulo: "CFOP por operação (interna, interestadual, consumidor final)" },
  { chave: "origem", rotulo: "Origem da mercadoria" },
  { chave: "unidade", rotulo: "Unidades comercial e tributável" },
  { chave: "cst_csosn", rotulo: "CST ou CSOSN por operação" },
  { chave: "base_aliquota", rotulo: "Bases de cálculo e alíquotas" },
  { chave: "st_difal", rotulo: "ICMS-ST e DIFAL, quando aplicáveis" },
  { chave: "frete", rotulo: "Tratamento do frete" },
  { chave: "desconto_pagamento", rotulo: "Desconto e formas de pagamento" },
  { chave: "ibs_cbs", rotulo: "IBS/CBS conforme as regras vigentes" },
];

export type Pendencia = {
  codigo: string;
  nivel: "cadastro" | "teste_local" | "provedor_homologacao" | "producao";
  motivo: string;
  acao: string;
};

export type DadosFiscais = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  uf?: string;
  municipio?: string;
  codigo_ibge?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  crt?: string;
  crt_confirmado_contador?: boolean;
  credenciamento?: string;
  credenciamento_data?: string;
  credenciamento_evidencia?: string;
  serie?: string;
  serie_confirmada_contador?: boolean;
  numeracao_confirmada_contador?: boolean;
  tributacao?: Record<string, boolean>;
  // Vêm do servidor numa fase futura; o navegador não define.
  a1_estado?: string;
};

// ── CNPJ (numérico e alfanumérico) ───────────────────────────────────────────

/** Remove máscara e espaços; letras em maiúsculas. */
export function normalizarCnpj(valor: string): string {
  return String(valor || "").toUpperCase().replace(/[.\-/\s]/g, "");
}

const PESOS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Valor do caractere no cálculo do DV: código ASCII menos 48 ("0"=0 … "9"=9, "A"=17 … "Z"=42). */
function valorCaractere(c: string): number {
  return c.charCodeAt(0) - 48;
}

function digitoVerificador(base: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i++) soma += valorCaractere(base[i]) * pesos[i];
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Valida CNPJ numérico ou alfanumérico: 12 posições [0-9A-Z] + 2 DVs numéricos,
 * DV por módulo 11 com valor do caractere = ASCII − 48 (regra da Receita Federal
 * para o CNPJ alfanumérico, que preserva o cálculo do CNPJ numérico).
 */
export function validarCnpj(valor: string): { ok: boolean; motivo?: string; normalizado: string } {
  const cnpj = normalizarCnpj(valor);
  if (!cnpj) return { ok: false, motivo: "CNPJ não informado", normalizado: cnpj };
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) {
    return { ok: false, motivo: "Formato inválido: 12 caracteres (letras ou números) seguidos de 2 dígitos", normalizado: cnpj };
  }
  if (/^(.)\1{13}$/.test(cnpj)) return { ok: false, motivo: "CNPJ com todos os caracteres iguais", normalizado: cnpj };
  const dv1 = digitoVerificador(cnpj, PESOS_DV1);
  const dv2 = digitoVerificador(cnpj.slice(0, 12) + dv1, PESOS_DV2);
  if (cnpj.slice(12) !== `${dv1}${dv2}`) return { ok: false, motivo: "Dígitos verificadores não conferem", normalizado: cnpj };
  return { ok: true, normalizado: cnpj };
}

export function formatarCnpj(valor: string): string {
  const c = normalizarCnpj(valor);
  if (c.length !== 14) return valor;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

// ── Demais campos ────────────────────────────────────────────────────────────

export function validarCep(valor: string): boolean {
  return /^\d{8}$/.test(String(valor || "").replace(/\D/g, ""));
}

/** Código IBGE de 7 dígitos cujo prefixo corresponde à UF informada. */
export function validarCodigoIbge(codigo: string, uf: string): { ok: boolean; motivo?: string } {
  const c = String(codigo || "").trim();
  if (!/^\d{7}$/.test(c)) return { ok: false, motivo: "Código IBGE deve ter 7 dígitos" };
  const prefixo = UFS[String(uf || "").toUpperCase()];
  if (!prefixo) return { ok: false, motivo: "Informe a UF antes do código IBGE" };
  if (!c.startsWith(prefixo)) return { ok: false, motivo: `Código IBGE não pertence à UF ${uf}` };
  return { ok: true };
}

/** Série da NF-e: número de 0 a 999. Faixas reservadas não são aceitas para emissão normal. */
export function validarSerie(serie: string): { ok: boolean; motivo?: string } {
  const s = String(serie ?? "").trim();
  if (!/^\d{1,3}$/.test(s)) return { ok: false, motivo: "Série deve ser um número de 0 a 999" };
  const n = Number(s);
  if (n >= 890) return { ok: false, motivo: "Séries 890 a 999 são reservadas (avulsa/contingência)" };
  return { ok: true };
}

// ── Prontidão (simulação local) ──────────────────────────────────────────────

export function avaliarProntidao(d: DadosFiscais) {
  const pendencias: Pendencia[] = [];
  const add = (codigo: string, nivel: Pendencia["nivel"], motivo: string, acao: string) =>
    pendencias.push({ codigo, nivel, motivo, acao });

  // Nível 1 — cadastro completo
  const cnpj = validarCnpj(d.cnpj || "");
  if (!cnpj.ok) add("cnpj", "cadastro", cnpj.motivo || "CNPJ inválido", "Informar o CNPJ do emitente conforme o cartão CNPJ");
  if (!String(d.razao_social || "").trim()) add("razao_social", "cadastro", "Razão social não informada", "Informar a razão social conforme o cartão CNPJ");
  if (!String(d.inscricao_estadual || "").trim()) add("inscricao_estadual", "cadastro", "Inscrição Estadual não informada", "Obter com o contador a IE do emitente");
  const uf = String(d.uf || "").toUpperCase();
  if (!UFS[uf]) add("uf", "cadastro", "UF não informada ou inválida", "Informar a UF do estabelecimento emitente");
  if (!String(d.municipio || "").trim()) add("municipio", "cadastro", "Município não informado", "Informar o município do emitente");
  const ibge = validarCodigoIbge(d.codigo_ibge || "", uf);
  if (!ibge.ok) add("codigo_ibge", "cadastro", ibge.motivo || "Código IBGE inválido", "Conferir o código IBGE do município");
  if (!String(d.logradouro || "").trim() || !String(d.numero || "").trim() || !String(d.bairro || "").trim()) {
    add("endereco", "cadastro", "Endereço incompleto", "Informar logradouro, número e bairro do emitente");
  }
  if (!validarCep(d.cep || "")) add("cep", "cadastro", "CEP ausente ou inválido", "Informar o CEP com 8 dígitos");
  if (!d.crt) add("crt", "cadastro", "CRT não escolhido", "Escolher o CRT indicado pelo contador");
  const cadastroCompleto = pendencias.length === 0;

  // Nível 2 — pronto para teste local (simulação; nada é enviado)
  if (d.crt && !d.crt_confirmado_contador) add("crt_contador", "teste_local", "CRT não confirmado pelo contador", "Pedir ao contador a confirmação do regime");
  const serie = validarSerie(d.serie || "");
  if (!serie.ok) add("serie", "teste_local", serie.motivo || "Série inválida", "Definir a série com o contador");
  else if (!d.serie_confirmada_contador) add("serie_contador", "teste_local", "Série não confirmada pelo contador", "Pedir ao contador a confirmação da série");
  if (!d.numeracao_confirmada_contador) {
    add("numeracao", "teste_local", "Numeração não confirmada (por CNPJ + modelo + ambiente)", "Definir com o contador e o provedor quem controla a numeração");
  }
  for (const item of ITENS_TRIBUTACAO) {
    if (!d.tributacao?.[item.chave]) add(`trib_${item.chave}`, "teste_local", `${item.rotulo}: não confirmado`, "Obter a regra com o contador; o sistema não aplica padrão");
  }
  const prontoTesteLocal = pendencias.length === 0;

  // Nível 3 — habilitado no provedor (homologação): depende do servidor; sempre pendente nesta fase
  if (d.credenciamento !== "declarado_credenciado") {
    add("credenciamento", "provedor_homologacao", "Credenciamento NF-e 55 na UF não declarado", "Revenda declarar o credenciamento com data e evidência");
  } else if (!d.credenciamento_data || !String(d.credenciamento_evidencia || "").trim()) {
    add("credenciamento_evidencia", "provedor_homologacao", "Credenciamento declarado sem data ou evidência", "Informar data e evidência da confirmação");
  }
  if (d.a1_estado !== "validado") {
    add("a1", "provedor_homologacao", A1_ESTADOS[d.a1_estado || "pendente"] || A1_ESTADOS.pendente, "Envio do A1 só por canal seguro, em etapa própria");
  }
  add("provedor", "provedor_homologacao", "Integração com provedor não implementada", "Aguardar as unidades 2 e 3 (servidor e adaptador)");

  // Nível 4 — produção: fora do escopo atual
  add("producao", "producao", "Produção fora do escopo desta fase", "Exige homologação comprovada e nova autorização");

  return {
    cadastroCompleto,
    prontoTesteLocal,
    habilitadoProvedorHomologacao: false,
    prontoProducao: false,
    emissaoPermitida: !EMISSAO_BLOQUEADA && false,
    pendencias,
  };
}
