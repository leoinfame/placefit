import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import {
  resolverConexaoPorWaba,
  atualizarSyncJob,
  registrarEventoWebhook,
  finalizarEvento,
  redigirPayload,
  hashPayload,
  eventKeyDe,
  onlyDigits
} from '../../shared/whatsappCoexistence.ts';

// ─── Webhook oficial Meta (Cloud API + Coexistence) v2 ───────────────────────
// Handler robusto para os eventos da Meta: messages, history,
// smb_app_state_sync e smb_message_echoes. Preparação para o Embedded Signup
// v4 com coexistência do número comercial (+55 37 99914-7206) no WhatsApp
// Business App. Este handler NÃO envia mensagens e NÃO responde
// automaticamente: o atendente IA continua desligado e o fluxo WAHA atual
// (crm-whatsapp / crm-whatsapp-webhook) segue intacto.
//
// Segurança:
// - GET: desafio hub.verify_token (env WPP_VERIFY_TOKEN ou token por usuário).
// - POST: assinatura X-Hub-Signature-256 conferida com o App Secret
//   (env META_APP_SECRET). Sem o segredo configurado o endpoint falha fechado.
// - Todo evento é validado contra o tenant (WABA) antes de gravar.
// - Idempotência por wamid (meta_message_id) + event_key estável: reentregas não duplicam.
// - Chunks de histórico podem chegar fora de ordem: cada chunk é registrado
//   pela chave fase+ordem e a conclusão exige fase 2 com progresso 100.
//
// Fonte principal: entidades dedicadas (whatsapp_connections, whatsapp_secrets,
// whatsapp_webhook_events, whatsapp_sync_jobs). Campos whatsapp_meta_* de User
// são lidos apenas para migração transparente.

const env = (nome: string) => String(Deno.env.get(nome) || '').trim();

// ── Verificação de assinatura X-Hub-Signature-256 ────────────────────────────
async function assinaturaValida(rawBody: string, provided: string, secret: string) {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const expected = 'sha256=' + Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0')).join('');
    return expected === String(provided || '').trim().toLowerCase();
  } catch (error) {
    console.error('[META_WEBHOOK] Falha ao validar assinatura', error);
    return false;
  }
}

// ── Conversa e mensagem (idempotente por wamid) ──────────────────────────────
// connection.tenant_id é o owner_id das entidades CRM (mesmo User.id).
async function conversaDoContato(base44: any, connection: any, telefone: string, nome: string) {
  const tel = onlyDigits(telefone);
  if (!tel) return null;
  const existentes = await base44.asServiceRole.entities.CRMConversa.filter({
    owner_id: connection.tenant_id, telefone: tel
  });
  if (existentes && existentes.length) return existentes[0];
  return await base44.asServiceRole.entities.CRMConversa.create({
    owner_id: connection.tenant_id,
    nome_contato: nome || tel,
    telefone: tel,
    etapa: 'novo',
    origem: 'whatsapp',
    ativo: true
  });
}

function textoDaMensagem(msg: any) {
  if (!msg) return '';
  if (msg.type === 'text') return String(msg.text?.body || '');
  if (msg.type) return '[' + msg.type + ']';
  return '';
}

async function registrarMensagem(base44: any, connection: any, msg: any, direcao: string, origem: string, nomeContato: string) {
  const wamid = String(msg?.id || '');
  if (!wamid) return { dedup: false, ok: false };
  // Deduplicação: reentrega ou eco repetido não grava de novo
  const dup = await base44.asServiceRole.entities.CRMMensagem.filter({
    owner_id: connection.tenant_id, meta_message_id: wamid
  });
  if (dup && dup.length) return { dedup: true, ok: true };

  const outro = direcao === 'recebida' ? msg.from : msg.to;
  const conversa = await conversaDoContato(base44, connection, outro, nomeContato);
  if (!conversa) return { dedup: false, ok: false };

  const ts = msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString();
  await base44.asServiceRole.entities.CRMMensagem.create({
    owner_id: connection.tenant_id,
    conversa_id: conversa.id,
    telefone: onlyDigits(outro),
    direcao,
    tipo: msg.type === 'text' ? 'texto' : (msg.type === 'image' ? 'imagem' : (msg.type === 'document' ? 'documento' : 'sistema')),
    conteudo: textoDaMensagem(msg),
    status: direcao === 'recebida' ? 'recebida' : 'enviada',
    meta_message_id: wamid,
    origem,
    enviada_em: ts
  });
  await base44.asServiceRole.entities.CRMConversa.update(conversa.id, {
    ultima_mensagem: textoDaMensagem(msg).slice(0, 200),
    ultima_interacao: ts
  });
  return { dedup: false, ok: true };
}

async function atualizarStatus(base44: any, connection: any, st: any) {
  const wamid = String(st?.id || '');
  if (!wamid) return;
  const mapa: Record<string, string> = { sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'erro' };
  const novo = mapa[String(st.status || '')];
  if (!novo) return;
  const rows = await base44.asServiceRole.entities.CRMMensagem.filter({
    owner_id: connection.tenant_id, meta_message_id: wamid
  });
  if (rows && rows.length) {
    await base44.asServiceRole.entities.CRMMensagem.update(rows[0].id, { status: novo });
  }
}

// ── Roteamento dos campos da Meta ────────────────────────────────────────────
async function processarChange(base44: any, connection: any, change: any) {
  const field = String(change?.field || '');
  const value = change?.value || {};
  const numeroEmpresa = onlyDigits(value?.metadata?.display_phone_number || '');

  // Registra o evento bruto (dedup por event_key) para auditoria e sync
  const eventKey = eventKeyDe(field, value);
  const payloadRedigido = JSON.stringify(redigirPayload(value));
  const ph = await hashPayload(payloadRedigido);
  const ev = await registrarEventoWebhook(base44, connection, eventKey, field as any, {
    wamid: String(value?.messages?.[0]?.id || value?.message_echoes?.[0]?.id || value?.statuses?.[0]?.id || ''),
    payload_hash: ph,
    payload: payloadRedigido,
    event_timestamp: new Date().toISOString()
  });

  if (field === 'messages') {
    const contatos = value.contacts || [];
    for (const msg of value.messages || []) {
      const nome = contatos.find((c: any) => onlyDigits(c.wa_id) === onlyDigits(msg.from))?.profile?.name || '';
      await registrarMensagem(base44, connection, msg, 'recebida', 'cloud_api', nome);
    }
    for (const st of value.statuses || []) await atualizarStatus(base44, connection, st);
    if (!ev.dedup) await finalizarEvento(base44, ev.record.id, 'processado');
    return;
  }

  if (field === 'smb_message_echoes') {
    // Mensagens enviadas pelo próprio WhatsApp Business App entram aqui
    for (const msg of value.message_echoes || []) {
      await registrarMensagem(base44, connection, msg, 'enviada', 'business_app', '');
    }
    if (!ev.dedup) await finalizarEvento(base44, ev.record.id, 'processado');
    return;
  }

  if (field === 'history') {
    for (const bloco of value.history || []) {
      const meta = bloco?.metadata || {};
      // Atualiza o job de sincronização (cria se não existir, aceita chunks fora de ordem)
      await atualizarSyncJob(base44, connection, {
        fase: meta.phase ?? 0, chunk_order: meta.chunk_order, progress: meta.progress
      });
      for (const thread of bloco?.threads || []) {
        for (const msg of thread?.messages || []) {
          // histórico: direção pelo remetente (empresa = enviada)
          const direcao = onlyDigits(msg.from) === numeroEmpresa ? 'enviada' : 'recebida';
          await registrarMensagem(base44, connection, msg, direcao, 'history', '');
        }
      }
    }
    if (!ev.dedup) await finalizarEvento(base44, ev.record.id, 'processado');
    return;
  }

  if (field === 'smb_app_state_sync') {
    for (const item of value.state_sync || []) {
      const meta = item?.metadata || {};
      await atualizarSyncJob(base44, connection, {
        fase: meta.phase ?? 0, chunk_order: meta.chunk_order, progress: meta.progress
      });
      if (item?.type === 'contact' && item?.contact) {
        await conversaDoContato(base44, connection, item.contact.phone_number || '', item.contact.full_name || '');
      }
    }
    if (!ev.dedup) await finalizarEvento(base44, ev.record.id, 'processado');
    return;
  }

  // Demais campos (account_update, quality etc.): reconhecidos e ignorados com log
  console.log('[META_WEBHOOK] campo não tratado:', field);
  if (!ev.dedup) await finalizarEvento(base44, ev.record.id, 'processado');
}

Deno.serve(async (req) => {
  // Verificação obrigatória da Meta (desafio)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const verify = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge') || '';
    if (mode !== 'subscribe' || !verify) return new Response('Forbidden', { status: 403 });
    const envToken = env('WPP_VERIFY_TOKEN');
    if (envToken && verify === envToken) return new Response(challenge);
    try {
      const base44get = createClientFromRequest(req);
      const users = await base44get.asServiceRole.entities.User.list();
      const ok = (users || []).some(
        (u: any) => (u.whatsapp_webhook_token && u.whatsapp_webhook_token === verify)
      );
      if (ok) return new Response(challenge);
    } catch (e) { console.error('[META_WEBHOOK] GET fallback falhou', e); }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const appSecret = env('META_APP_SECRET');
  if (!appSecret) {
    // Falha fechada: sem App Secret configurado o endpoint não aceita eventos
    console.error('[META_WEBHOOK] META_APP_SECRET ausente');
    return new Response('Not configured', { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256') || '';
  if (!(await assinaturaValida(rawBody, signature, appSecret))) {
    return new Response('Invalid signature', { status: 401 });
  }

  let body: any = null;
  try { body = JSON.parse(rawBody); } catch { return new Response('Bad request', { status: 400 }); }

  try {
    const base44 = createClientFromRequest(req);
    for (const entry of body?.entry || []) {
      const connection = await resolverConexaoPorWaba(base44, String(entry?.id || ''));
      if (!connection) {
        console.log('[META_WEBHOOK] WABA sem conexão/tenant:', entry?.id);
        continue; // 200 para não gerar tempestade de reentregas
      }
      for (const change of entry?.changes || []) {
        await processarChange(base44, connection, change);
      }
    }
    return new Response('ok');
  } catch (error) {
    // Erro de processamento: 500 para a Meta reentregar (idempotência protege)
    console.error('[META_WEBHOOK] erro de processamento', error);
    return new Response('error', { status: 500 });
  }
});