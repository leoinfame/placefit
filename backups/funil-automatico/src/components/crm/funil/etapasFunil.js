// Etapas do funil comercial do CRM e ajudantes de tempo usados nos cards.
// Fica em um módulo próprio para o quadro arrastável e a tela do CRM usarem
// exatamente a mesma lista de etapas.
export const STAGES = [
  { value: "novo", label: "Novo contato", color: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  { value: "atendimento", label: "Em atendimento", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  { value: "orcamento", label: "Orçamento", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  { value: "aguardando_resposta", label: "Aguardando resposta", color: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
  { value: "negociacao", label: "Negociação", color: "bg-violet-100 text-violet-700", dot: "bg-violet-500" },
  { value: "ganho", label: "Venda ganha", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  { value: "perdido", label: "Não convertido", color: "bg-rose-100 text-rose-700", dot: "bg-rose-500" }
];

export const stageFor = (value) => STAGES.find((item) => item.value === value) || STAGES[0];

export const quandoUTC = (s) => new Date(/Z|[+-]\d\d:?\d\d$/.test(String(s)) ? s : String(s) + "Z");

export const tempoDesde = (iso, agora) => {
  if (!iso) return "";
  const min = Math.max(0, Math.floor((agora - quandoUTC(iso).getTime()) / 60000));
  if (min < 60) return min + " min";
  const h = Math.floor(min / 60);
  if (h < 24) return h + "h";
  const d = Math.floor(h / 24);
  const resto = h % 24;
  return d + "d" + (resto ? " " + resto + "h" : "");
};

export const corDoTempo = (iso, agora) => {
  const horas = (agora - quandoUTC(iso).getTime()) / 3600000;
  if (horas >= 72) return "bg-red-100 text-red-700";
  if (horas >= 24) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
};