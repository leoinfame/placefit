import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { registrarAprovacao } from '../../shared/aprovacao.ts';

// Atualiza um User como admin. Quando mexe em aprovacao, tipo ou papel, grava tambem o
// registro AprovacaoUsuario, que e o que o servidor confere para "fabricante aprovado".
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { userId, data } = await req.json();

    if (!userId || !data) {
      return Response.json({ error: 'userId and data are required' }, { status: 400 });
    }

    await base44.asServiceRole.entities.User.update(userId, data);

    if (['aprovado', 'tipo_usuario', 'role'].some((k) => k in data)) {
      const [atual] = await base44.asServiceRole.entities.User.filter({ id: userId });
      if (atual) await registrarAprovacao(base44.asServiceRole, atual, user.full_name || user.email);
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
