// Custos do sistema (só admin): regras de vencimento usadas pela tela e pelo alerta do Dashboard.
// Gestão manual: CustoSistema = o que é cobrado todo mês; CustoPagamento = baixa de um mês (AAAA-MM).

export const MOEDAS = { BRL: "R$", USD: "US$", EUR: "€" };
export const DIAS_ALERTA = 7;

export const fmtValor = (v, moeda = "BRL") =>
  `${MOEDAS[moeda] || moeda} ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pad = (n) => String(n).padStart(2, "0");
export const competenciaDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const fmtData = (d) => (d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` : "");
export const fmtCompetencia = (c) => {
  const [a, m] = String(c || "").split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return a && m ? `${nomes[Number(m) - 1]}/${a}` : c;
};

// Vencimento de um custo numa competência; dia 31 em mês de 30 vira o último dia.
export const vencimentoEm = (custo, competencia) => {
  const [a, m] = competencia.split("-").map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const dia = Math.min(Math.max(Number(custo.dia_vencimento) || 1, 1), ultimo);
  return new Date(a, m - 1, dia);
};

const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diasAte = (alvo, hoje) => Math.round((inicioDoDia(alvo) - inicioDoDia(hoje)) / 86400000);

// Situação de cada custo ativo no mês escolhido + o que vence nos próximos dias (pode cair no mês seguinte).
export function situacaoDoMes(custos, pagamentos, competencia, hoje = new Date()) {
  const pagosPor = {};
  for (const p of pagamentos) {
    const k = `${p.custo_id}|${p.competencia}`;
    (pagosPor[k] = pagosPor[k] || []).push(p);
  }
  const ativos = custos.filter((c) => c.status !== "pausado");
  const linhas = ativos.map((c) => {
    const venc = vencimentoEm(c, competencia);
    const pags = pagosPor[`${c.id}|${competencia}`] || [];
    const dias = diasAte(venc, hoje);
    const criado = c.created_date ? inicioDoDia(new Date(c.created_date)) : null;
    let situacao = "a_vencer";
    if (pags.length) situacao = "pago";
    else if (dias < 0 && criado && venc < criado) situacao = "antes_cadastro";
    else if (dias < 0) situacao = "vencido";
    else if (dias <= DIAS_ALERTA) situacao = "proximo";
    return { custo: c, vencimento: venc, dias, pagamentos: pags, pago: pags.reduce((s, p) => s + (Number(p.valor_pago) || 0), 0), situacao };
  });

  // Totais separados por moeda (sem conversão automática)
  const totais = {};
  for (const l of linhas) {
    const m = l.custo.moeda || "BRL";
    const t = (totais[m] = totais[m] || { previsto: 0, pago: 0, aberto: 0 });
    t.previsto += Number(l.custo.valor_mensal) || 0;
    t.pago += l.pago;
    if (l.situacao !== "pago") t.aberto += Number(l.custo.valor_mensal) || 0;
  }
  return { linhas: linhas.sort((a, b) => a.vencimento - b.vencimento), totais };
}

// Alertas a partir de HOJE: vencidos sem baixa (mês atual e anterior) e o que vence nos próximos 7 dias.
export function alertasCustos(custos, pagamentos, hoje = new Date()) {
  const pagos = new Set(pagamentos.map((p) => `${p.custo_id}|${p.competencia}`));
  const meses = [-1, 0, 1].map((k) => competenciaDe(new Date(hoje.getFullYear(), hoje.getMonth() + k, 1)));
  const out = [];
  for (const c of custos) {
    if (c.status === "pausado") continue;
    // custo criado depois de um vencimento não "nasce" atrasado
    const criado = c.created_date ? inicioDoDia(new Date(c.created_date)) : null;
    for (const comp of meses) {
      if (pagos.has(`${c.id}|${comp}`)) continue;
      const venc = vencimentoEm(c, comp);
      if (criado && venc < criado) continue;
      const dias = diasAte(venc, hoje);
      if (dias < 0) out.push({ tipo: "vencido", custo: c, competencia: comp, vencimento: venc, dias });
      else if (dias <= DIAS_ALERTA) out.push({ tipo: "proximo", custo: c, competencia: comp, vencimento: venc, dias });
    }
  }
  return out.sort((a, b) => a.vencimento - b.vencimento);
}
