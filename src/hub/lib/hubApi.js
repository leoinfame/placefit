import { base44 } from "@/api/base44Client";

// Toda gravacao do Hub passa pela funcao hubApi (o servidor confere perfil e sequencia).
export async function hub(acao, dados = {}) {
  try {
    const r = await base44.functions.invoke("hubApi", { acao, ...dados });
    return r.data;
  } catch (e) {
    throw new Error(e?.response?.data?.error || e?.message || "Erro no Hub");
  }
}

export const ROTULO_STATUS = {
  aguardando_pronto: "Aguardando fabricante",
  disponivel: "Na fila",
  aceita: "Aceita",
  janela_confirmada: "Janela confirmada",
  coletada: "Coletada",
  entregue_base: "Na base",
  conferida: "Conferida",
  falsa_coleta: "Falsa coleta",
  cancelada: "Cancelada",
  aguardando_consolidacao: "Aguardando consolidação",
  consolidado: "Consolidado",
  aceito: "Aceito",
  retirado: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const COR_STATUS = {
  aguardando_pronto: "bg-slate-100 text-slate-700",
  disponivel: "bg-blue-100 text-blue-800",
  aceita: "bg-indigo-100 text-indigo-800",
  janela_confirmada: "bg-indigo-100 text-indigo-800",
  coletada: "bg-amber-100 text-amber-800",
  entregue_base: "bg-orange-100 text-orange-800",
  conferida: "bg-emerald-100 text-emerald-800",
  falsa_coleta: "bg-red-100 text-red-800",
  cancelada: "bg-slate-200 text-slate-500",
  aguardando_consolidacao: "bg-slate-100 text-slate-700",
  consolidado: "bg-teal-100 text-teal-800",
  aceito: "bg-indigo-100 text-indigo-800",
  retirado: "bg-amber-100 text-amber-800",
  entregue: "bg-emerald-100 text-emerald-800",
  cancelado: "bg-slate-200 text-slate-500",
};

export const ROTULO_EVENTO = {
  coletado_no_fabricante: "Coletado no fabricante",
  entregue_na_base: "Entregue na base",
  conferido: "Conferido",
  pedido_consolidado: "Pedido consolidado",
  retirado_pelo_fretista: "Retirado pelo fretista",
  entregue_ao_cliente: "Entregue ao cliente",
  falsa_coleta: "Falsa coleta",
};

export const brl = (v) =>
  v || v === 0 ? Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "a definir";

export const dataHora = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

export const linkWhats = (numero, texto = "") => {
  const n = String(numero || "").replace(/\D/g, "");
  if (!n) return null;
  return `https://wa.me/${n.startsWith("55") ? n : "55" + n}${texto ? "?text=" + encodeURIComponent(texto) : ""}`;
};

export const linkMapa = (endereco) =>
  endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}` : null;

// Peso como o coletor/fretista deve ler: estimado pelo catalogo vem com "≈"; estimativa parcial com "≥".
export function textoPeso(x) {
  if (!x?.peso_kg) return null;
  const kg = `${Number(x.peso_kg).toLocaleString("pt-BR")} kg`;
  if (x.peso_origem === "estimado") return `≈ ${kg}`;
  if (x.peso_origem === "estimado_parcial") return `≥ ${kg} (parcial)`;
  return kg;
}

// Mesma regra do servidor (conferirChecklist), so para mostrar a divergencia antes de confirmar.
export function previaDivergencia(itens, marcados) {
  return itens
    .map((it, i) => {
      const esperado = Number(it.quantidade) || 1;
      const m = marcados[i] || {};
      const recebido = m.ok ? esperado : Math.max(0, Math.min(esperado, Math.floor(Number(m.quantidade_recebida) || 0)));
      if (recebido === esperado) return null;
      return recebido === 0 ? `Faltou ${esperado}x ${it.nome || it.cod}` : `Veio ${recebido} de ${esperado}: ${it.nome || it.cod}`;
    })
    .filter(Boolean);
}
