// ─── Item 024: gamificação do CRM (só painel) ────────────────────────────────
// Regras transparentes: todo ponto exibido tem um motivo em frase. Nada aqui
// envia mensagem — sugestões de follow-up são texto para copiar e enviar à mão.

export const CONFIG_PADRAO = {
  limite_atendimento_dias: 2,
  limite_orcamento_dias: 2,
  limite_negociacao_dias: 5,
  valor_alto: 5000,
  valor_alto_pontos: 20,
  valor_medio: 2000,
  valor_medio_pontos: 10,
  contato_recente_pontos: 20,
  contato_tres_dias_pontos: 10,
  penalidade_dia_sem_retorno: 10
};

export const ETAPAS_COM_REGRA = ["atendimento", "orcamento", "negociacao"];

export const SEMAFORO = {
  conversa: { label: "Em conversa", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  esfriando: { label: "Esfriando", color: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  parado: { label: "Parado", color: "bg-orange-100 text-orange-800", dot: "bg-orange-500" },
  recuperar: { label: "Recuperar", color: "bg-rose-100 text-rose-700", dot: "bg-rose-500" }
};

export const quandoUTC = (s) => new Date(/Z|[+-]\d\d:?\d\d$/.test(String(s)) ? s : String(s) + "Z");
export const somenteDigitos = (v) => String(v || "").replace(/\D/g, "");

export function diasDesde(iso, agora = Date.now()) {
  if (!iso) return 0;
  const t = quandoUTC(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((agora - t) / 86400000));
}

export const brl = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

const numero = (v, padrao) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : padrao);

export function configEfetiva(row) {
  const c = row || {};
  return {
    limite_atendimento_dias: numero(c.limite_atendimento_dias, CONFIG_PADRAO.limite_atendimento_dias),
    limite_orcamento_dias: numero(c.limite_orcamento_dias, CONFIG_PADRAO.limite_orcamento_dias),
    limite_negociacao_dias: numero(c.limite_negociacao_dias, CONFIG_PADRAO.limite_negociacao_dias),
    valor_alto: numero(c.valor_alto, CONFIG_PADRAO.valor_alto),
    valor_alto_pontos: numero(c.valor_alto_pontos, CONFIG_PADRAO.valor_alto_pontos),
    valor_medio: numero(c.valor_medio, CONFIG_PADRAO.valor_medio),
    valor_medio_pontos: numero(c.valor_medio_pontos, CONFIG_PADRAO.valor_medio_pontos),
    contato_recente_pontos: numero(c.contato_recente_pontos, CONFIG_PADRAO.contato_recente_pontos),
    contato_tres_dias_pontos: numero(c.contato_tres_dias_pontos, CONFIG_PADRAO.contato_tres_dias_pontos),
    penalidade_dia_sem_retorno: numero(c.penalidade_dia_sem_retorno, CONFIG_PADRAO.penalidade_dia_sem_retorno)
  };
}

/** Placar com motivo por ponto — nenhuma fórmula escondida. */
export function calcularPlacar({ orcamento, diasSemRetorno = 0, diasUltimoContato = 0, config }) {
  const cfg = config || CONFIG_PADRAO;
  if (!orcamento) {
    return { pontos: 0, motivos: [{ pontos: 0, motivo: "Sem orçamento em aberto: o placar começa quando sai o orçamento" }] };
  }
  const motivos = [];
  const total = Number(orcamento.total || 0);
  if (total >= cfg.valor_alto) {
    motivos.push({ pontos: cfg.valor_alto_pontos, motivo: `orçamento acima de ${brl(cfg.valor_alto)}` });
  } else if (total >= cfg.valor_medio) {
    motivos.push({ pontos: cfg.valor_medio_pontos, motivo: `orçamento acima de ${brl(cfg.valor_medio)}` });
  } else {
    motivos.push({ pontos: 0, motivo: `orçamento de ${brl(total)}, abaixo de ${brl(cfg.valor_medio)}` });
  }

  if (diasUltimoContato <= 1) {
    motivos.push({ pontos: cfg.contato_recente_pontos, motivo: "último contato nas últimas 24h" });
  } else if (diasUltimoContato <= 3) {
    motivos.push({ pontos: cfg.contato_tres_dias_pontos, motivo: `último contato há ${diasUltimoContato} dias` });
  } else {
    motivos.push({ pontos: 0, motivo: `último contato há ${diasUltimoContato} dias` });
  }

  if (diasSemRetorno >= 1) {
    motivos.push({
      pontos: -diasSemRetorno * cfg.penalidade_dia_sem_retorno,
      motivo: `${diasSemRetorno} ${diasSemRetorno === 1 ? "dia" : "dias"} sem retorno do cliente (−${cfg.penalidade_dia_sem_retorno}/dia)`
    });
  } else {
    motivos.push({ pontos: 0, motivo: "cliente em dia: sem dias parados sem retorno" });
  }

  return { pontos: motivos.reduce((soma, m) => soma + m.pontos, 0), motivos };
}

export function limiteDaEtapa(etapa, config) {
  const cfg = config || CONFIG_PADRAO;
  if (etapa === "atendimento") return cfg.limite_atendimento_dias;
  if (etapa === "orcamento") return cfg.limite_orcamento_dias;
  if (etapa === "negociacao") return cfg.limite_negociacao_dias;
  return 0;
}

/** Semáforo contado da última atividade da conversa. */
export function semaforoDaConversa(etapa, diasParado, config) {
  const limite = limiteDaEtapa(etapa, config);
  if (!limite) return null;
  const faixa =
    diasParado <= limite ? "conversa" :
    diasParado <= limite * 2 ? "esfriando" :
    diasParado <= limite * 3 ? "parado" : "recuperar";
  return { faixa, limite, diasParado, ...SEMAFORO[faixa] };
}

export const NAO_IDENTIFICADO = "Não identificado";

/** Nome exibido: nome do orçamento, do cadastro ou da conversa. Nunca inventa número. */
export function nomeExibicaoCliente({ orcamento, cliente, conversa }) {
  const doOrcamento = String(orcamento?.cliente_nome || "").trim();
  if (doOrcamento) return doOrcamento;
  const doCadastro = String(cliente?.nome || "").trim();
  if (doCadastro) return doCadastro;
  const daConversa = String(conversa?.nome_contato || "").trim();
  if (daConversa && !/^[\d\s+()-]+$/.test(daConversa)) return daConversa;
  return NAO_IDENTIFICADO;
}

export const proximoPassoSugerido = (diasSemRetorno) => {
  if (diasSemRetorno <= 2) return "Retomada 1 de 3 (1 a 2 dias): confirmar dúvida técnica do item";
  if (diasSemRetorno <= 5) return "Retomada 2 de 3 (4 a 5 dias): informar frete e prazo";
  if (diasSemRetorno <= 14) return "Retomada 3 de 3 (10 a 14 dias): rever condição de pagamento";
  return "Retomada final: avisar liberação do estoque e reativar a condição";
};

/** Sugestão para copiar e enviar à mão. Sempre com motivo novo, nunca "e aí, viu?". */
export function sugestaoFollowUp({ orcamento, diasSemRetorno = 0, nome }) {
  const primeiro = String(nome || "").trim().split(/\s+/)[0] || "";
  const oi = primeiro ? `Oi, ${primeiro}!` : "Oi!";
  const numero = String(orcamento?.numero_pedido || "").trim();
  const ref = numero ? `orçamento ${numero}` : "seu orçamento";
  const item = (orcamento?.itens || [])[0];
  const nomeItem = String(item?.nome || item?.cod || "item principal").trim();

  if (diasSemRetorno <= 2) {
    return {
      motivo: "Dúvida técnica",
      texto: `${oi} Ficou uma dúvida técnica no ${ref}: tem mais de uma versão de acabamento do ${nomeItem} e isso muda o prazo de produção. Quer que eu te mande a diferença de preço entre as opções?`
    };
  }
  if (diasSemRetorno <= 5) {
    return {
      motivo: "Frete e prazo",
      texto: `${oi} Consegui confirmar frete e prazo do ${ref}. Me passa só a cidade de entrega que eu fecho o valor do frete agora.`
    };
  }
  if (diasSemRetorno <= 14) {
    return {
      motivo: "Condição comercial",
      texto: `${oi} O ${ref} fez ${diasSemRetorno} dias. Consigo revisar a condição de pagamento pra fechar ainda essa semana. Quer que eu mande a proposta com prazo maior?`
    };
  }
  return {
    motivo: "Liberação de estoque",
    texto: `${oi} Vou liberar o estoque reservado do ${ref}. Se ainda tiver interesse, me responde hoje que eu reativo com essa condição.`
  };
}