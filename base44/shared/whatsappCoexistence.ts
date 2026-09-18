// ─── Coexistência WhatsApp (Cloud API + Business App) ───────────────────────
// Fundação de coexistência: entidades dedicadas por tenant, token cifrado
// fora do banco, eventos webhook deduplicáveis e jobs de sincronização.
//
// Esta camada é a fonte principal. Os campos temporários whatsapp_meta_* de
// User são lidos apenas para migração transparente: se um tenant já tinha
// onboarding gravado em User, a conexão equivalente é criada sob demanda.
//
// Nada aqui envia mensagens. Nada aqui reativa o atendente IA.

const onlyDigits = (value: string) => String(value || "").replace(/\D/g, "");

// ── Resolução de conexão ──────────────────────────────────────────────────────

/** Resolve a conexão oficial de um tenant pelo ID do tenant. */
export async function garantirConexaoDoTenant(base44: any, ownerId: string) {
  if (!ownerId) return null;
  const conns = await base44.asServiceRole.entities.whatsapp_connections.filter({ tenant_id: ownerId });
  if (conns && conns.length) return conns[0];
  // Migração: se o User tem whatsapp_meta_*, promover para a entidade dedicada
  const user = await base44.asServiceRole.entities.User.get(ownerId);
  if (user && user.whatsapp_meta_waba_id) {
    return await migrarMetaUserParaConexao(base44, user);
  }
  return null;
}

/** Resolve o tenant (User) pela WABA do evento do webhook. */
export async function resolverConexaoPorWaba(base44: any, wabaId: string) {
  if (!wabaId) return null;
  const conns = await base44.asServiceRole.entities.whatsapp_connections.filter({ waba_id: wabaId });
  if (conns && conns.length) return conns[0];
  // Migração: fallback para User.whatsapp_meta_waba_id
  const users = await base44.asServiceRole.entities.User.filter({ whatsapp_meta_waba_id: wabaId });
  if (users && users.length) {
    return await migrarMetaUserParaConexao(base44, users[0]);
  }
  return null;
}

// ── Migração User.whatsapp_meta_* → entidades dedicadas ───────────────────────

/** Promove os campos whatsapp_meta_* de User para whatsapp_connections + whatsapp_secrets. */
export async function migrarMetaUserParaConexao(base44: any, user: any) {
  if (!user || !user.whatsapp_meta_waba_id) return null;
  const existing = await base44.asServiceRole.entities.whatsapp_connections.filter({
    tenant_id: user.id, waba_id: user.whatsapp_meta_waba_id
  });
  if (existing && existing.length) return existing[0];

  const conn = await base44.asServiceRole.entities.whatsapp_connections.create({
    tenant_id: user.id,
    app_id: user.whatsapp_meta_app_id || "",
    waba_id: user.whatsapp_meta_waba_id,
    phone_number_id: user.whatsapp_meta_phone_number_id || "",
    display_phone: user.whatsapp_meta_display_phone || "",
    coexistence_enabled: Boolean(user.whatsapp_meta_coexistence),
    status: user.whatsapp_meta_status || "nao_configurado",
    health_status: "desconhecido",
    embedded_signup_config_id: "",
    last_validated_at: user.whatsapp_meta_connected_at || "",
    metadata: JSON.stringify({ migrated_from_user: true })
  });

  if (user.whatsapp_meta_token_enc) {
    const existingSecret = await base44.asServiceRole.entities.whatsapp_secrets.filter({ connection_id: conn.id });
    if (!existingSecret || !existingSecret.length) {
      await base44.asServiceRole.entities.whatsapp_secrets.create({
        tenant_id: user.id,
        connection_id: conn.id,
        encrypted_access_token: user.whatsapp_meta_token_enc,
        encryption_version: user.whatsapp_meta_token_key_version || "v1",
        token_expires_at: "",
        rotated_at: user.whatsapp_meta_connected_at || ""
      });
    }
  }
  return conn;
}

// ── Token cifrado (AES-GCM, chave fora do banco) ──────────────────────────────

/** Cifra um token com AES-GCM usando a chave base64 do env. Devolve base64(iv+cipher). */
export async function cifrarToken(token: string, encKeyBase64: string): Promise<string> {
  const keyBytes = Uint8Array.from(atob(encKeyBase64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  const pacote = new Uint8Array(iv.length + cipher.byteLength);
  pacote.set(iv, 0);
  pacote.set(new Uint8Array(cipher), iv.length);
  return btoa(String.fromCharCode(...pacote));
}

/** Decifra um token (uso futuro no servidor; nunca expor ao frontend). */
export async function decifrarToken(encBase64: string, encKeyBase64: string): Promise<string> {
  const pacote = Uint8Array.from(atob(encBase64), (c) => c.charCodeAt(0));
  const iv = pacote.slice(0, 12);
  const cipher = pacote.slice(12);
  const keyBytes = Uint8Array.from(atob(encKeyBase64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}

// ── Redação e hash de payload ─────────────────────────────────────────────────

/** Remove recursivamente campos sensíveis (token, code, secret, key, password, authorization). */
export function redigirPayload(obj: any): any {
  const limpo = JSON.parse(JSON.stringify(obj || {}));
  const limpar = (o: any) => {
    if (typeof o !== "object" || o === null) return;
    for (const k of Object.keys(o)) {
      if (/token|code|secret|key|password|authorization/i.test(k)) {
        delete o[k];
      } else if (typeof o[k] === "object") {
        limpar(o[k]);
      }
    }
  };
  limpar(limpo);
  return limpo;
}

/** SHA-256 hex de uma string. */
export async function hashPayload(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Eventos webhook (dedup por event_key) ─────────────────────────────────────

/** Chave estável de deduplicação para um evento. */
export function eventKeyDe(field: string, value: any): string {
  const wamid = String(value?.messages?.[0]?.id || value?.message_echoes?.[0]?.id || value?.statuses?.[0]?.id || "");
  if (wamid) return "wamid:" + wamid;
  const phase = value?.history?.[0]?.metadata?.phase ?? value?.state_sync?.[0]?.metadata?.phase;
  const chunk = value?.history?.[0]?.metadata?.chunk_order ?? value?.state_sync?.[0]?.metadata?.chunk_order;
  if (phase !== undefined && chunk !== undefined) return "chunk:" + phase + ":" + chunk;
  return "raw:" + field + ":" + Date.now();
}

/** Registra um evento webhook de forma idempotente. Devolve { dedup, record }. */
export async function registrarEventoWebhook(base44: any, connection: any, eventKey: string, eventType: string, patch: any) {
  const existing = await base44.asServiceRole.entities.whatsapp_webhook_events.filter({
    tenant_id: connection.tenant_id, connection_id: connection.id, event_key: eventKey
  });
  if (existing && existing.length) {
    return { dedup: true, record: existing[0] };
  }
  const record = await base44.asServiceRole.entities.whatsapp_webhook_events.create({
    tenant_id: connection.tenant_id,
    connection_id: connection.id,
    event_key: eventKey,
    event_type: eventType,
    wamid: patch.wamid || "",
    payload_hash: patch.payload_hash || "",
    payload: patch.payload || "",
    phase: patch.phase ?? null,
    chunk_order: patch.chunk_order ?? null,
    progress: patch.progress ?? null,
    event_timestamp: patch.event_timestamp || new Date().toISOString(),
    processing_status: "recebido"
  });
  return { dedup: false, record };
}

/** Marca um evento como processado (ou erro). */
export async function finalizarEvento(base44: any, eventId: string, status: string, error: string = "") {
  await base44.asServiceRole.entities.whatsapp_webhook_events.update(eventId, {
    processing_status: status,
    processed_at: new Date().toISOString(),
    error
  });
}

// ── Jobs de sincronização ─────────────────────────────────────────────────────

/** Cria ou atualiza o job de sincronização de histórico ativo de uma conexão. */
export async function atualizarSyncJob(base44: any, connection: any, patch: any) {
  let jobs = await base44.asServiceRole.entities.whatsapp_sync_jobs.filter({
    tenant_id: connection.tenant_id, connection_id: connection.id, sync_type: "history", status: "em_andamento"
  });
  let job: any;
  const now = new Date().toISOString();
  if (!jobs || !jobs.length) {
    job = await base44.asServiceRole.entities.whatsapp_sync_jobs.create({
      tenant_id: connection.tenant_id,
      connection_id: connection.id,
      sync_type: "history",
      status: "em_andamento",
      current_phase: patch.fase ?? 0,
      progress: patch.progress ?? 0,
      received_chunks: patch.chunk_order !== undefined && patch.chunk_order !== null ? 1 : 0,
      expected_chunks: 0,
      started_at: now,
      last_event_at: now
    });
    return job;
  }
  job = jobs[0];
  const updateData: any = { last_event_at: now };
  if (patch.fase !== undefined) updateData.current_phase = Math.max(job.current_phase || 0, patch.fase);
  if (typeof patch.progress === "number") updateData.progress = Math.max(job.progress || 0, patch.progress);
  if (patch.chunk_order !== undefined && patch.chunk_order !== null) {
    const eventos = await base44.asServiceRole.entities.whatsapp_webhook_events.filter({
      tenant_id: connection.tenant_id, connection_id: connection.id, event_type: "history"
    });
    const chunks = new Set();
    for (const e of eventos) {
      if (e.chunk_order !== null && e.chunk_order !== undefined) chunks.add(String(e.chunk_order));
    }
    updateData.received_chunks = chunks.size;
  }
  if (updateData.current_phase >= 2 && updateData.progress >= 100) {
    updateData.status = "concluido";
    updateData.completed_at = now;
  }
  await base44.asServiceRole.entities.whatsapp_sync_jobs.update(job.id, updateData);
  return { ...job, ...updateData };
}

/** Lê o estado consolidado de sincronização de uma conexão (para meta_status). */
export async function lerEstadoSync(base44: any, connection: any) {
  if (!connection) return { fases: {}, historico_concluido: false, atualizado_em: "" };
  const jobs = await base44.asServiceRole.entities.whatsapp_sync_jobs.filter({
    tenant_id: connection.tenant_id, connection_id: connection.id, sync_type: "history"
  }, "-started_at", 1);
  const job = jobs && jobs[0];
  if (!job) return { fases: {}, historico_concluido: false, atualizado_em: "" };
  // Reconstitui fases a partir dos eventos
  const eventos = await base44.asServiceRole.entities.whatsapp_webhook_events.filter({
    tenant_id: connection.tenant_id, connection_id: connection.id, event_type: "history"
  });
  const fases: any = {};
  for (const e of eventos) {
    const f = String(e.phase ?? 0);
    if (!fases[f]) fases[f] = { chunks: [], progress: 0 };
    if (e.chunk_order !== null && e.chunk_order !== undefined && !fases[f].chunks.includes(String(e.chunk_order))) {
      fases[f].chunks.push(String(e.chunk_order));
    }
    if (typeof e.progress === "number") fases[f].progress = Math.max(fases[f].progress, e.progress);
  }
  return {
    fases,
    historico_concluido: Boolean(job.status === "concluido" || (fases["2"] && fases["2"].progress >= 100)),
    atualizado_em: job.last_event_at || "",
    job_id: job.id,
    job_status: job.status
  };
}

export { onlyDigits };