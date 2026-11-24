import { secrets } from 'base44:runtime';

// Avisa o dono: e-mail para os admins do app (principal) e WhatsApp oficial (reforco,
// so entrega se o dono falou com o numero nas ultimas 24h). Nunca derruba a venda.
export async function avisarVenda(db: any, titulo: string, linhas: string[]) {
  const texto = [titulo, '', ...linhas].join('\n');
  const resultado = { email: 0, whatsapp: false, erros: [] as string[] };

  try {
    const admins = await db.entities.User.filter({ role: 'admin' });
    for (const admin of admins) {
      if (!admin.email) continue;
      try {
        await db.integrations.Core.SendEmail({ to: admin.email, subject: titulo, body: texto.replace(/[<>]/g, '').replace(/\n/g, '<br>'), from_name: 'PlaceFit' });
        resultado.email += 1;
      } catch (e) {
        resultado.erros.push(`email: ${e?.message || 'falha'}`);
      }
    }
  } catch (e) {
    resultado.erros.push(`admins: ${e?.message || 'falha'}`);
  }

  try {
    const token = secrets.get('META_ACCESS_TOKEN');
    const para = String(secrets.get('OWNER_PHONE') || '').replace(/\D/g, '');
    const conexao = (await db.entities.whatsapp_connections.filter({ display_phone: '5537999458509' }, '-created_date', 1))[0];
    if (token && para && conexao?.phone_number_id) {
      const r = await fetch(`https://graph.facebook.com/v21.0/${conexao.phone_number_id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: para, type: 'text', text: { preview_url: false, body: texto } }),
        signal: AbortSignal.timeout(10000),
      });
      resultado.whatsapp = r.ok;
      if (!r.ok) resultado.erros.push(`whatsapp: HTTP ${r.status}`);
    } else {
      resultado.erros.push('whatsapp: nao configurado');
    }
  } catch (e) {
    resultado.erros.push(`whatsapp: ${e?.message || 'falha'}`);
  }

  if (resultado.erros.length) console.error('avisarVenda:', resultado.erros.join(' | '));
  return resultado;
}
