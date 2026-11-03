// ─── Item 024: atendimento manual por contato ────────────────────────────────
// O dono assume a conversa no painel e o respondedor automático fica em silêncio
// SÓ naquele contato, até devolver ao bot. Nada aqui envia mensagem: é somente
// uma leitura do estado gravado em CRMBotPausa.
// Falha de leitura = bot segue (mesmo comportamento de antes do item 024).

export async function atendimentoManual(base44: any, conversaId: string): Promise<boolean> {
  try {
    if (!conversaId) return false;
    const rows = await base44.asServiceRole.entities.CRMBotPausa.filter(
      { conversa_id: conversaId, silenciado: true }, '-updated_date', 1
    );
    return Boolean(rows?.[0]?.silenciado);
  } catch (e) {
    console.error('[BOT PAUSA] leitura falhou; bot segue normalmente', e);
    return false;
  }
}