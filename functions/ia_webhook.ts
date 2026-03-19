import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    // ========== VERIFICAÇÃO DO WEBHOOK DA META ==========
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const verifyToken = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      
      const expectedToken = Deno.env.get('WPP_VERIFY');
      
      if (verifyToken === expectedToken) {
        return new Response(challenge);
      }
      
      console.log('Token de verificação inválido');
      return new Response('Forbidden', { status: 403 });
    }

    // ========== PROCESSAR MENSAGEM DO WHATSAPP ==========
    const body = await req.json();
    
    // Extrair dados da mensagem
    const entry = body?.entry?.[0];
    if (!entry) return new Response('ok');
    
    const change = entry?.changes?.[0]?.value;
    if (!change) return new Response('ok');
    
    const message = change?.messages?.[0];
    if (!message || message.type !== 'text') {
      return new Response('ok');
    }

    const clientPhone = message.from;
    const revendorPhoneNumber = change.metadata.display_phone_number;
    const phoneNumberId = change.metadata.phone_number_id;
    const userText = message.text.body;

    console.log(`[IA_WEBHOOK] Recebido: ${userText} de ${clientPhone}`);

    const base44 = createClientFromRequest(req);

    // ========== BUSCAR REVENDEDOR ==========
    const revendedores = await base44.asServiceRole.entities.Revendedor.filter({
      whatsapp_number: revendorPhoneNumber
    });

    if (!revendedores || revendedores.length === 0) {
      console.log(`Revendedor não encontrado para: ${revendorPhoneNumber}`);
      return new Response('ok');
    }

    const revendedor = revendedores[0];
    console.log(`Revendedor encontrado: ${revendedor.nome}`);

    // ========== BUSCAR PRODUTOS DO REVENDEDOR ==========
    const produtos = await base44.asServiceRole.entities.SupplierProduct.filter({
      supplier_id: revendedor.id
    });

    const produtosAtivos = produtos.filter(p => p.disponivel !== false);
    const produtosText = produtosAtivos
      .slice(0, 10)
      .map(p => `- ${p.product_name}: R$ ${p.price}/un`)
      .join('\n');

    // ========== BUSCAR CONFIGURAÇÃO IA ==========
    const iaConfigs = await base44.asServiceRole.entities.IAConfig.filter({
      revendedor_id: revendedor.id
    });

    const iaConfig = iaConfigs?.[0];

    if (!iaConfig || !iaConfig.ativo) {
      console.log(`IA desativada para revendedor: ${revendedor.id}`);
      return new Response('ok');
    }

    // ========== BUSCAR HISTÓRICO DE CHAT ==========
    const historico = await base44.asServiceRole.entities.ChatHistory.filter({
      revendedor_id: revendedor.id,
      client_phone: clientPhone
    }, '-created_date', 8);

    // ========== MONTAR SYSTEM PROMPT ==========
    const systemPrompt = `Você é ${iaConfig.agent_name || 'Assistente'} da empresa ${revendedor.nome}.

${produtosAtivos.length > 0 ? `PRODUTOS DISPONÍVEIS:\n${produtosText}\n` : ''}

${iaConfig.regras ? `INSTRUÇÕES:\n${iaConfig.regras}\n` : ''}

Responda de forma amigável e profissional. Se não souber responder, ofereça conectar com um atendente humano. Use emojis com moderação.`;

    // ========== PREPARAR MENSAGENS PARA CLAUDE ==========
    const messages = [
      ...(historico || []).reverse().flatMap(h => [
        { role: 'user', content: h.user_message },
        { role: 'assistant', content: h.ai_response }
      ]),
      { role: 'user', content: userText }
    ];

    console.log(`[IA_WEBHOOK] Enviando para Claude com ${messages.length} mensagem(ns)`);

    // ========== CHAMAR ANTHROPIC CLAUDE ==========
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_KEY'),
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
      const error = await anthropicRes.text();
      console.error('Erro Anthropic:', error);
      return new Response('ok');
    }

    const aiData = await anthropicRes.json();
    const aiResponse = aiData.content?.[0]?.text || 'Desculpe, tive um pequeno problema. Tente novamente em instantes! 🙏';

    console.log(`[IA_WEBHOOK] Resposta gerada: ${aiResponse.substring(0, 50)}...`);

    // ========== ENVIAR RESPOSTA VIA WHATSAPP ==========
    const whatsappRes = await fetch(`https://graph.instagram.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('WPP_TOKEN')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: clientPhone,
        type: 'text',
        text: { body: aiResponse }
      })
    });

    if (!whatsappRes.ok) {
      const error = await whatsappRes.text();
      console.error('Erro ao enviar WhatsApp:', error);
    } else {
      console.log(`[IA_WEBHOOK] Mensagem enviada para ${clientPhone}`);
    }

    // ========== SALVAR INTERAÇÃO NO HISTÓRICO ==========
    try {
      await base44.asServiceRole.entities.ChatHistory.create({
        revendedor_id: revendedor.id,
        client_phone: clientPhone,
        user_message: userText,
        ai_response: aiResponse
      });
      console.log(`[IA_WEBHOOK] Histórico salvo`);
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }

    return new Response('ok');
  } catch (error) {
    console.error('[IA_WEBHOOK] Erro crítico:', error);
    return new Response('ok');
  }
});