// Camada ARTISTICA do card: gera so o fundo/cena com IA de imagem.
//
// Regra: a IA nunca escreve texto, numero, logo nem preco. Nome da empresa,
// produto, peso e preco entram depois pela camada de dados (cardProduto.ts).
// A identidade do revendedor chega ao fundo pelas cores e pelo segmento.
//
// Desligada ate existir o secret CARD_ARTE_API_KEY (+ CARD_ARTE_PROVEDOR).
// O provedor so e plugado com OK explicito, depois de chave e custo definidos.

import { ErroCard, type MarcaCard } from './cardProduto.ts';

export const ESTILOS_ARTE: Record<string, string> = {
  academia: 'modern gym interior, dramatic side lighting, shallow depth of field, empty floor in the center',
  estudio: 'clean photo studio backdrop, soft gradient, subtle floor reflection, premium product photography mood',
  industrial: 'raw concrete and steel industrial loft, warm rim light, cinematic atmosphere',
};

export const ESTILO_PADRAO = 'estudio';

export const arteConfigurada = () => !!Deno.env.get('CARD_ARTE_API_KEY') && !!Deno.env.get('CARD_ARTE_PROVEDOR');

export function montarPromptFundo(marca: MarcaCard, estilo: string) {
  const cena = ESTILOS_ARTE[estilo] || ESTILOS_ARTE[ESTILO_PADRAO];
  return [
    `Square 1:1 background image for a fitness equipment social media post. ${cena}.`,
    `Color palette dominated by ${marca.cor_secundaria} with accents of ${marca.cor_primaria}.`,
    'Leave the center and the bottom third calm and uncluttered (a product photo and captions will be placed there later).',
    'STRICTLY NO text, NO letters, NO numbers, NO logos, NO watermarks, NO signage, NO people, NO products.',
  ].join(' ');
}

export type FundoGerado = { url: string; custo: number; provedor: string };

// Chamado so quando nao ha fundo em cache para revendedor+estilo.
export async function gerarFundoArtistico(marca: MarcaCard, estilo: string): Promise<FundoGerado> {
  if (!arteConfigurada()) {
    throw new ErroCard('Card artístico ainda não está disponível. Use o card padrão.', 412);
  }
  const provedor = Deno.env.get('CARD_ARTE_PROVEDOR')!;
  const _prompt = montarPromptFundo(marca, estilo);
  // Ponto de integracao do provedor (HTTP + CARD_ARTE_API_KEY), a definir.
  throw new ErroCard(`Provedor de arte "${provedor}" ainda não implementado.`, 501);
}
