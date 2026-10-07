import React from "react";
import CrmLegalLayout, { CRM_LEGAL_ROUTES, VIGENCIA_RASCUNHO, Pendencia, DocLink, H2, P } from "./CrmLegalLayout";

export default function CrmPrivacidade() {
  return (
    <CrmLegalLayout titulo="Política de Privacidade do CRM MuscularFit" tituloAba="CRM MuscularFit - privacidade">
      <P>RASCUNHO PARA REVISÃO. Não publicado. Os pontos pendentes aparecem destacados.</P>
      <P>Data de vigência: {VIGENCIA_RASCUNHO}</P>
      <P>Responsável pelo tratamento: MuscularFit (identificação jurídica completa pendente de conferência)</P>
      <P>Contato para privacidade: fatuex@gmail.com</P>

      <H2>Sobre o CRM</H2>
      <P>O CRM MuscularFit organiza o atendimento comercial da MuscularFit. Ele utiliza o PlaceFit como plataforma para registrar conversas e acompanhar o atendimento.</P>
      <P>Esta política trata dos dados usados nesse CRM. Ela não substitui as políticas de outros serviços que você utiliza, como o WhatsApp.</P>

      <H2>Dados usados no atendimento</H2>
      <P>Ao conversar com a MuscularFit, você pode fornecer seu nome, número de telefone, conteúdo de mensagens e outras informações incluídas na conversa. O CRM pode registrar a identificação do contato, o texto das mensagens, sua data e horário, direção e status de entrega, além de notas e da etapa do atendimento.</P>
      <P>Na integração oficial com o WhatsApp Business, quando conectada e autorizada pelo responsável pela conta, o CRM também pode receber mensagens enviadas pelo aplicativo WhatsApp Business e informações de contatos. A importação de conversas anteriores depende da autorização para compartilhar o histórico no processo de conexão. Não significa acesso irrestrito ao aparelho ou a todas as conversas pessoais.</P>
      <Pendencia>[REVISÃO TÉCNICA: confirmar os tipos de mensagens e anexos efetivamente armazenados na versão implantada. O rascunho não afirma que áudio, imagem ou arquivo completo já sejam baixados ou transcritos.]</Pendencia>

      <H2>Para que os dados são usados</H2>
      <P>Os dados são usados para identificar o contato, manter o histórico do atendimento, acompanhar pedidos de informação e organizar o trabalho da equipe comercial. Registros técnicos de eventos podem ser usados para conferir a entrega e o processamento das mensagens e investigar falhas.</P>
      <P>Não use este documento para autorizar finalidades que não foram informadas ao contato. Uma eventual ampliação de uso, como automação com inteligência artificial, deve ser avaliada e descrita antes de entrar em operação.</P>

      <H2>Acesso e serviços envolvidos</H2>
      <P>O acesso deve ficar limitado às pessoas autorizadas a realizar ou administrar o atendimento. O PlaceFit fornece a interface e a organização do CRM. A operação utiliza a infraestrutura Base44. Quando a integração oficial estiver ativa, a Meta/WhatsApp participa do recebimento e da sincronização das mensagens.</P>
      <Pendencia>[CONFIRMAR ANTES DE PUBLICAR: lista final de prestadores, papéis de cada organização, armazenamento, países de processamento e eventual transferência internacional. Não afirmar ausência de compartilhamento ou armazenamento no exterior sem essa verificação.]</Pendencia>

      <H2>Segurança e conservação</H2>
      <P>Os dados devem ser protegidos por controles de acesso e medidas compatíveis com o atendimento. Nenhum serviço oferece segurança absoluta.</P>
      <P>A regra definida para conservação de contatos e conversas é de 3 meses, contados da última interação.</P>
      <Pendencia>[REVISÃO TÉCNICA ANTES DE PUBLICAR: implementar e testar o descarte conforme a regra de 3 meses. Critérios de retenção para eventos e backups ainda pendentes.]</Pendencia>

      <H2>Solicitações sobre seus dados</H2>
      <P>Você pode usar fatuex@gmail.com para solicitar informações sobre seus dados, correção de informações ou exclusão, conforme aplicável. Informe um meio de retorno e dados suficientes para localizar o atendimento. Não envie senha, documento completo ou outras informações sensíveis sem necessidade.</P>
      <P>O responsável pode pedir uma confirmação proporcional de identidade para evitar que outra pessoa obtenha ou exclua seus dados. Se houver dados que não possam ser apagados por uma obrigação aplicável, a resposta deve informar essa limitação e seu motivo.</P>
      <P>As instruções de exclusão estão em <DocLink to={CRM_LEGAL_ROUTES.exclusao}>a página de instruções de exclusão deste CRM</DocLink> (rota proposta: /crm/exclusao-de-dados). A exclusão de registros do CRM não apaga automaticamente mensagens que permanecem no seu aparelho, no aparelho de outra pessoa ou em serviços externos.</P>
      <Pendencia>[DEFINIR ANTES DE PUBLICAR: responsável pelo atendimento dessas solicitações, processo de confirmação e forma de resposta. Não prometer prazo ou exclusão automática que ainda não estejam implementados.]</Pendencia>

      <H2>Alterações</H2>
      <P>Mudanças nesta política devem refletir o funcionamento real do CRM. A versão vigente ficará disponível nesta página, com sua data de atualização.</P>
    </CrmLegalLayout>
  );
}
