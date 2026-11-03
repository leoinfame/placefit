import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Item 022e (pedido do Sr. Leo, 02/11/2026): tabela de atacado PÚBLICA da revenda, sem login,
 * sempre com os preços atuais — é o link que a resposta automática manda para o lead novo.
 *
 * Mesma regra de preço da tela "Sua Tabela" (Export.jsx): preço promocional quando houver,
 * senão preço × (1 + margem). Só devolve o preço FINAL de venda: nunca preço de fábrica,
 * margem, fabricante, CNPJ, e-mail de login ou qualquer outro dado interno.
 */
import { carregarTabela } from '../../shared/tabelaAtacado.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let supplierId = '';
    try {
      const body = await req.json();
      supplierId = String(body?.supplier || body?.supplier_id || '');
    } catch {
      supplierId = new URL(req.url).searchParams.get('supplier') || '';
    }
    const tabela = await carregarTabela(base44.asServiceRole.entities, supplierId);
    if (!tabela) return Response.json({ error: 'Tabela não encontrada.' }, { status: 404 });
    return Response.json(tabela);
  } catch (error) {
    console.error('Erro getTabelaPublica:', error);
    return Response.json({ error: 'Erro ao carregar a tabela.' }, { status: 500 });
  }
});
