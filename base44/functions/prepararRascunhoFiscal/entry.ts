// Preparar Rascunho Fiscal (NF-e modelo 55) — idempotente, seguro, sem emissao.
//
// Esta funcao NAO emite NF-e, NAO transmite a SEFAZ, NAO gera chave/protocolo/XML/DANFE,
// NAO marca o pedido como Faturado. Ela apenas cria ou retorna um rascunho fiscal
// idempotente do pedido, com status RASCUNHO ou PENDENTE_CONFIGURACAO.
//
// Isolamento multi-tenant: o tenant e identificado pelo token autenticado (RLS).
// Nenhum user_id/tenant_id do cliente e confiavel para autorizar acesso.
//
// Idempotencia: chave por tenant + pedido + operacao ("preparar_rascunho").
// Cliques repetidos retornam o mesmo rascunho, sem duplicar.
//
// Restricoes absolutas:
// - Nao chamar endpoints externos (SEFAZ, BrasilAPI, ViaCEP).
// - Nao criar chave de acesso, protocolo, cStat, XML ou DANFE.
// - Nao alterar o status do pedido para Faturado.
// - Nao consumir numeracao (so no momento futuro de envio real).

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";

const ONLY_DIGITS = (v: string) => String(v || "").replace(/\D/g, "");

// Transicoes validas de estado do rascunho fiscal
const TRANSICOES_VALIDAS: Record<string, string[]> = {
  "RASCUNHO": ["PENDENTE_CONFIGURACAO", "PRONTA_HOMOLOGACAO"],
  "PENDENTE_CONFIGURACAO": ["RASCUNHO", "PRONTA_HOMOLOGACAO"],
  "PRONTA_HOMOLOGACAO": ["EM_PROCESSAMENTO", "PENDENTE_CONFIGURACAO"],
  "EM_PROCESSAMENTO": ["AUTORIZADA", "REJEITADA", "DENEGADA", "CONTINGENCIA_PENDENTE"],
  // AUTORIZADA/REJEITADA/DENEGADA/CANCELADA/INUTILIZADA/CONTINGENCIA_PENDENTE:
  // transicoes futuras protegidas por retorno SEFAZ valido — nao acionaveis agora.
};

function transicaoValida(de: string, para: string): boolean {
  if (de === para) return true;
  const permitidas = TRANSICOES_VALIDAS[de];
  return Boolean(permitidas && permitidas.includes(para));
}

// Checklist de pendencias do contador (itens obrigatorios para homologacao)
const CHECKLIST_OBRIGATORIO = [
  "confirmar_modelo_55",
  "confirmar_regime_tributario",
  "confirmar_inscricao_estadual",
  "configurar_certificado_a1",
  "credenciamento_uf",
  "confirmar_cfop",
  "confirmar_ncm",
  "confirmar_icms_st",
  "confirmar_difal",
  "confirmar_frete",
  "confirmar_serie",
  "confirmar_numeracao",
];

function calcularPendencias(config: any): string[] {
  const pendencias: string[] = [];
  if (!config?.cnpj) pendencias.push("confirmar_cnpj_emissor");
  if (!config?.inscricao_estadual) pendencias.push("confirmar_inscricao_estadual");
  if (!config?.regime_tributario) pendencias.push("confirmar_regime_tributario");
  if (!config?.estado) pendencias.push("confirmar_uf_emissor");
  if (!config?.serie) pendencias.push("confirmar_serie");
  if (config?.certificado_status !== "configurado") pendencias.push("configurar_certificado_a1");
  if (config?.status_credenciamento !== "ativo") pendencias.push("credenciamento_uf");
  // CFOP, NCM, ICMS/ST, DIFAL, frete: pendentes por item/produto, confirmados pelo contador
  if (!config?.cfop_confirmado) pendencias.push("confirmar_cfop");
  if (!config?.ncm_confirmado) pendencias.push("confirmar_ncm");
  if (!config?.icms_st_confirmado) pendencias.push("confirmar_icms_st");
  if (!config?.difal_confirmado) pendencias.push("confirmar_difal");
  if (!config?.frete_confirmado) pendencias.push("confirmar_frete");
  if (!config?.numeracao_confirmada) pendencias.push("confirmar_numeracao");
  return pendencias;
}

function hashSimples(texto: string): string {
  // Hash nao criptografico para deteccao de divergencias (nao para seguranca)
  let h = 0;
  for (let i = 0; i < texto.length; i++) {
    h = ((h << 5) - h) + texto.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

export default async function (req: any) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const pedidoId = String(body?.pedido_id || "").trim();

    if (!pedidoId) {
      return Response.json({ erro: "pedido_id e obrigatorio" }, { status: 400 });
    }

    // 1) Carregar o pedido via RLS (so retorna se o tenant autenticado for dono)
    let pedidos: any[] = [];
    try {
      pedidos = await base44.entities.PedidoVenda.filter({ id: pedidoId });
    } catch {
      // ID invalido ou erro de query — tratar como nao encontrado
      return Response.json({ erro: "Pedido nao encontrado ou sem acesso" }, { status: 403 });
    }
    if (!pedidos || pedidos.length === 0) {
      return Response.json({ erro: "Pedido nao encontrado ou sem acesso" }, { status: 403 });
    }
    const pedido = pedidos[0];
    const tenantId = String(pedido.tenant_id || pedido.user_id || "");

    // 2) Carregar configuracao fiscal do tenant via RLS
    const configs = await base44.entities.ConfiguracaoFiscal.filter({ tenant_id: tenantId });
    const config = configs && configs.length > 0 ? configs[0] : null;

    // 3) Calcular pendencias do contador
    const pendencias = config ? calcularPendencias(config) : [...CHECKLIST_OBRIGATORIO];
    const prontaHomologacao = pendencias.length === 0;

    // 4) Idempotencia: verificar rascunho existente para este pedido
    const idempotencyKey = `${tenantId}:${pedidoId}:preparar_rascunho`;
    const existentes = await base44.entities.NotaFiscal.filter({
      idempotency_key: idempotencyKey
    });

    if (existentes && existentes.length > 0) {
      // Rascunho ja existe — retornar o existente (idempotente)
      const rascunho = existentes[0];
      return Response.json({
        ok: true,
        idempotente: true,
        rascunho: {
          id: rascunho.id,
          status: rascunho.status,
          modelo: rascunho.modelo,
          ambiente: rascunho.ambiente,
          serie: rascunho.serie,
          numero: rascunho.numero || null,
          chave_acesso: rascunho.chave_acesso || null,
          protocolo: rascunho.protocolo || null,
          data_preparacao: rascunho.data_preparacao,
        },
        pendencias,
        pronta_homologacao: prontaHomologacao,
        aviso: "Nenhuma NF-e foi emitida. Fluxo em preparacao para homologacao.",
      });
    }

    // 5) Criar o rascunho fiscal (sem numero, sem chave, sem protocolo, sem XML)
    const statusInicial = prontaHomologacao ? "PRONTA_HOMOLOGACAO" : "PENDENTE_CONFIGURACAO";

    // Snapshots imutaveis (JSON string) — capturam o estado no momento da preparacao
    const emitenteSnapshot = config ? JSON.stringify({
      cnpj: config.cnpj,
      razao_social: config.razao_social,
      nome_fantasia: config.nome_fantasia,
      inscricao_estadual: config.inscricao_estadual,
      regime_tributario: config.regime_tributario,
      endereco: config.endereco,
      numero: config.numero,
      bairro: config.bairro,
      cidade: config.cidade,
      estado: config.estado,
      cep: config.cep,
    }) : "{}";

    const destinatarioSnapshot = JSON.stringify({
      cliente_id: pedido.cliente_id,
      cliente_nome: pedido.cliente_nome,
      cliente_cpf_cnpj: pedido.cliente_cpf_cnpj,
    });

    const itensSnapshot = JSON.stringify({
      itens: pedido.itens || [],
      subtotal: pedido.subtotal || 0,
      desconto: pedido.desconto || 0,
      valor_frete: pedido.valor_frete || 0,
      valor_total: pedido.valor_total || 0,
      forma_pagamento: pedido.forma_pagamento,
    });

    const valoresSnapshot = JSON.stringify({
      subtotal: pedido.subtotal || 0,
      desconto: pedido.desconto || 0,
      valor_frete: pedido.valor_frete || 0,
      valor_total: pedido.valor_total || 0,
      // Parametros tributarios pendentes do contador — nao fixados aqui
      tributacao: "pendente_confirmacao_contador",
    });

    const hashIntegridade = hashSimples(
      emitenteSnapshot + destinatarioSnapshot + itensSnapshot + valoresSnapshot
    );

    const novoRascunho = await base44.entities.NotaFiscal.create({
      tenant_id: tenantId,
      pedido_id: pedidoId,
      idempotency_key: idempotencyKey,
      modelo: "55",
      ambiente: config?.ambiente || "homologacao",
      serie: config?.serie || "",
      numero: "", // NULO — reservado atomicamente no momento futuro de envio
      status: statusInicial,
      chave_acesso: "", // NULO
      protocolo: "", // NULO
      cStat: "", // NULO
      motivo_rejeicao: "", // NULO
      emitente_snapshot: emitenteSnapshot,
      destinatario_snapshot: destinatarioSnapshot,
      itens_snapshot: itensSnapshot,
      valores_snapshot: valoresSnapshot,
      xml_envio_url: "", // NULO
      xml_retorno_url: "", // NULO
      xml_autorizado_url: "", // NULO
      danfe_url: "", // NULO
      hash_integridade: hashIntegridade,
      data_preparacao: new Date().toISOString(),
      data_autorizacao: "", // NULO
      motivo_cancelamento: "", // NULO
      data_cancelamento: "", // NULO
      observacoes: "Rascunho fiscal preparado automaticamente. Nenhuma NF-e emitida.",
    });

    // 6) Registrar evento de auditoria (append-only)
    await base44.entities.EventoFiscal.create({
      tenant_id: tenantId,
      documento_fiscal_id: novoRascunho.id,
      pedido_id: pedidoId,
      tipo_evento: "criacao_rascunho",
      estado_anterior: "",
      estado_novo: statusInicial,
      descricao: "Rascunho fiscal preparado. Nenhuma NF-e emitida.",
      metadados: JSON.stringify({
        pendencias_resolvidas: prontaHomologacao,
        pendencias_restantes: pendencias.length,
      }),
      idempotency_key: idempotencyKey,
    });

    // 7) NAO alterar o status do pedido para Faturado
    // O pedido permanece com seu status atual (ex: Confirmado)

    return Response.json({
      ok: true,
      idempotente: false,
      rascunho: {
        id: novoRascunho.id,
        status: novoRascunho.status,
        modelo: novoRascunho.modelo,
        ambiente: novoRascunho.ambiente,
        serie: novoRascunho.serie,
        numero: null,
        chave_acesso: null,
        protocolo: null,
        data_preparacao: novoRascunho.data_preparacao,
      },
      pendencias,
      pronta_homologacao: prontaHomologacao,
      aviso: "Nenhuma NF-e foi emitida. Fluxo em preparacao para homologacao.",
    });
  } catch (error) {
    console.error("[prepararRascunhoFiscal] erro:", error);
    const msg = error?.message || String(error || "desconhecido");
    return Response.json({ erro: "Erro ao preparar rascunho fiscal", detalhe: msg }, { status: 500 });
  }
}