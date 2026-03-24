import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Usar service role para acessar User (sem RLS)
    const allUsers = await base44.asServiceRole.entities.User.list();

    // Retornar apenas o mapeamento id → nome dos fabricantes
    const fabricantes = allUsers
      .filter(u => u.tipo_usuario === 'fabricante' || u.role === 'user')
      .map(u => ({
        id: u.id,
        nome: u.empresa || u.full_name || u.email,
        logomarca: u.logomarca || null,
        whatsapp: u.whatsapp || null,
        email: u.email || null,
        cnpj: u.cnpj || null,
      }));

    return Response.json({ fabricantes });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});