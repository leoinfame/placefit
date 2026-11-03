import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { htmlPreviaTabela } from '../../shared/linkTabela.ts';

/**
 * Item 022g: link público da tabela de atacado da revenda — app.placefit.com.br/functions/tabela?supplier=ID.
 * Público, só leitura: devolve o nome da empresa, cidade/UF e o ícone do app para a prévia do WhatsApp
 * e manda o navegador para a tabela. Nenhum outro dado do cadastro sai daqui.
 */
Deno.serve(async (req) => {
  const painel = (Deno.env.get('PAINEL_URL') && !/base44/i.test(Deno.env.get('PAINEL_URL') || '') ? Deno.env.get('PAINEL_URL')! : 'https://app.placefit.com.br');
  const supplierId = new URL(req.url).searchParams.get('supplier') || '';
  let revenda: any = null;
  try {
    if (/^[a-f0-9]{24}$/i.test(supplierId)) {
      const base44 = createClientFromRequest(req);
      const u = (await base44.asServiceRole.entities.User.filter({ id: supplierId }))?.[0];
      if (u && u.tipo_usuario !== 'fabricante' && u.tipo_usuario !== 'transportador') {
        revenda = { empresa: u.empresa || u.full_name || '', cidade: u.cidade || '', estado: u.estado || '' };
      }
    }
  } catch (e) {
    console.error('Erro tabela:', e);
  }
  return new Response(htmlPreviaTabela(painel, supplierId, revenda), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
  });
});
