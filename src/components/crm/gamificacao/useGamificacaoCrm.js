import { useCallback, useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  calcularPlacar, configEfetiva, diasDesde, nomeExibicaoCliente, proximoPassoSugerido, quandoUTC,
  semaforoDaConversa, somenteDigitos, sugestaoFollowUp
} from "@/lib/crmGamificacao";

const MAIS_RECENTE = (a, b) => (quandoUTC(a || 0) > quandoUTC(b || 0) ? a : b);
const nomeDe = (valor) => String(valor || "").trim();

/**
 * Item 024 — camada de gamificação do CRM. Só leitura e registro no painel:
 * não envia mensagem, não fala com WAHA/Meta e não altera entidades existentes.
 */
export default function useGamificacaoCrm({ ownerId, conversations = [], clientes = [], usuario, agora }) {
  const [configRow, setConfigRow] = useState(null);
  const [pausas, setPausas] = useState({});
  const [proximos, setProximos] = useState({});
  const [orcamentos, setOrcamentos] = useState([]);
  const [mensagens, setMensagens] = useState({});
  const [carregando, setCarregando] = useState(false);

  const config = useMemo(() => configEfetiva(configRow), [configRow]);
  const quemSou = nomeDe(usuario?.empresa || usuario?.full_name || usuario?.email);

  const carregar = useCallback(async (id) => {
    if (!id) return;
    setCarregando(true);
    try {
      const [cfg, ps, pp, orcs] = await Promise.all([
        base44.entities.CRMGamificacaoConfig.filter({ owner_id: id }, "-updated_date", 1).catch(() => []),
        base44.entities.CRMBotPausa.filter({ owner_id: id }, "-updated_date", 500).catch(() => []),
        base44.entities.CRMProximoPasso.filter({ owner_id: id }, "-created_date", 500).catch(() => []),
        base44.entities.Pedido.filter({ fornecedor_id: id, tipo: "orcamento", status: "pendente" }, "-created_date", 300).catch(() => [])
      ]);
      setConfigRow(cfg?.[0] || null);
      setPausas(Object.fromEntries((ps || []).filter((p) => p.conversa_id).map((p) => [p.conversa_id, p])));
      const mapaPassos = {};
      for (const passo of pp || []) if (passo.conversa_id && !mapaPassos[passo.conversa_id]) mapaPassos[passo.conversa_id] = passo;
      setProximos(mapaPassos);
      setOrcamentos(orcs || []);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(ownerId); }, [ownerId, carregar]);

  const clientesPorId = useMemo(
    () => Object.fromEntries((clientes || []).map((c) => [c.id, c])),
    [clientes]
  );

  const conversaDoOrcamento = useCallback((orcamento) => {
    if (!orcamento) return null;
    if (orcamento.cliente_id) {
      const direta = conversations.find((c) => c.cliente_id === orcamento.cliente_id);
      if (direta) return direta;
    }
    const telefone = somenteDigitos(clientesPorId[orcamento.cliente_id]?.telefone);
    if (telefone.length < 10) return null;
    const chave = telefone.slice(-8);
    return conversations.find((c) => {
      const d = somenteDigitos(c.telefone);
      return d.length >= 10 && d.slice(-8) === chave;
    }) || null;
  }, [conversations, clientesPorId]);

  // Último contato de cada lado (cliente / nós) nas conversas com orçamento aberto.
  useEffect(() => {
    if (!ownerId) return undefined;
    const alvos = conversations.filter((c) => orcamentos.some((o) => o.cliente_id && o.cliente_id === c.cliente_id)).map((c) => c.id);
    if (!alvos.length) { setMensagens({}); return undefined; }
    let cancelado = false;
    (async () => {
      const rows = await base44.entities.CRMMensagem
        .filter({ owner_id: ownerId, conversa_id: { $in: alvos } }, "-created_date", 600)
        .catch(() => []);
      if (cancelado) return;
      const mapa = {};
      for (const m of rows || []) {
        const slot = mapa[m.conversa_id] || (mapa[m.conversa_id] = { recebida: "", enviada: "" });
        if (m.direcao === "recebida") slot.recebida = MAIS_RECENTE(slot.recebida, m.created_date || m.enviada_em);
        else slot.enviada = MAIS_RECENTE(slot.enviada, m.created_date || m.enviada_em);
      }
      setMensagens(mapa);
    })();
    return () => { cancelado = true; };
  }, [ownerId, conversations, orcamentos]);

  const orcamentoPorCliente = useMemo(() => {
    const mapa = {};
    for (const o of orcamentos) {
      if (!o.cliente_id) continue;
      const atual = mapa[o.cliente_id];
      if (!atual || quandoUTC(o.created_date) > quandoUTC(atual.created_date)) mapa[o.cliente_id] = o;
    }
    return mapa;
  }, [orcamentos]);

  const dadosPorConversa = useMemo(() => {
    const mapa = {};
    for (const c of conversations) {
      const orcamento = c.cliente_id ? orcamentoPorCliente[c.cliente_id] || null : null;
      const lado = mensagens[c.id] || {};
      const respondeuDepois = orcamento && lado.recebida && quandoUTC(lado.recebida) > quandoUTC(orcamento.created_date);
      const baseSemRetorno = orcamento ? (respondeuDepois ? lado.recebida : orcamento.created_date) : "";
      const diasSemRetorno = orcamento ? diasDesde(baseSemRetorno, agora) : 0;
      const ultimaAtividade = c.ultima_interacao || lado.recebida || orcamento?.created_date || "";
      const diasUltimoContato = diasDesde(ultimaAtividade, agora);
      const tRecebida = lado.recebida ? quandoUTC(lado.recebida).getTime() || 0 : 0;
      const tEnviada = lado.enviada ? quandoUTC(lado.enviada).getTime() || 0 : 0;
      const ultimaMensagemDe = !tRecebida && !tEnviada ? "" : tRecebida >= tEnviada ? "cliente" : "nos";
      mapa[c.id] = {
        conversa: c,
        orcamento,
        pausa: pausas[c.id] || null,
        proximoPasso: proximos[c.id] || null,
        ultimoContatoCliente: lado.recebida || "",
        ultimoContatoNosso: lado.enviada || "",
        ultimaMensagemDe,
        diasSemRetorno,
        placar: calcularPlacar({ orcamento, diasSemRetorno, diasUltimoContato, config }),
        semaforo: semaforoDaConversa(c.etapa, diasDesde(ultimaAtividade, agora), config)
      };
    }
    return mapa;
  }, [conversations, orcamentoPorCliente, mensagens, pausas, proximos, config, agora]);

  const nomeDoOrcamento = useCallback((orcamento) => nomeExibicaoCliente({
    orcamento,
    cliente: clientesPorId[orcamento?.cliente_id],
    conversa: conversaDoOrcamento(orcamento)
  }), [clientesPorId, conversaDoOrcamento]);

  const ranking = useMemo(() => orcamentos.map((orcamento) => {
    const conversa = conversaDoOrcamento(orcamento);
    const dados = conversa ? dadosPorConversa[conversa.id] : null;
    const nome = nomeDoOrcamento(orcamento);
    const diasSemRetorno = dados?.diasSemRetorno ?? diasDesde(orcamento.created_date, agora);
    const semaforo = dados?.semaforo || null;
    return {
      id: orcamento.id,
      orcamento,
      conversa,
      nome,
      numero: orcamento.numero_pedido || "",
      telefone: conversa?.telefone || clientesPorId[orcamento.cliente_id]?.telefone || "",
      valor: Number(orcamento.total || 0),
      itens: (orcamento.itens || []).length,
      criado: orcamento.created_date,
      diasSemRetorno,
      diasUltimoContato: diasDesde(conversa?.ultima_interacao || orcamento.created_date, agora),
      ultimoContatoCliente: dados?.ultimoContatoCliente || "",
      ultimoContatoNosso: dados?.ultimoContatoNosso || "",
      ultimaMensagemDe: dados?.ultimaMensagemDe || "",
      etapa: conversa?.etapa || "novo",
      semaforo,
      semaforoFaixa: semaforo?.faixa || "",
      passoRegistrado: Boolean(dados?.proximoPasso),
      proximoPassoRegistrado: dados?.proximoPasso?.descricao || "",
      pausado: Boolean(dados?.pausa?.silenciado),
      pontos: dados?.placar?.pontos ?? 0,
      proximoPasso: proximoPassoSugerido(diasSemRetorno),
      sugestao: sugestaoFollowUp({ orcamento, diasSemRetorno, nome })
    };
  }), [orcamentos, conversaDoOrcamento, dadosPorConversa, nomeDoOrcamento, clientesPorId, agora]);

  // Fila de avisos: semáforo fora do verde e SEM próximo passo registrado.
  const fila = useMemo(() => Object.values(dadosPorConversa)
    .filter((d) => d.semaforo && d.semaforo.faixa !== "conversa" && !d.proximoPasso)
    .sort((a, b) => b.semaforo.diasParado - a.semaforo.diasParado), [dadosPorConversa]);

  async function assumirConversa(conversa) {
    const em = new Date().toISOString();
    const existente = pausas[conversa.id];
    const registro = { acao: "assumir", em, por: quemSou };
    const registros = [...(existente?.registros || []), registro].slice(-50);
    const patch = {
      owner_id: ownerId,
      conversa_id: conversa.id,
      cliente_id: conversa.cliente_id || "",
      telefone_chave: somenteDigitos(conversa.telefone),
      silenciado: true,
      assumido_em: em,
      assumido_por: quemSou,
      registros
    };
    const row = existente
      ? await base44.entities.CRMBotPausa.update(existente.id, patch)
      : await base44.entities.CRMBotPausa.create(patch);
    setPausas((atual) => ({ ...atual, [conversa.id]: row }));
    return row;
  }

  async function devolverAoBot(conversa) {
    const em = new Date().toISOString();
    const existente = pausas[conversa.id];
    const registros = [...(existente?.registros || []), { acao: "devolver", em, por: quemSou }].slice(-50);
    const patch = { silenciado: false, devolvido_em: em, registros };
    const row = existente
      ? await base44.entities.CRMBotPausa.update(existente.id, patch)
      : await base44.entities.CRMBotPausa.create({
        owner_id: ownerId,
        conversa_id: conversa.id,
        cliente_id: conversa.cliente_id || "",
        telefone_chave: somenteDigitos(conversa.telefone),
        ...patch
      });
    setPausas((atual) => ({ ...atual, [conversa.id]: row }));
    return row;
  }

  async function registrarProximoPasso(conversa, descricao) {
    const texto = nomeDe(descricao);
    if (!conversa?.id || !texto) return null;
    const row = await base44.entities.CRMProximoPasso.create({
      owner_id: ownerId,
      conversa_id: conversa.id,
      descricao: texto,
      em: new Date().toISOString(),
      por: quemSou
    });
    setProximos((atual) => ({ ...atual, [conversa.id]: row }));
    return row;
  }

  async function salvarConfig(valores) {
    const patch = { owner_id: ownerId, ...valores };
    const row = configRow
      ? await base44.entities.CRMGamificacaoConfig.update(configRow.id, valores)
      : await base44.entities.CRMGamificacaoConfig.create(patch);
    setConfigRow({ ...(configRow || {}), ...row });
    return row;
  }

  return {
    config, configRow, pausas, proximos, orcamentos, ranking, fila, dadosPorConversa,
    carregando, recarregar: () => carregar(ownerId),
    assumirConversa, devolverAoBot, registrarProximoPasso, salvarConfig
  };
}