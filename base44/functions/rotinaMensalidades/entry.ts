import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { secrets } from 'base44:runtime';
import { rodarMensalidades } from '../../shared/mensalidades.ts';

// Chamada 1x por dia pelo workflow "Mensalidades PlaceFit". Nao recebe parametros e
// repetir no mesmo dia nao repete aviso, entao uma chamada extra nao causa efeito.
export default async function (req) {
  try {
    const r = await rodarMensalidades(createClientFromRequest(req).asServiceRole, {
      apiKey: secrets.get('INFINITEPAY_API_KEY'), webhookUrl: secrets.get('INFINITEPAY_WEBHOOK_URL'),
    });
    console.log('[MENSALIDADES]', JSON.stringify(r));
    return Response.json({ ok: true, acoes: r.length });
  } catch (e) {
    console.error('rotinaMensalidades:', e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
