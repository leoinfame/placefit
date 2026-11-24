import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { secrets } from 'base44:runtime';
import { configInfinitePay, criarCobrancaInfinitePay } from '../../shared/infinitepayCheckout.ts';

// Publica: chamada pelo site placefit.com.br. O preco e fixo aqui, nunca vem do navegador.
const VALOR_INSCRICAO = 2500;
const DESCRICAO = 'Inscricao PlaceFit: site, sistema e curso';
const RETORNO = 'https://www.placefit.com.br/obrigado.html';

export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    // Campo escondido do formulario: so robo preenche.
    if (body.site) return Response.json({ error: 'Dados invalidos' }, { status: 400 });

    const nome = String(body.nome || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 160);
    const whatsapp = String(body.whatsapp || '').replace(/\D/g, '').slice(0, 13);
    if (nome.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || whatsapp.length < 10) {
      return Response.json({ error: 'Confira nome, e-mail e WhatsApp com DDD.' }, { status: 400 });
    }

    const db = createClientFromRequest(req).asServiceRole;
    const { config, ativa } = await configInfinitePay(db);
    if (!ativa) return Response.json({ error: 'Pagamento online indisponivel no momento.' }, { status: 503 });

    // Mesmo e-mail com link recente e nao pago: reaproveita em vez de gerar outro.
    const abertas = await db.entities.CobrancaInfinitePay.filter(
      { cliente_email: email, referencia_tipo: 'inscricao', status: 'criada', valor: VALOR_INSCRICAO }, '-created_date', 1,
    );
    if (abertas[0]?.checkout_url && Date.now() - new Date(abertas[0].created_date).getTime() < 30 * 60 * 1000) {
      return Response.json({ checkout_url: abertas[0].checkout_url });
    }

    const { checkout_url } = await criarCobrancaInfinitePay(db, {
      apiKey: secrets.get('INFINITEPAY_API_KEY'),
      webhookUrl: secrets.get('INFINITEPAY_WEBHOOK_URL'),
      config,
      valor: VALOR_INSCRICAO,
      descricao: DESCRICAO,
      referenciaTipo: 'inscricao',
      cliente: { nome, email, whatsapp },
      redirectUrl: RETORNO,
    });
    return Response.json({ checkout_url });
  } catch (error) {
    console.error('comprarInscricao:', error);
    return Response.json({ error: 'Nao foi possivel abrir o pagamento. Chame no WhatsApp.' }, { status: 500 });
  }
}
