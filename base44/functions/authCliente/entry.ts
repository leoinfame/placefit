import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { hashPassword, genToken, publicCliente } from "../../shared/lojaAuth.ts";

const fetchAll = async (fn, sort = '-created_date', pageSize = 500) => {
  let all = []; let skip = 0;
  while (true) {
    const batch = await fn(sort, pageSize, skip);
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    skip += pageSize;
  }
  return all;
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { slug, acao, nome, email, cpf, telefone, senha } = body;
    if (!slug) return Response.json({ error: 'slug obrigatorio' }, { status: 400 });
    if (!acao) return Response.json({ error: 'acao obrigatorio (registro ou login)' }, { status: 400 });
    if (!email || !senha) return Response.json({ error: 'email e senha obrigatorios' }, { status: 400 });

    const emailNorm = String(email).trim().toLowerCase();
    const configs = await base44.asServiceRole.entities.LojaConfig.filter({ slug: String(slug).trim().toLowerCase() });
    const config = configs[0];
    if (!config) return Response.json({ error: 'Loja nao encontrada' }, { status: 404 });
    const revendedor_id = config.revendedor_id;

    const existentes = await fetchAll((sort, limit, skip) =>
      base44.asServiceRole.entities.LojaCliente.filter({ revendedor_id, email: emailNorm }, sort, limit, skip)
    );
    const cliente = existentes[0] || null;

    if (acao === 'registro') {
      if (cliente) return Response.json({ error: 'Ja existe conta com este e-mail. Faca login.' }, { status: 409 });
      if (!nome) return Response.json({ error: 'nome obrigatorio no cadastro' }, { status: 400 });
      const hash = await hashPassword(senha);
      const token = genToken();

      // Espelhar o cliente da loja no cadastro de "Meus Clientes" do revendedor (entidade Cliente).
      // Reaproveita registro existente com mesmo e-mail ou cria um novo, e guarda o vinculo.
      let clienteInternoId = null;
      try {
        const internos = await fetchAll((sort, limit, skip) =>
          base44.asServiceRole.entities.Cliente.filter({ fornecedor_id: revendedor_id, email: emailNorm }, sort, limit, skip)
        );
        if (internos[0]) {
          clienteInternoId = internos[0].id;
        } else {
          const criadoInterno = await base44.asServiceRole.entities.Cliente.create({
            fornecedor_id: revendedor_id,
            nome, cpf_cnpj: cpf || '', email: emailNorm, telefone: telefone || '',
            ativo: true,
          });
          clienteInternoId = criadoInterno?.id || null;
        }
      } catch (e) {
        console.error('Erro ao espelhar cliente em Meus Clientes:', e);
      }

      const criado = await base44.asServiceRole.entities.LojaCliente.create({
        revendedor_id, nome, email: emailNorm, cpf, telefone, senha: hash, token,
        cliente_interno_id: clienteInternoId,
      });
      return Response.json({ cliente: publicCliente(criado), token });
    }

    if (acao === 'login') {
      if (!cliente) return Response.json({ error: 'E-mail nao cadastrado. Crie sua conta.' }, { status: 404 });
      const hash = await hashPassword(senha);
      if (hash !== cliente.senha) return Response.json({ error: 'Senha incorreta' }, { status: 401 });
      const token = genToken();
      await base44.asServiceRole.entities.LojaCliente.update(cliente.id, { token });
      return Response.json({ cliente: publicCliente(cliente), token });
    }

    return Response.json({ error: 'acao invalida' }, { status: 400 });
  } catch (error) {
    console.error('authCliente:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}