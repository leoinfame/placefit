// ─── Item 024: busca completa da gamificação (só painel) ──────────────────────
// Funções puras de filtro e ordenação. Nada aqui envia mensagem ou altera dados.
import { quandoUTC } from "./crmGamificacao.js";

export const ETAPAS_GAMIFICACAO = [
  { value: "novo", label: "Novo contato", color: "bg-slate-100 text-slate-700" },
  { value: "atendimento", label: "Em atendimento", color: "bg-blue-100 text-blue-700" },
  { value: "orcamento", label: "Orçamento", color: "bg-amber-100 text-amber-700" },
  { value: "aguardando_resposta", label: "Aguardando resposta", color: "bg-orange-100 text-orange-800" },
  { value: "negociacao", label: "Negociação", color: "bg-violet-100 text-violet-700" },
  { value: "ganho", label: "Venda ganha", color: "bg-emerald-100 text-emerald-700" },
  { value: "perdido", label: "Não convertido", color: "bg-rose-100 text-rose-700" }
];

export const SEMAFOROS_GAMIFICACAO = [
  { value: "conversa", label: "Em conversa" },
  { value: "esfriando", label: "Esfriando" },
  { value: "parado", label: "Parado" },
  { value: "recuperar", label: "Recuperar" },
  { value: "sem_regra", label: "Sem regra na etapa" }
];

export const ORDENACOES = [
  { value: "diasSemRetorno", label: "Dias sem retorno" },
  { value: "valor", label: "Valor do orçamento" },
  { value: "nome", label: "Ordem alfabética" },
  { value: "contatoCliente", label: "Última resposta do cliente" },
  { value: "contatoNosso", label: "Nosso último contato" },
  { value: "diasUltimoContato", label: "Dias desde o último contato" },
  { value: "criado", label: "Data do orçamento" },
  { value: "placar", label: "Placar (pontos)" },
  { value: "etapa", label: "Etapa do funil" }
];

export const FILTROS_VAZIOS = {
  busca: "",
  etapa: "todas",
  semaforo: "todos",
  valorMin: "",
  valorMax: "",
  diasMin: "",
  diasMax: "",
  criadoDe: "",
  criadoAte: "",
  contatoDe: "",
  contatoAte: "",
  passo: "todos",
  bot: "todos",
  ultimaMensagem: "todas",
  ordenarPor: "diasSemRetorno",
  direcao: "desc"
};

const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const numeroOuNulo = (v) => {
  const bruto = String(v ?? "").trim();
  if (!bruto) return null;
  const n = Number(bruto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const tempoDe = (iso) => {
  if (!iso) return 0;
  const t = quandoUTC(iso).getTime();
  return Number.isFinite(t) ? t : 0;
};

function dentroDoPeriodo(iso, de, ate) {
  if (!de && !ate) return true;
  const t = tempoDe(iso);
  if (!t) return false;
  if (de && t < new Date(de + "T00:00:00").getTime()) return false;
  if (ate && t > new Date(ate + "T00:00:00").getTime() + 86399999) return false;
  return true;
}

const textoDaLinha = (linha) => semAcento([
  linha.nome,
  linha.numero,
  linha.telefone,
  linha.etapa,
  linha.proximoPasso,
  ...(linha.orcamento?.itens || []).map((item) => item.nome || item.cod)
].join(" "));

const ORDEM_ETAPA = ETAPAS_GAMIFICACAO.map((e) => e.value);
const CAMPOS_DATA = ["criado", "contatoCliente", "contatoNosso"];

const valorDe = {
  nome: (l) => semAcento(l.nome),
  valor: (l) => Number(l.valor || 0),
  diasSemRetorno: (l) => Number(l.diasSemRetorno || 0),
  diasUltimoContato: (l) => Number(l.diasUltimoContato || 0),
  criado: (l) => tempoDe(l.criado),
  contatoCliente: (l) => tempoDe(l.ultimoContatoCliente),
  contatoNosso: (l) => tempoDe(l.ultimoContatoNosso),
  placar: (l) => Number(l.pontos || 0),
  etapa: (l) => ORDEM_ETAPA.indexOf(l.etapa || "novo")
};

export function ordenarLinhas(linhas, por = "diasSemRetorno", direcao = "desc") {
  const ler = valorDe[por] || valorDe.diasSemRetorno;
  const ehData = CAMPOS_DATA.includes(por);
  return [...linhas].sort((a, b) => {
    const va = ler(a);
    const vb = ler(b);
    if (ehData) {
      if (!va && !vb) return 0;
      if (!va) return 1;
      if (!vb) return -1;
    }
    const cmp = typeof va === "string" ? va.localeCompare(vb, "pt-BR") : va - vb;
    return direcao === "asc" ? cmp : -cmp;
  });
}

export function aplicarFiltros(linhas = [], filtros = {}) {
  const f = { ...FILTROS_VAZIOS, ...(filtros || {}) };
  const busca = semAcento(f.busca);
  const valorMin = numeroOuNulo(f.valorMin);
  const valorMax = numeroOuNulo(f.valorMax);
  const diasMin = numeroOuNulo(f.diasMin);
  const diasMax = numeroOuNulo(f.diasMax);

  const filtradas = linhas.filter((linha) => {
    if (busca && !textoDaLinha(linha).includes(busca)) return false;

    const valor = Number(linha.valor || 0);
    if (valorMin !== null && valor < valorMin) return false;
    if (valorMax !== null && valor > valorMax) return false;

    const dias = Number(linha.diasSemRetorno || 0);
    if (diasMin !== null && dias < diasMin) return false;
    if (diasMax !== null && dias > diasMax) return false;

    if (f.etapa !== "todas" && (linha.etapa || "novo") !== f.etapa) return false;

    if (f.semaforo !== "todos") {
      if (f.semaforo === "sem_regra") {
        if (linha.semaforoFaixa) return false;
      } else if (linha.semaforoFaixa !== f.semaforo) return false;
    }

    if (f.passo === "com" && !linha.passoRegistrado) return false;
    if (f.passo === "sem" && linha.passoRegistrado) return false;
    if (f.bot === "pausado" && !linha.pausado) return false;
    if (f.bot === "automatico" && linha.pausado) return false;

    // Quem falou por último: cliente esperando resposta, nós, ou sem mensagem.
    if (f.ultimaMensagem !== "todas") {
      if (f.ultimaMensagem === "sem") {
        if (linha.ultimaMensagemDe) return false;
      } else if (linha.ultimaMensagemDe !== f.ultimaMensagem) return false;
    }

    if (!dentroDoPeriodo(linha.criado, f.criadoDe, f.criadoAte)) return false;
    if (!dentroDoPeriodo(linha.ultimoContatoCliente, f.contatoDe, f.contatoAte)) return false;

    return true;
  });

  return ordenarLinhas(filtradas, f.ordenarPor, f.direcao);
}

export function contarFiltrosAtivos(filtros = {}) {
  const f = { ...FILTROS_VAZIOS, ...(filtros || {}) };
  return Object.keys(FILTROS_VAZIOS)
    .filter((chave) => chave !== "ordenarPor" && chave !== "direcao")
    .filter((chave) => String(f[chave] ?? "") !== String(FILTROS_VAZIOS[chave]) && String(f[chave] ?? "") !== "")
    .length;
}

export const ULTIMAS_MENSAGENS = [
  { value: "todas", label: "Todas as conversas" },
  { value: "cliente", label: "Cliente falou por último (esperando nós)" },
  { value: "nos", label: "Nós falamos por último" },
  { value: "sem", label: "Sem mensagem registrada" }
];

export const etapaInfo = (valor) =>
  ETAPAS_GAMIFICACAO.find((e) => e.value === (valor || "novo")) || ETAPAS_GAMIFICACAO[0];

export const semaforoLabel = (valor) =>
  SEMAFOROS_GAMIFICACAO.find((s) => s.value === valor)?.label || "Sem regra na etapa";