import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  // Verificação obrigatória da Meta
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const verify = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    if (verify === Deno.env.get('WPP_VERIFY_TOKEN')) {
      return new Response(challenge);
    }
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    const change = body?.entry?.[0]?.changes?.[0]?.value;
    const msg = change?.messages?.[0];
    
    // Ignorar mensagens que não são texto
    if (!msg || msg.type !== 'text') {
      return new Response('ok');
    }

    const clientPhone = msg.from;
    const revendorPhone = change.metadata.display_phone_number;
    const phoneNumberId = change.metadata.phone_number_id;
    const userText = msg.text.body;

    // 1. Buscar revendedor pela número do WhatsApp
    const revendedores = await base44.asServiceRole.entities.Revendedor.filter({
      whatsapp_number: revendorPhone
    });
    
    if (!revendedores || revendedores.length === 0) {
      return new Response('ok');
    }
    
    const revendor = revendedores[0];

    // 2. Buscar produtos ativos do revendedor
    const produtos = await base44.asServiceRole.entities.SupplierProduct.filter({
      supplier_id: revendor.id,
      disponivel: true
    });

    // 3. Buscar configuração IA
    const iaConfigs = await base44.asServiceRole.entities.IAConfig.filter({
      supplier_id: revendor.id
    });
    const iaConfig = iaConfigs?.[0];

    // 4. Buscar histórico de chat (últimas 8 mensagens)
    const historico = await base44.asServiceRole.entities.ChatHistory.filter({
      supplier_id: revendor.id,
      client_phone: clientPhone
    }, '-created_date', 8);

    // 5. Montar system prompt com dados reais
    const produtosText = produtos
      .slice(0, 10)
      .map(p => `- ${p.product_name}: R$ ${p.price}/un`)
      .join('\n');

    const systemPrompt = `Você é ${iaConfig?.agent_name || 'Assistente'} da empresa ${revendor.nome}.

PRODUTOS DISPONÍVEIS:
${produtosText || 'Nenhum produto disponível no momento.'}

${iaConfig?.instructions ? `INSTRUÇÕES ESPECIAIS:\n${iaConfig.instructions}` : ''}

Responda de forma amigável e profissional em até 3 parágrafos curtos. Use emojis com moderação. Se não souber a resposta, ofereça falar com um atendente.`;

    // 6. Preparar mensagens para o Claude
    const messages = [
      ...(historico || []).reverse().flatMap(h => [
        { role: 'user', content: h.user_message },
        { role: 'assistant', content: h.agent_response || h.ai_response }
      ]),
      { role: 'user', content: userText }
    ];

    // 7. Chamar API do Anthropic
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!anthropicRes.ok) {
      console.error('Erro ao chamar Anthropic:', await anthropicRes.text());
      return new Response('ok');
    }

    const aiData = await anthropicRes.json();
    const reply = aiData.content?.[0]?.text || 'Desculpe, tive um pequeno problema! 🙏 Tente novamente em instantes.';

    // 8. Enviar resposta no WhatsApp
    const whatsappRes = await fetch(`https://graph.instagram.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('WHATSAPP_API_TOKEN')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: clientPhone,
        type: 'text',
        text: { body: reply }
      })
    });

    if (!whatsappRes.ok) {
      console.error('Erro ao enviar WhatsApp:', await whatsappRes.text());
    }

    // 9. Salvar interação no ChatHistory
    try {
      await base44.asServiceRole.entities.ChatHistory.create({
        supplier_id: revendor.id,
        client_phone: clientPhone,
        user_message: userText,
        agent_response: reply
      });
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }

    return new Response('ok');
  } catch (error) {
    console.error('Erro no webhook WhatsApp:', error);
    return new Response('ok');
  }
});