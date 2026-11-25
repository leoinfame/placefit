// ─── PDF do orçamento para o DONO, na conversa do 8509 (24/11/2026) ──────────
// Só quem está no modo gerente recebe (o número vem de respondedorLeo, nunca do pedido).
// O cliente do orçamento NUNCA recebe nada daqui.

import { montarHtmlPedido } from './pedidoPdfHtml.js';
import { scriptCores, imprimirPdf, logoComoDataUrl } from './tabelaPdf.ts';
import { observacoesCliente, CORES_PEDIDO_CSS } from './vendedorLead.ts';

const GRAPH = 'https://graph.facebook.com/v21.0';

/** HTML do PDF: sem as notas internas (suposições, "modo gerente"), porque o dono costuma encaminhar. */
export function htmlDoOrcamento(pedido: any, owner: any, cliente: any, logo: string): string {
  return montarHtmlPedido({
    pedido: { ...pedido, observacoes: observacoesCliente(owner, { cliente }) },
    user: { ...owner, logomarca: logo }, cliente: { ...(cliente || {}), observacoes: '' },
    tipo: 'orcamento', pesoTotal: 0, colors: CORES_PEDIDO_CSS, extraHead: scriptCores(logo, 'pedido')
  });
}

export async function pdfDoOrcamento(base44: any, tenantId: string, pedidoId: string, cfg: { url: string; user: string; pass: string }) {
  const db = base44.asServiceRole.entities;
  const pedido = (await db.Pedido.filter({ id: pedidoId, fornecedor_id: tenantId }, '-created_date', 1))?.[0];
  if (!pedido) throw new Error('orçamento não encontrado nesta conta');
  const owner = await db.User.get(tenantId);
  const cliente = pedido.cliente_id ? (await db.Cliente.filter({ id: pedido.cliente_id, fornecedor_id: tenantId }, '-created_date', 1))?.[0] : null;
  const logo = await logoComoDataUrl(owner?.logomarca || '');
  return { bytes: await imprimirPdf(htmlDoOrcamento(pedido, owner, cliente, logo), cfg), numero: String(pedido.numero_pedido || '') };
}

/** Envia o documento pela Cloud API ao número informado. */
export async function enviarDocumento(phoneNumberId: string, para: string, bytes: Uint8Array, nome: string, legenda: string, token: string) {
  if (!token) return { ok: false, id: '', error: 'META_ACCESS_TOKEN ausente' };
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'application/pdf');
  form.append('file', new Blob([bytes as any], { type: 'application/pdf' }), nome);
  const up = await fetch(`${GRAPH}/${phoneNumberId}/media`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const midia: any = await up.json().catch(() => ({}));
  if (!up.ok || !midia?.id) return { ok: false, id: '', error: `mídia HTTP ${up.status}: ${midia?.error?.message || 'falha'}` };
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: para, type: 'document', document: { id: midia.id, filename: nome, caption: legenda } })
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, id: '', error: `HTTP ${res.status}: ${data?.error?.message || 'falha no envio'}` };
  return { ok: true, id: String(data?.messages?.[0]?.id || ''), error: '' };
}
