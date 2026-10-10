import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { carregarDadosCard, RENDERIZADORES, ErroCard, toBase64 } from '../../shared/cardProduto.ts';
import { arteConfigurada, gerarFundoArtistico, ESTILOS_ARTE, ESTILO_PADRAO } from '../../shared/cardArte.ts';

// Gera o card de um produto selecionado do revendedor.
// body: { supplier_product_id, camada?: 'padrao'|'artistica', formato?: 'imagem'|'video', estilo? }
// body: { acao: 'config' } -> diz quais camadas/formatos estao disponiveis (para a tela).
// Resposta: { png_base64, nome_arquivo, card_id, preco_exibido, ... }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    if (body.acao === 'config') {
      return Response.json({
        formatos: Object.keys(RENDERIZADORES).filter((f) => RENDERIZADORES[f]),
        arte_disponivel: arteConfigurada(),
        estilos: Object.keys(ESTILOS_ARTE),
      });
    }

    const formato = body.formato || 'imagem';
    const camada = body.camada === 'artistica' ? 'artistica' : 'padrao';
    const renderizar = RENDERIZADORES[formato];
    if (!renderizar) throw new ErroCard(`Formato "${formato}" ainda não disponível.`, 501);

    const dados = await carregarDadosCard(base44, user, body.supplier_product_id);

    let fundoUrl: string | null = null;
    let custo = 0;
    let provedor: string | undefined;
    let reaproveitado = false;
    const estilo = camada === 'artistica' ? (ESTILOS_ARTE[body.estilo] ? body.estilo : ESTILO_PADRAO) : undefined;

    if (camada === 'artistica') {
      if (!arteConfigurada()) throw new ErroCard('Card artístico ainda não está disponível. Use o card padrão.', 412);
      // Reaproveita o fundo ja gerado para este revendedor+estilo (sem novo custo)
      const anteriores = await base44.asServiceRole.entities.CardGerado.filter(
        { revendedor_id: dados.revendedor_id, camada: 'artistica', estilo_arte: estilo, status: 'concluido' },
        '-created_date', 1,
      );
      if (anteriores?.[0]?.fundo_url) {
        fundoUrl = anteriores[0].fundo_url;
        provedor = anteriores[0].provedor_arte;
        reaproveitado = true;
      } else {
        const fundo = await gerarFundoArtistico(dados.marca, estilo!);
        fundoUrl = fundo.url;
        custo = fundo.custo;
        provedor = fundo.provedor;
      }
    }

    const png = await renderizar(dados, { fundoUrl });

    const registro = await base44.asServiceRole.entities.CardGerado.create({
      revendedor_id: dados.revendedor_id,
      supplier_product_id: dados.supplier_product_id,
      product_id: dados.product_id,
      formato,
      camada,
      status: 'concluido',
      nome_exibido: dados.nome,
      peso_exibido_kg: dados.peso_kg ?? undefined,
      preco_exibido: dados.preco_final,
      custo_credito: custo,
      provedor_arte: provedor,
      estilo_arte: estilo,
      fundo_url: fundoUrl ?? undefined,
      fundo_reaproveitado: reaproveitado,
    }).catch((e: Error) => {
      console.error('CardGerado.create falhou:', e.message);
      return null;
    });

    const slug = dados.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

    return Response.json({
      png_base64: toBase64(png),
      nome_arquivo: `${slug || 'produto'}-${camada}.png`,
      card_id: registro?.id ?? null,
      camada,
      formato,
      nome_exibido: dados.nome,
      peso_exibido_kg: dados.peso_kg,
      preco_exibido: dados.preco_final,
      custo_credito: custo,
    });
  } catch (error) {
    const status = error instanceof ErroCard ? error.status : 500;
    if (status === 500) console.error('Erro gerarCardProduto:', error);
    return Response.json({ error: error.message || 'Erro ao gerar o card' }, { status });
  }
});
