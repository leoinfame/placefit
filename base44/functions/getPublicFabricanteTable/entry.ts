import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Serve a tabela pública de um fabricante SEM exigir autenticação.
 *
 * Existe para que as entidades User/Product/SupplierProduct possam ter leitura
 * restrita a usuários autenticados: esta função roda com service role e devolve
 * apenas os campos que podem ser expostos publicamente.
 *
 * Regras:
 *  - só devolve dados de usuário aprovado e com tipo_usuario = 'fabricante';
 *  - só devolve produtos ativos, aprovados e com preço > 0;
 *  - nunca devolve CNPJ, e-mail interno de login ou qualquer campo sensível.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let fabricanteId: string | null = null;
    try {
      const body = await req.json();
      fabricanteId = body?.fabricante_id ?? null;
    } catch {
      const { searchParams } = new URL(req.url);
      fabricanteId = searchParams.get('fabricante_id');
    }

    if (!fabricanteId) {
      return Response.json({ error: 'fabricante_id é obrigatório' }, { status: 400 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ id: fabricanteId });
    const u = users?.[0];

    if (!u || u.aprovado !== true || u.tipo_usuario !== 'fabricante') {
      return Response.json({ error: 'Fabricante não encontrado.' }, { status: 404 });
    }

    // Apenas campos públicos — nada de CNPJ ou dados internos.
    const fabricante = {
      id: u.id,
      full_name: u.full_name,
      empresa: u.empresa,
      logomarca: u.logomarca,
      whatsapp: u.whatsapp,
      site: u.site,
      endereco: u.endereco,
      cidade: u.cidade,
      estado: u.estado,
      historia_empresa: u.historia_empresa,
      formas_pagamento: u.formas_pagamento,
      prazo_entrega: u.prazo_entrega,
      politica_troca: u.politica_troca,
      condicoes_pagamento: u.condicoes_pagamento,
      prazo_producao: u.prazo_producao,
      informacoes_frete: u.informacoes_frete,
    };

    const allProducts = await base44.asServiceRole.entities.Product.filter({ ativo: true });
    const products = allProducts
      .filter((p) =>
        p.fabricante_id === fabricanteId &&
        p.aprovado_produto === true &&
        p.preco_fabricante > 0
      )
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        cod: p.cod,
        categoria: p.categoria,
        und: p.und,
        peso: p.peso,
        dimensoes: p.dimensoes,
        foto: p.foto,
        preco_fabricante: p.preco_fabricante,
      }));

    return Response.json({ fabricante, products });
  } catch (error) {
    console.error('Erro getPublicFabricanteTable:', error);
    return Response.json({ error: 'Erro ao carregar tabela.' }, { status: 500 });
  }
});
