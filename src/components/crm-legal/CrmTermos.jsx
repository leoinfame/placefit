import React from "react";
import CrmLegalLayout, { CRM_LEGAL_ROUTES, VIGENCIA, RESPONSAVEL, DocLink, H2, P } from "./CrmLegalLayout";

export default function CrmTermos() {
  return (
    <CrmLegalLayout titulo="Termos de Serviço do CRM MuscularFit" tituloAba="CRM MuscularFit - termos">
      <P>Data de vigência: {VIGENCIA}</P>
      <P>Responsável pelo serviço: {RESPONSAVEL}</P>
      <P>Contato: fatuex@gmail.com</P>

      <H2>Serviço e finalidade</H2>
      <P>O CRM MuscularFit é um ambiente para organizar o atendimento comercial da MuscularFit, usando o PlaceFit como plataforma. Ele permite registrar contatos e conversas e acompanhar etapas do atendimento.</P>
      <P>Estes termos tratam do uso do CRM pelas pessoas autorizadas a operá-lo. Eles não são um contrato de compra de equipamentos e não criam condições de preço, frete, pagamento ou garantia de produtos.</P>

      <H2>Acesso e uso autorizado</H2>
      <P>O acesso ao CRM é feito pelas pessoas autorizadas pelo responsável pelo serviço. Não compartilhe credenciais nem use uma conta de outra pessoa. O CRM não deve ser usado para acessar dados sem autorização, enviar mensagens abusivas ou fazer uso de informações fora da finalidade do atendimento.</P>
      <P>A conexão de uma conta WhatsApp Business exige autorização do responsável por essa conta. A importação de contatos ou histórico respeita as escolhas feitas no processo de conexão. A autorização para importar dados não é autorização para enviar mensagens automaticamente.</P>

      <H2>Operação do atendimento</H2>
      <P>Os registros do CRM ajudam a organizar o atendimento, mas não substituem a conferência das condições de uma venda ou de um pedido. Uma etapa marcada no sistema, por si só, não confirma pagamento, entrega ou contratação.</P>
      <P>Integrações podem sofrer atrasos, indisponibilidade ou limitações. Informações importantes devem ser conferidas nas fontes do atendimento. Não há promessa de captura integral ou em tempo real de todas as mensagens.</P>
      <P>A integração é configurada para preservar o uso autorizado do WhatsApp Business no aparelho. Este documento não promete ausência de mudanças em recursos ou aparelhos vinculados.</P>

      <H2>Dados e confidencialidade</H2>
      <P>Quem opera o CRM trata os dados de contatos e conversas apenas para as finalidades autorizadas e respeita os controles de acesso. As práticas de tratamento e as solicitações dos titulares são descritas na <DocLink to={CRM_LEGAL_ROUTES.privacidade}>Política de Privacidade do CRM MuscularFit</DocLink>.</P>
      <P>Não copie ou compartilhe dados fora do atendimento sem fundamento e autorização aplicáveis.</P>
      <P>Não há descarte automático de dados neste momento. Contatos e conversas permanecem no CRM até serem apagados manualmente pelo responsável.</P>

      <H2>Serviços externos</H2>
      <P>O CRM depende da plataforma PlaceFit e da infraestrutura Base44. A integração oficial com WhatsApp depende dos serviços e requisitos da Meta. Esses serviços têm condições próprias; o uso do CRM não elimina a necessidade de respeitá-las.</P>
      <P>O app funciona no plano Builder da Base44. Fora do plano Enterprise, a Base44 pode usar os dados do workspace, incluindo as conversas do CRM, para treinar modelos de inteligência artificial, como descrito na política de privacidade.</P>

      <H2>Encerramento e solicitações</H2>
      <P>Pedidos de informação ou correção de dados podem ser feitos por fatuex@gmail.com. O pedido de exclusão só é aceito pelo WhatsApp, a partir do mesmo número cadastrado no atendimento, e é atendido manualmente, conforme as <DocLink to={CRM_LEGAL_ROUTES.exclusao}>instruções de exclusão</DocLink>.</P>
      <P>Encerrar acesso ao CRM, desconectar uma integração e apagar dados são operações diferentes. Uma delas não é executada automaticamente pelas demais.</P>

      <H2>Atualizações</H2>
      <P>Os termos acompanham a operação real do CRM. A versão vigente fica nesta página com a data de atualização. Mudanças de finalidade ou de condições não são introduzidas apenas pela edição silenciosa do texto.</P>
    </CrmLegalLayout>
  );
}
