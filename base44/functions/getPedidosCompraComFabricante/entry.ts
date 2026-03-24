import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar todos os pedidos de compra do revendedor usando service role
    const allPedidos = await base44.asServiceRole.entities.PedidoCompra.filter(
      { revendedor_id: user.id }
    );

    // Buscar todos os usuários (fabricantes) usando service role
    const allUsers = await base44.asServiceRole.entities.User.list();

    // Mapear pedidos com dados do fabricante injetados
    const pedidosComFabricante = allPedidos.map(pedido => {
      const fabricante = allUsers.find(u => u.id === pedido.fabricante_id);
      
      return {
        ...pedido,
        fabricante_logo: fabricante?.logomarca || null,
        fabricante_email: fabricante?.email || null,
        fabricante_whatsapp: fabricante?.whatsapp || null,
        fabricante_endereco: fabricante?.endereco || null,
        fabricante_site: fabricante?.site || null,
        fabricante_cnpj: fabricante?.cnpj || null,
      };
    });

    return Response.json({ 
      success: true, 
      data: pedidosComFabricante 
    });
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});