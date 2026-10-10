import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Recebe um PNG de card ja renderizado pela automacao de campanhas (sandbox)
// e guarda no storage publico do app, devolvendo a URL permanente.
// Protegido por AUTOMACAO_KEY (segredo do app). Opcionalmente grava a URL
// em CardGerado.arquivo_url.
// body: { key, nome_arquivo, png_base64, card_id? }
Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const esperado = Deno.env.get('AUTOMACAO_KEY');
    if (!esperado || body.key !== esperado) return Response.json({ error: 'Nao autorizado' }, { status: 401 });
    if (!body.png_base64 || !body.nome_arquivo) return Response.json({ error: 'png_base64 e nome_arquivo obrigatorios' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const bin = Uint8Array.from(atob(body.png_base64), (c) => c.charCodeAt(0));
    if (bin[0] !== 0x89 || bin[1] !== 0x50) return Response.json({ error: 'Nao e PNG' }, { status: 400 });
    const nome = String(body.nome_arquivo).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80);
    const file = new File([bin], nome, { type: 'image/png' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    if (body.card_id) {
      await base44.asServiceRole.entities.CardGerado.update(body.card_id, { arquivo_url: file_url }).catch(() => null);
    }
    return Response.json({ file_url });
  } catch (e) {
    console.error('publicarCardAutomacao:', e);
    return Response.json({ error: (e as Error)?.message || 'erro' }, { status: 500 });
  }
});
