// Regras do Hub PlaceFit (logistica fabricante -> base -> cliente).
// Funcoes puras: sem banco, sem rede. A funcao hubApi aplica; hubFluxo.test.ts testa.

export class ErroHub extends Error {
  status: number;
  constructor(msg: string, status = 400) {
    super(msg);
    this.status = status;
  }
}

export type Papel = 'coletor' | 'fretista' | 'base' | 'admin';

export type TipoCustodia =
  | 'coletado_no_fabricante'
  | 'entregue_na_base'
  | 'conferido'
  | 'pedido_consolidado'
  | 'retirado_pelo_fretista'
  | 'entregue_ao_cliente';

export const EVENTOS_CUSTODIA: TipoCustodia[] = [
  'coletado_no_fabricante',
  'entregue_na_base',
  'conferido',
  'pedido_consolidado',
  'retirado_pelo_fretista',
  'entregue_ao_cliente',
];

// Evento de custodia -> sobre o que age, status exigido, status seguinte, quem pode, se precisa ser o dono do servico.
export const REGRAS_CUSTODIA: Record<TipoCustodia, {
  alvo: 'pickup' | 'frete';
  de: string[];
  para: string;
  papeis: Papel[];
  dono: boolean;
}> = {
  coletado_no_fabricante: { alvo: 'pickup', de: ['aceita', 'janela_confirmada'], para: 'coletada', papeis: ['coletor'], dono: true },
  entregue_na_base: { alvo: 'pickup', de: ['coletada'], para: 'entregue_base', papeis: ['coletor', 'base', 'admin'], dono: true },
  conferido: { alvo: 'pickup', de: ['entregue_base'], para: 'conferida', papeis: ['base', 'admin'], dono: false },
  pedido_consolidado: { alvo: 'frete', de: ['aguardando_consolidacao'], para: 'consolidado', papeis: ['base', 'admin'], dono: false },
  retirado_pelo_fretista: { alvo: 'frete', de: ['aceito'], para: 'retirado', papeis: ['fretista'], dono: true },
  entregue_ao_cliente: { alvo: 'frete', de: ['retirado'], para: 'entregue', papeis: ['fretista'], dono: true },
};

// O dono so e exigido de coletor/fretista; base e admin agem em qualquer servico.
export function validarCustodia(
  tipo: string,
  alvo: { status: string; dono_user_id?: string | null },
  papel: Papel,
  userId: string,
): { para: string; alvo: 'pickup' | 'frete' } {
  const regra = REGRAS_CUSTODIA[tipo as TipoCustodia];
  if (!regra) throw new ErroHub(`Evento desconhecido: ${tipo}`);
  if (!regra.papeis.includes(papel)) throw new ErroHub('Seu perfil não registra este evento.', 403);
  if (!regra.de.includes(alvo.status)) {
    throw new ErroHub(`Fora de ordem: o serviço está "${ROTULO_STATUS[alvo.status] || alvo.status}".`, 409);
  }
  if (regra.dono && (papel === 'coletor' || papel === 'fretista') && alvo.dono_user_id !== userId) {
    throw new ErroHub('Este serviço está com outra pessoa.', 403);
  }
  return { para: regra.para, alvo: regra.alvo };
}

// Acoes sem QR (fila, janela, liberacao).
export const ACOES_PICKUP: Record<string, { de: string[]; para: string; papeis: Papel[] }> = {
  marcar_pronto: { de: ['aguardando_pronto', 'falsa_coleta'], para: 'disponivel', papeis: ['base', 'admin'] },
  aceitar: { de: ['disponivel'], para: 'aceita', papeis: ['coletor'] },
  atribuir: { de: ['disponivel', 'aceita', 'janela_confirmada'], para: 'aceita', papeis: ['admin'] },
  desistir: { de: ['aceita', 'janela_confirmada'], para: 'disponivel', papeis: ['coletor', 'admin'] },
  confirmar_janela: { de: ['aceita', 'janela_confirmada'], para: 'janela_confirmada', papeis: ['coletor'] },
  falsa_coleta: { de: ['aceita', 'janela_confirmada'], para: 'falsa_coleta', papeis: ['coletor'] },
  cancelar: { de: ['aguardando_pronto', 'disponivel', 'aceita', 'janela_confirmada', 'falsa_coleta'], para: 'cancelada', papeis: ['admin'] },
};

export const ACOES_FRETE: Record<string, { de: string[]; para: string; papeis: Papel[] }> = {
  liberar: { de: ['consolidado'], para: 'disponivel', papeis: ['base', 'admin'] },
  aceitar: { de: ['disponivel'], para: 'aceito', papeis: ['fretista'] },
  atribuir: { de: ['consolidado', 'disponivel', 'aceito'], para: 'aceito', papeis: ['admin'] },
  desistir: { de: ['aceito'], para: 'disponivel', papeis: ['fretista', 'admin'] },
  cancelar: { de: ['aguardando_consolidacao', 'consolidado', 'disponivel', 'aceito'], para: 'cancelado', papeis: ['admin'] },
};

export function validarAcao(
  tabela: Record<string, { de: string[]; para: string; papeis: Papel[] }>,
  acao: string,
  status: string,
  papel: Papel,
): string {
  const regra = tabela[acao];
  if (!regra) throw new ErroHub(`Ação desconhecida: ${acao}`);
  if (!regra.papeis.includes(papel)) throw new ErroHub('Seu perfil não faz esta ação.', 403);
  if (!regra.de.includes(status)) {
    throw new ErroHub(`Não dá para ${acao.replace('_', ' ')}: o serviço está "${ROTULO_STATUS[status] || status}".`, 409);
  }
  return regra.para;
}

export const ROTULO_STATUS: Record<string, string> = {
  aguardando_pronto: 'aguardando fabricante',
  disponivel: 'disponível na fila',
  aceita: 'aceita',
  janela_confirmada: 'janela confirmada',
  coletada: 'coletada',
  entregue_base: 'entregue na base',
  conferida: 'conferida',
  falsa_coleta: 'falsa coleta',
  cancelada: 'cancelada',
  aguardando_consolidacao: 'aguardando consolidação',
  consolidado: 'consolidado',
  aceito: 'aceito',
  retirado: 'saiu para entrega',
  entregue: 'entregue',
  cancelado: 'cancelado',
};

// ---- QR ----
// Conteudo: PFHUB:P:<token> (subpedido) ou PFHUB:F:<token> (pedido consolidado, QR mestre).
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I, para digitar a mao

export function gerarToken(tamanho = 10, rand: (n: number) => Uint8Array = aleatorio): string {
  const bytes = rand(tamanho);
  let s = '';
  for (let i = 0; i < tamanho; i++) s += ALFABETO[bytes[i] % ALFABETO.length];
  return s;
}

function aleatorio(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export function conteudoQr(tipo: 'P' | 'F', token: string): string {
  return `PFHUB:${tipo}:${token}`;
}

// Aceita o QR lido ou o codigo digitado (com ou sem prefixo, minusculas, espacos).
export function lerQr(texto: string): { tipo: 'P' | 'F' | null; token: string } {
  const limpo = String(texto || '').trim().toUpperCase().replace(/\s+/g, '');
  const m = limpo.match(/^PFHUB:([PF]):([A-Z0-9]+)$/);
  if (m) return { tipo: m[1] as 'P' | 'F', token: m[2] };
  if (/^[A-Z0-9]{6,20}$/.test(limpo)) return { tipo: null, token: limpo };
  throw new ErroHub('QR não é de uma etiqueta do Hub PlaceFit.');
}

export function numeroCurto(prefixo: 'COL' | 'FRT', token: string): string {
  return `${prefixo}-${token.slice(0, 5)}`;
}

// ---- Fila ----
export function normalizarCidade(c: string): string {
  return String(c || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

type PerfilFila = { id: string; cidades?: string[]; ufs?: string[]; limite_valor?: number | null };

export function pickupVisivelParaColetor(p: { status: string; fabricante_cidade?: string; valor_mercadoria?: number; recusada_por?: string[] }, perfil: PerfilFila): boolean {
  if (p.status !== 'disponivel') return false;
  if ((p.recusada_por || []).includes(perfil.id)) return false;
  // Fabricante sem cidade no cadastro (a maioria hoje) aparece para todos, senao some de toda fila regional.
  const cidades = (perfil.cidades || []).map(normalizarCidade).filter(Boolean);
  const cidade = normalizarCidade(p.fabricante_cidade || '');
  if (cidades.length && cidade && !cidades.includes(cidade)) return false;
  if (perfil.limite_valor && (p.valor_mercadoria || 0) > perfil.limite_valor) return false;
  return true;
}

export function freteVisivelParaFretista(f: { status: string; destino_uf?: string; valor_mercadoria?: number; recusado_por?: string[] }, perfil: PerfilFila): boolean {
  if (f.status !== 'disponivel') return false;
  if ((f.recusado_por || []).includes(perfil.id)) return false;
  const ufs = (perfil.ufs || []).map((u) => u.toUpperCase().trim()).filter(Boolean);
  if (ufs.length && !ufs.includes(String(f.destino_uf || '').toUpperCase().trim())) return false;
  if (perfil.limite_valor && (f.valor_mercadoria || 0) > perfil.limite_valor) return false;
  return true;
}

// Consolidar so quando todo subpedido nao cancelado ja foi conferido (e existe ao menos um).
export function prontoParaConsolidar(pickups: { status: string }[]): { ok: boolean; faltam: number } {
  const ativos = pickups.filter((p) => p.status !== 'cancelada');
  const faltam = ativos.filter((p) => p.status !== 'conferida').length;
  return { ok: ativos.length > 0 && faltam === 0, faltam };
}

// Quem e avisado de cada evento (o "proximo ator").
export const NOTIFICAR: Record<string, { papeis: ('base' | 'admin' | 'revenda' | 'coletor' | 'fretista')[]; titulo: string }> = {
  pronto: { papeis: ['coletor'], titulo: 'Nova coleta na fila' },
  atribuida: { papeis: ['coletor'], titulo: 'Coleta atribuída a você' },
  coletado_no_fabricante: { papeis: ['base'], titulo: 'Coleta a caminho da base' },
  entregue_na_base: { papeis: ['base'], titulo: 'Volume chegou: conferir' },
  falsa_coleta: { papeis: ['admin', 'base'], titulo: 'Falsa coleta registrada' },
  conferido: { papeis: ['admin'], titulo: 'Subpedido conferido' },
  pedido_consolidado: { papeis: ['admin'], titulo: 'Pedido consolidado' },
  liberado: { papeis: ['fretista'], titulo: 'Novo frete na fila' },
  frete_atribuido: { papeis: ['fretista'], titulo: 'Frete atribuído a você' },
  retirado_pelo_fretista: { papeis: ['revenda', 'admin'], titulo: 'Pedido saiu para entrega' },
  entregue_ao_cliente: { papeis: ['revenda', 'admin'], titulo: 'Pedido entregue' },
};

// ---- Peso estimado pelo catalogo ----
// pesoPorProduto: product_id -> peso_kg do ProductTemplate. Item sem peso no catalogo deixa a estimativa parcial.
export function estimarPeso(
  itens: { product_id?: string; quantidade?: number }[],
  pesoPorProduto: Record<string, number | undefined>,
): { peso_kg: number | null; completo: boolean; sem_peso: number } {
  let total = 0, semPeso = 0;
  for (const it of itens || []) {
    const p = it.product_id ? Number(pesoPorProduto[it.product_id]) : NaN;
    if (Number.isFinite(p) && p > 0) total += p * (Number(it.quantidade) || 1);
    else semPeso++;
  }
  const arred = Math.round(total * 10) / 10;
  return { peso_kg: arred > 0 ? arred : null, completo: semPeso === 0 && arred > 0, sem_peso: semPeso };
}

// ---- Destino do frete ----
// Prioridade: o que o admin digitou > endereco de entrega do pedido da vitrine > cadastro do cliente.
type Destino = { endereco?: string; cidade?: string; uf?: string; cep?: string; telefone?: string };
export function resolverDestino(
  manual: Destino,
  vitrine: { endereco_entrega?: any; cliente_telefone?: string } | null,
  cliente: { endereco?: string; cidade?: string; estado?: string; cep?: string; telefone?: string } | null,
): Destino & { origem: 'manual' | 'pedido_vitrine' | 'cadastro_cliente' | 'sem_destino' } {
  const e = vitrine?.endereco_entrega || {};
  const daVitrine: Destino = {
    endereco: [e.logradouro && `${e.logradouro}${e.numero ? ', ' + e.numero : ''}`, e.complemento, e.bairro].filter(Boolean).join(' — ') || undefined,
    cidade: e.cidade || undefined,
    uf: e.estado || undefined,
    cep: e.cep || undefined,
    telefone: vitrine?.cliente_telefone || undefined,
  };
  const doCliente: Destino = cliente ? {
    endereco: cliente.endereco || undefined, cidade: cliente.cidade || undefined, uf: cliente.estado || undefined,
    cep: cliente.cep || undefined, telefone: cliente.telefone || undefined,
  } : {};
  const base = daVitrine.cidade ? daVitrine : doCliente;
  const limpo = (v?: string) => (v && String(v).trim()) || undefined;
  const r: Destino = {};
  for (const k of ['endereco', 'cidade', 'uf', 'cep', 'telefone'] as const) r[k] = limpo(manual?.[k]) || limpo(base[k]);
  if (r.uf) r.uf = r.uf.toUpperCase().slice(0, 2);
  const temManual = (['endereco', 'cidade', 'uf'] as const).some((k) => limpo(manual?.[k]));
  const origem = temManual ? 'manual' : !r.cidade ? 'sem_destino' : base === daVitrine ? 'pedido_vitrine' : 'cadastro_cliente';
  return { ...r, origem };
}

// ---- Checklist da conferencia ----
// itens: o que o subpedido devia trazer. marcados: um por item (mesma ordem), ok=true se veio tudo;
// se ok=false, quantidade_recebida diz quanto veio (0 = faltou). A divergencia nasce do que nao foi marcado.
export type ItemChecklist = { cod?: string; nome?: string; quantidade?: number };
export type Marcacao = { ok: boolean; quantidade_recebida?: number };

export function conferirChecklist(itens: ItemChecklist[], marcados: Marcacao[]) {
  if (!Array.isArray(marcados) || marcados.length !== (itens || []).length) {
    throw new ErroHub('Confira todos os itens da lista antes de confirmar.');
  }
  const linhas = itens.map((it, i) => {
    const esperado = Number(it.quantidade) || 1;
    const m = marcados[i] || { ok: false };
    const recebido = m.ok ? esperado : Math.max(0, Math.min(esperado, Math.floor(Number(m.quantidade_recebida) || 0)));
    return { cod: it.cod, nome: it.nome, quantidade: esperado, quantidade_recebida: recebido, ok: recebido === esperado };
  });
  const problemas = linhas.filter((l) => !l.ok).map((l) =>
    l.quantidade_recebida === 0
      ? `Faltou ${l.quantidade}x ${l.nome || l.cod || 'item'}`
      : `Veio ${l.quantidade_recebida} de ${l.quantidade}: ${l.nome || l.cod || 'item'}`);
  return { linhas, divergencia: problemas.length ? problemas.join('; ') : null };
}
