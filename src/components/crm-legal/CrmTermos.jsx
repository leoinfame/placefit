import React from "react";
import CrmLegalLayout, { CRM_LEGAL_ROUTES, VIGENCIA_RASCUNHO, Pendencia, DocLink, H2, P } from "./CrmLegalLayout";

export default function CrmTermos() {
  return (
    <CrmLegalLayout titulo="Termos de Serviço do CRM MuscularFit" tituloAba="CRM MuscularFit - termos">
      <P>RASCUNHO PARA REVISÃO. Não publicado. Os pontos pendentes aparecem destacados.</P>
      <P>Data de vigência: {VIGENCIA_RASCUNHO}</P>
      <P>Responsável pelo serviço: MuscularFit (identificação jurídica completa pendente de conferência)</P>
      <P>Contato: fatuex@gmail.com</P>

      <H2>Serviço e finalidade</H2>
      <P>O CRM MuscularFit é um ambiente para organizar o atendimento comercial da MuscularFit, usando o PlaceFit como plataforma. Ele permite registrar contatos e conversas e acompanhar etapas do atendimento.</P>
      <P>Estes termos tratam do uso do CRM pelas pessoas autorizadas a operá-lo. Eles não são um contrato de compra de equipamentos e não criam condições de preço, frete, pagamento ou garantia de produtos.</P>

      <H2>Acesso e uso autorizado</H2>
      <P>O acesso ao CRM deve ser feito pelas pessoas autorizadas pelo responsável pelo serviço. Não compartilhe credenciais nem use uma conta de outra pessoa. O CRM não deve ser usado para acessar dados sem autorização, enviar mensagens abusivas ou fazer uso de informações fora da finalidade do atendimento.</P>
      <P>A conexão de uma conta WhatsApp Business exige autorização do responsável por essa conta. A importação de contatos ou histórico deve respeitar as escolhas feitas no processo de conexão. A autorização para importar dados não é autorização para enviar mensagens automaticamente.</P>

      <H2>Operação do atendimento</H2>
      <P>Os registros do CRM ajudam a organizar o atendimento, mas não substituem a conferência das condições de uma venda ou de um pedido. Uma etapa marcada no sistema, por si só, não confirma pagamento, entrega ou contratação.</P>
      <P>Integrações podem sofrer atrasos, indisponibilidade ou limitações. Informações importantes devem ser conferidas nas fontes do atendimento. Não há promessa de captura integral ou em tempo real de todas as mensagens.</P>
      <P>A integração deve ser configurada para preservar o uso autorizado do WhatsApp Business no aparelho. Seus requisitos e impactos devem ser apresentados antes da conexão. Este documento não promete ausência de mudanças em recursos ou aparelhos vinculados.</P>

      <H2>Dados e confidencialidade</H2>
      <P>Quem opera o CRM deve tratar os dados de contatos e conversas apenas para as finalidades autorizadas e respeitar os controles de acesso. As práticas de tratamento e as solicitações dos titulares são descritas na Política de Privacidade do CRM MuscularFit, disponível em <DocLink to={CRM_LEGAL_ROUTES.privacidade}>a página de privacidade deste CRM</DocLink> (rota proposta: /crm/privacidade).</P>
      <P>Não copie ou compartilhe dados fora do atendimento sem fundamento e autorização aplicáveis.</P>

      <H2>Serviços externos</H2>
      <P>O CRM depende da plataforma PlaceFit e da infraestrutura Base44. A integração oficial com WhatsApp depende dos serviços e requisitos da Meta. Esses serviços têm condições próprias; o uso do CRM não elimina a necessidade de respeitá-las.</P>

      <H2>Encerramento e solicitações</H2>
      <P>Solicitações de acesso, correção ou exclusão de dados devem ser feitas por fatuex@gmail.com, conforme a <DocLink to={CRM_LEGAL_ROUTES.privacidade}>política de privacidade</DocLink> e as <DocLink to={CRM_LEGAL_ROUTES.exclusao}>instruções de exclusão</DocLink>. Encerrar acesso ao CRM, desconectar uma integração e apagar dados são operações diferentes. Uma delas não deve ser apresentada como execução automática das demais.</P>
      <Pendencia>[CONFIRMAR ANTES DE PUBLICAR: regras reais de encerramento de acesso e responsabilidade operacional. Este rascunho não inclui cobrança, renovação, multa, cessão de direitos, foro ou exoneração de responsabilidade. Nenhum desses termos comerciais ou jurídicos foi aprovado.]</Pendencia>

      <H2>Atualizações</H2>
      <P>Os termos devem acompanhar a operação real do CRM. A versão vigente ficará nesta página com a data de atualização. Mudanças de finalidade ou de condições não devem ser introduzidas apenas pela edição silenciosa do texto.</P>
    </CrmLegalLayout>
  );
}
