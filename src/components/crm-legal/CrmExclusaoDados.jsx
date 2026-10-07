import React from "react";
import CrmLegalLayout, { CRM_LEGAL_ROUTES, Pendencia, DocLink, H2, P } from "./CrmLegalLayout";

export default function CrmExclusaoDados() {
  return (
    <CrmLegalLayout titulo="Solicitar exclusão de dados do CRM MuscularFit" tituloAba="CRM MuscularFit - exclusao-de-dados">
      <P>RASCUNHO PARA REVISÃO. Não publicado. O processo ainda precisa de confirmação.</P>

      <H2>Como solicitar</H2>
      <P>Envie sua solicitação para fatuex@gmail.com. Informe que deseja excluir dados do CRM MuscularFit e forneça:</P>
      <ul className="my-3 list-disc pl-6">
        <li>O número de telefone usado no atendimento, com código do país e DDD.</li>
        <li>Um meio de retorno para receber a resposta.</li>
        <li>Se deseja excluir todos os dados localizáveis no CRM ou um registro específico.</li>
      </ul>
      <P>Não envie senha, código de autenticação ou documento completo nessa solicitação. Se for necessário confirmar sua identidade, o responsável orientará uma forma proporcional à solicitação.</P>

      <H2>O que será verificado</H2>
      <P>O responsável deve localizar os dados do atendimento, verificar a identidade de quem solicita e avaliar a exclusão dos registros correspondentes. Se houver alguma obrigação aplicável que impeça a exclusão de parte dos dados, a resposta deve informar o que será mantido e por quê.</P>
      <Pendencia>[CONFIRMAR ANTES DE PUBLICAR: pessoa/equipe responsável, método de localização, execução da exclusão nas conversas, contatos, registros de eventos, tokens associados quando aplicável e cópias de segurança; critérios de retenção e comunicação do resultado. Não há processo automático ou prazo prometido neste rascunho.]</Pendencia>

      <H2>Limites da exclusão</H2>
      <P>Apagar dados do CRM MuscularFit não apaga automaticamente mensagens nos aparelhos de participantes da conversa nem dados mantidos por serviços externos. A remoção de uma autorização de acesso ou a desconexão da integração também não deve ser confundida com a exclusão de registros já armazenados.</P>
      <P>Para saber como os dados são tratados, consulte a Política de Privacidade do CRM MuscularFit em <DocLink to={CRM_LEGAL_ROUTES.privacidade}>a página de privacidade deste CRM</DocLink> (rota proposta: /crm/privacidade).</P>
    </CrmLegalLayout>
  );
}
