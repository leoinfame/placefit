// ─── Consulta pública de CNPJ e CEP (BrasilAPI) ─────────────────────────────
// Item 009 / spec 5.1: ao receber um CNPJ, o gerente consulta a base pública
// ANTES de perguntar qualquer coisa. Mesma API que as telas de Clientes e
// Configuração Fiscal já usam no painel. Nunca lança: falha vira null.

const TIMEOUT_MS = 8000;
const digitos = (s: string) => String(s || '').replace(/\D/g, '');

export type DadosCnpj = {
  razao_social: string;
  nome_fantasia: string;
  endereco: string;
  numero_ausente: boolean;
  cidade: string;
  estado: string;
  cep: string;
  telefone: string;
};

async function getJson(url: string): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const formatarCep = (c: string) => {
  const d = digitos(c);
  return d.length === 8 ? d.slice(0, 5) + '-' + d.slice(5) : '';
};

/** Converte a resposta da BrasilAPI no formato do cadastro de Cliente. */
export function dadosDoCnpj(j: any): DadosCnpj | null {
  if (!j || !String(j.razao_social || '').trim()) return null;
  const numero = String(j.numero || '').trim();
  const semNumero = !numero || /^(s\/?n|sn|sem numero|sem número|0+)$/i.test(numero);
  let logradouro = String(j.logradouro || '').trim();
  const tipo = String(j.descricao_tipo_de_logradouro || '').trim();
  if (tipo && logradouro && !logradouro.toUpperCase().startsWith(tipo.toUpperCase())) logradouro = `${tipo} ${logradouro}`;
  const endereco = [
    logradouro ? `${logradouro}, ${semNumero ? 'S/N' : numero}` : '',
    String(j.complemento || '').trim(),
    String(j.bairro || '').trim()
  ].filter(Boolean).join(' - ');
  return {
    razao_social: String(j.razao_social).trim(),
    nome_fantasia: String(j.nome_fantasia || '').trim(),
    endereco,
    numero_ausente: semNumero,
    cidade: String(j.municipio || '').trim(),
    estado: String(j.uf || '').trim().toUpperCase(),
    cep: formatarCep(j.cep),
    telefone: digitos(j.ddd_telefone_1 || '')
  };
}

export async function consultarCnpj(cnpj: string): Promise<DadosCnpj | null> {
  const d = digitos(cnpj);
  if (d.length !== 14) return null;
  return dadosDoCnpj(await getJson(`https://brasilapi.com.br/api/cnpj/v1/${d}`));
}

/** CEP → cidade/UF (para frete quando a entrega é em outro lugar). */
export async function consultarCep(cep: string): Promise<{ cidade: string; estado: string; cep: string } | null> {
  const d = digitos(cep);
  if (d.length !== 8) return null;
  const j = await getJson(`https://brasilapi.com.br/api/cep/v2/${d}`);
  if (!j?.state) return null;
  return { cidade: String(j.city || '').trim(), estado: String(j.state).trim().toUpperCase(), cep: formatarCep(d) };
}
