import React from "react";
import CrmLegalLayout, { CRM_LEGAL_ROUTES, VIGENCIA, RESPONSAVEL, DocLink, H2, P } from "./CrmLegalLayout";

export default function CrmPrivacidade() {
  return (
    <CrmLegalLayout titulo="Política de Privacidade do CRM MuscularFit" tituloAba="CRM MuscularFit - privacidade">
      <P>Data de vigência: {VIGENCIA}</P>
      <P>Responsável pelo tratamento: {RESPONSAVEL}</P>
      <P>Contato para privacidade: fatuex@gmail.com</P>

      <H2>Sobre o CRM</H2>
      <P>O CRM MuscularFit organiza o atendimento comercial da MuscularFit. Ele utiliza o PlaceFit como plataforma para registrar conversas e acompanhar o atendimento.</P>
      <P>Esta política trata dos dados usados nesse CRM. Ela não substitui as políticas de outros serviços que você utiliza, como o WhatsApp.</P>

      <H2>Dados usados no atendimento</H2>
      <P>Ao conversar com a MuscularFit, você pode fornecer seu nome, número de telefone, conteúdo de mensagens e outras informações incluídas na conversa. O CRM pode registrar a identificação do contato, o texto das mensagens, sua data e horário, direção e status de entrega, além de notas e da etapa do atendimento.</P>
      <P>Na integração oficial com o WhatsApp Business, quando conectada e autorizada pelo responsável pela conta, o CRM também pode receber mensagens enviadas pelo aplicativo WhatsApp Business e informações de contatos. A importação de conversas anteriores depende da autorização para compartilhar o histórico no processo de conexão. Não significa acesso irrestrito ao aparelho ou a todas as conversas pessoais.</P>
      <P>Quando uma mensagem traz foto, áudio, vídeo ou arquivo, o CRM registra apenas o texto que a acompanha e a indicação de que houve um anexo. O arquivo em si não é baixado, armazenado nem transcrito pelo CRM.</P>

      <H2>Para que os dados são usados</H2>
      <P>Os dados são usados para identificar o contato, manter o histórico do atendimento, acompanhar pedidos de informação e organizar o trabalho da equipe comercial. Registros técnicos de eventos podem ser usados para conferir a entrega e o processamento das mensagens e investigar falhas.</P>
      <P>Uma eventual ampliação de uso pela própria MuscularFit, como automação de respostas com inteligência artificial, será avaliada e descrita nesta política antes de entrar em operação.</P>

      <H2>Acesso e serviços envolvidos</H2>
      <P>O acesso fica limitado às pessoas autorizadas a realizar ou administrar o atendimento. O PlaceFit fornece a interface e a organização do CRM. Quando a integração oficial estiver ativa, a Meta/WhatsApp participa do recebimento e da sincronização das mensagens.</P>
      <P>A operação utiliza a infraestrutura Base44, um serviço estrangeiro. Por isso, os dados do CRM podem ser armazenados e processados fora do Brasil, conforme as regras da própria Base44.</P>

      <H2>Uso dos dados para treinar inteligência artificial</H2>
      <P>O CRM funciona na plataforma Base44 no plano Builder. Fora do plano Enterprise, os termos da Base44 permitem que ela use os dados do workspace, incluindo as conversas registradas neste CRM, para treinar modelos de inteligência artificial.</P>
      <P>Se você não concorda com esse uso, pode pedir a exclusão dos seus dados do CRM conforme as <DocLink to={CRM_LEGAL_ROUTES.exclusao}>instruções de exclusão</DocLink>. A exclusão não alcança dados que a Base44 já tenha usado antes do pedido.</P>

      <H2>Segurança e conservação</H2>
      <P>Os dados são protegidos por controles de acesso e medidas compatíveis com o atendimento. Nenhum serviço oferece segurança absoluta.</P>
      <P>Neste momento não há descarte automático. Contatos e conversas permanecem no CRM até serem apagados manualmente pelo responsável, por exemplo quando você pede a exclusão. Se uma regra de descarte automático for implantada, esta política será atualizada antes.</P>
      <P>Registros técnicos e cópias de segurança mantidos pela infraestrutura seguem as regras próprias desses serviços.</P>

      <H2>Solicitações sobre seus dados</H2>
      <P>Para pedir informações sobre seus dados ou a correção de informações, escreva para fatuex@gmail.com. Informe um meio de retorno e dados suficientes para localizar o atendimento. Não envie senha, documento completo ou outras informações sensíveis.</P>
      <P>O pedido de exclusão só é aceito quando enviado pelo WhatsApp, a partir do mesmo número cadastrado no atendimento. É assim que confirmamos que o pedido vem do titular. O atendimento é manual: o responsável apaga, pelo painel do CRM, as conversas e o cadastro do contato e envia a confirmação pelo WhatsApp para o mesmo número. O passo a passo está na <DocLink to={CRM_LEGAL_ROUTES.exclusao}>página de exclusão de dados</DocLink>.</P>
      <P>A exclusão de registros do CRM não apaga mensagens que permanecem no seu aparelho, no aparelho de outra pessoa ou em serviços externos. Se houver dados que não possam ser apagados por uma obrigação aplicável, a resposta informará essa limitação e seu motivo.</P>

      <H2>Alterações</H2>
      <P>Mudanças nesta política refletem o funcionamento real do CRM. A versão vigente fica disponível nesta página, com sua data de atualização.</P>
    </CrmLegalLayout>
  );
}
