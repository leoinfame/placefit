import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Buscar pré-cadastro pelo email do usuário logado
    const precadastros = await base44.asServiceRole.entities.PreCadastro.filter({
      email: user.email,
      aplicado: false
    });

    if (precadastros.length === 0) {
      return Response.json({ applied: false });
    }

    const pre = precadastros[0];

    // Dados a aplicar no usuário
    const updateData = {};
    if (pre.nome) updateData.full_name = pre.nome;
    if (pre.empresa) updateData.empresa = pre.empresa;
    if (pre.whatsapp) updateData.whatsapp = pre.whatsapp;
    if (pre.telefone) updateData.telefone = pre.telefone;
    if (pre.cidade) updateData.cidade = pre.cidade;
    if (pre.estado) updateData.estado = pre.estado;
    if (pre.cnpj) updateData.cnpj = pre.cnpj;
    if (pre.tipo_usuario) updateData.tipo_usuario = pre.tipo_usuario === 'fornecedor' ? null : pre.tipo_usuario;
    updateData.aprovado = true;

    // Atualizar o usuário com os dados pré-cadastrados
    await base44.asServiceRole.entities.User.update(user.id, updateData);

    // Marcar pré-cadastro como aplicado
    await base44.asServiceRole.entities.PreCadastro.update(pre.id, { aplicado: true });

    return Response.json({ applied: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});