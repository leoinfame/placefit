// Etapas do funil comercial do CRM, configuráveis por conta (entidade CRMEtapa).
// As sete etapas padrão nascem com sistema: true — nome, cor e ordem são livres,
// mas a exclusão não, porque a automação do funil grava essas chaves.
import { base44 } from "@/api/base44Client";

export const PALETA = {
  slate: { color: "bg-slate-100 text-slate-700", dot: "bg-slate-400", label: "Cinza" },
  blue: { color: "bg-blue-100 text-blue-700", dot: "bg-blue-500", label: "Azul" },
  cyan: { color: "bg-cyan-100 text-cyan-700", dot: "bg-cyan-500", label: "Ciano" },
  teal: { color: "bg-teal-100 text-teal-700", dot: "bg-teal-500", label: "Turquesa" },
  emerald: { color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", label: "Verde" },
  amber: { color: "bg-amber-100 text-amber-700", dot: "bg-amber-500", label: "Âmbar" },
  orange: { color: "bg-orange-100 text-orange-800", dot: "bg-orange-500", label: "Laranja" },
  rose: { color: "bg-rose-100 text-rose-700", dot: "bg-rose-500", label: "Vermelho" },
  violet: { color: "bg-violet-100 text-violet-700", dot: "bg-violet-500", label: "Violeta" },
  indigo: { color: "bg-indigo-100 text-indigo-700", dot: "bg-indigo-500", label: "Índigo" },
  pink: { color: "bg-pink-100 text-pink-700", dot: "bg-pink-500", label: "Rosa" }
};

export const CORES = Object.entries(PALETA).map(([valor, item]) => ({ valor, label: item.label }));

export const ETAPAS_PADRAO = [
  { chave: "novo", nome: "Novo contato", cor: "slate", sistema: true },
  { chave: "atendimento", nome: "Atendimento", cor: "blue", sistema: true },
  { chave: "orcamento", nome: "Orçamento", cor: "amber", sistema: true },
  { chave: "aguardando_resposta", nome: "Aguardando resposta", cor: "orange", sistema: true },
  { chave: "negociacao", nome: "Negociação", cor: "violet", sistema: true },
  { chave: "ganho", nome: "Venda ganha", cor: "emerald", sistema: true },
  { chave: "perdido", nome: "Não convertido", cor: "rose", sistema: true }
];

export const visualDaEtapa = (cor) => PALETA[cor] || PALETA.slate;

export const chaveDeEtapa = (nome) =>
  String(nome || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export const ordenarEtapas = (rows = []) =>
  [...rows].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0) || String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));

// Carrega as etapas da conta e, na primeira abertura, cria as sete padrão.
export async function carregarEtapas(ownerId) {
  const resposta = await base44.entities.CRMEtapa.filter({ owner_id: ownerId, ativo: true }, "ordem", 200).catch(() => []);
  const rows = Array.isArray(resposta) ? resposta : (resposta?.items || []);
  if (rows.length) return ordenarEtapas(rows);
  const criadas = await base44.entities.CRMEtapa.bulkCreate(
    ETAPAS_PADRAO.map((etapa, indice) => ({ owner_id: ownerId, ...etapa, ordem: indice, ativo: true }))
  ).catch(() => []);
  return ordenarEtapas(Array.isArray(criadas) ? criadas : (criadas?.items || []));
}