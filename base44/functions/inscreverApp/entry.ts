// Inscrição no app PlaceFit via homepage pública.
//
// Modo 1 — cadastro (público):
//   POST { nome, email, empresa, whatsapp, cupom }
//   Cria um InscricaoApp (intent) e retorna success.
//
// Modo 2 — ativação (após login Google, chamado de MinhaConta):
//   POST { ativar: true, user_id, user_email, user_nome }
//   Processa InscricaoApp pendentes por email, cria AssinaturaUsuario
//   (mensalidade_padrao, trial 30 dias) e atualiza User com empresa/whatsapp.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";

const BUILD = "2026-08-23-inscrever-app";

function trialDates() {
  const hoje = new Date();
  const venc = new Date();
  venc.setDate(venc.getDate() + 30);
  return {
    data_inicio: hoje.toISOString().slice(0, 10),
    data_vencimento: venc.toISOString().slice(0, 10),
  };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Modo 1: cadastro público
    if (body.nome && body.email) {
      const existing = await base44.asServiceRole.entities.InscricaoApp.filter({
        email: body.email,
        processado: false,
      });

      if (existing.length === 0) {
        await base44.asServiceRole.entities.InscricaoApp.create({
          nome: body.nome,
          email: body.email,
          empresa: body.empresa || "",
          whatsapp: body.whatsapp || "",
          cupom: body.cupom || "",
          processado: false,
        });
      }

      return Response.json({ success: true, build: BUILD });
    }

    // Modo 2: ativação após login
    if (body.ativar && body.user_id && body.user_email) {
      const planos = await base44.asServiceRole.entities.PlanoServico.filter({
        slug: "mensalidade_padrao",
      });
      const plano = planos[0];
      if (!plano) {
        return Response.json(
          { error: "Plano mensalidade_padrao nao encontrado. Crie o registro em PlanoServico." },
          { status: 404 },
        );
      }

      // Verificar se já tem assinatura
      const existingAss = await base44.asServiceRole.entities.AssinaturaUsuario.filter({
        usuario_id: body.user_id,
        plano_slug: "mensalidade_padrao",
      });

      let assinaturaId = existingAss[0]?.id;

      if (existingAss.length === 0) {
        const { data_inicio, data_vencimento } = trialDates();
        const ass = await base44.asServiceRole.entities.AssinaturaUsuario.create({
          usuario_id: body.user_id,
          usuario_email: body.user_email,
          usuario_nome: body.user_nome || "",
          plano_id: plano.id,
          plano_slug: "mensalidade_padrao",
          plano_nome: plano.nome,
          status: "trial",
          data_inicio,
          data_vencimento,
        });
        assinaturaId = ass.id;
      }

      // Processar InscricaoApp pendente
      const inscricoes = await base44.asServiceRole.entities.InscricaoApp.filter({
        email: body.user_email,
        processado: false,
      });

      let inscricaoData = null;
      if (inscricoes.length > 0) {
        const insc = inscricoes[0];
        inscricaoData = { empresa: insc.empresa, whatsapp: insc.whatsapp, nome: insc.nome };

        // Atualizar User com empresa/whatsapp
        if (insc.empresa || insc.whatsapp) {
          try {
            await base44.asServiceRole.entities.User.update(body.user_id, {
              empresa: insc.empresa,
              whatsapp: insc.whatsapp,
            });
          } catch (e) {
            console.error("Erro ao atualizar User:", e);
          }
        }

        await base44.asServiceRole.entities.InscricaoApp.update(insc.id, {
          processado: true,
          user_id: body.user_id,
          assinatura_id: assinaturaId,
        });
      }

      return Response.json({
        success: true,
        assinatura_id: assinaturaId,
        inscricao: inscricaoData,
        build: BUILD,
      });
    }

    return Response.json({ error: "Parametros invalidos" }, { status: 400 });
  } catch (error) {
    console.error("inscreverApp:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}