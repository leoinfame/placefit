import React from "react";
import CrmLegalLayout, { CRM_LEGAL_ROUTES, VIGENCIA, DocLink, H2, P } from "./CrmLegalLayout";

export default function CrmExclusaoDados() {
  return (
    <CrmLegalLayout titulo="Solicitar exclusão de dados do CRM MuscularFit" tituloAba="CRM MuscularFit - exclusao-de-dados">
      <P>Data de vigência: {VIGENCIA}</P>

      <H2>Como solicitar</H2>
      <P>Envie o pedido pelo WhatsApp, na conversa com a MuscularFit, a partir do mesmo número que você usou no atendimento. Escreva que deseja excluir seus dados do CRM MuscularFit.</P>
      <P>Só aceitamos o pedido de exclusão vindo do próprio número cadastrado. É assim que confirmamos que quem pede é o titular dos dados. Pedidos feitos por outro número, por e-mail ou por outro canal não são executados; nesses casos, orientamos a enviar o pedido pelo número cadastrado.</P>
      <P>Não envie senha, código de autenticação ou documento nessa solicitação.</P>

      <H2>O que acontece depois</H2>
      <P>O pedido é atendido manualmente. O responsável localiza o número no painel do CRM e apaga as conversas e o cadastro do contato vinculados a ele. A confirmação é enviada pelo WhatsApp para o mesmo número.</P>
      <P>Se houver alguma obrigação aplicável que impeça a exclusão de parte dos dados, a resposta informa o que será mantido e por quê.</P>

      <H2>Limites da exclusão</H2>
      <P>Apagar dados do CRM MuscularFit não apaga mensagens nos aparelhos de participantes da conversa nem dados mantidos por serviços externos. Registros técnicos e cópias de segurança mantidos pela infraestrutura seguem as regras próprias desses serviços, e a exclusão não alcança dados que a Base44 já tenha usado antes do pedido.</P>
      <P>Se você voltar a conversar com a MuscularFit depois da exclusão, um novo registro de atendimento será criado.</P>
      <P>Para saber como os dados são tratados, consulte a <DocLink to={CRM_LEGAL_ROUTES.privacidade}>Política de Privacidade do CRM MuscularFit</DocLink>.</P>
    </CrmLegalLayout>
  );
}
