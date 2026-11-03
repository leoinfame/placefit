import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { rodarMonitor } from '../../shared/monitorCrm.ts';

// Item 023: Monitor do CRM. Roda a cada 30 min pelo workflow "Monitor do CRM".
// Repetir a chamada não duplica nada: alerta tem chave única e o resumo do dia tem marcador.
const env = (n: string) => String(Deno.env.get(n) || '').trim();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const painel = env('PAINEL_URL') && !/base44/i.test(env('PAINEL_URL')) ? env('PAINEL_URL') : 'https://app.placefit.com.br';
    const tenant = (await base44.asServiceRole.entities.whatsapp_connections.filter({ display_phone: '5537999458509' }, '-created_date', 1))?.[0];
    const relatorio = await rodarMonitor(base44.asServiceRole.entities, {
      wahaUrl: env('WAHA_URL'), wahaKey: env('WAHA_API_KEY'),
      metaToken: env('META_ACCESS_TOKEN'), phoneNumberId: String(tenant?.phone_number_id || ''),
      tenant8509: String(tenant?.tenant_id || ''), ownerPhone: env('OWNER_PHONE'), painel
    });
    console.log('[MONITOR]', JSON.stringify(relatorio));
    return Response.json({ ok: true, contas: relatorio.length, novos: relatorio.reduce((s, r) => s + (r.novos || 0), 0) });
  } catch (e) {
    console.error('[MONITOR] falhou', e);
    return Response.json({ ok: false }, { status: 500 });
  }
});
