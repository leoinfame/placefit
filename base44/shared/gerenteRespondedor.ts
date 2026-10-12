// ─── Modo gerente do respondedor (número do dono) ───────────────────────────
// Quando a mensagem vem do OWNER_PHONE, o respondedor vira gerente de vendas.
// A CONSULTA é somente leitura por construção (o único caminho de escrita do
// gerente é o orçamento assistido, em orcamentoGerente.ts, com "grava" do dono): este módulo só faz consultas (.filter) e monta
// um resumo em texto. A IA recebe o resumo e não tem ferramenta nenhuma; a
// resposta só pode ir para o próprio dono (quem chama garante). Nada aqui envia
// mensagem a terceiros, altera dados ou converte orçamento em pedido.

export const SAUDACAO_GERENTE = 'Fala, chefe. O que você quer saber?';

export const PROMPT_GERENTE = `Você é o gerente de vendas do dono, respondendo a ele pelo WhatsApp.

DE QUEM SÃO OS DADOS
- O RESUMO DO CRM abaixo é a operação do próprio dono: a conta indicada em "CONTA" (MuscularFit,
  revenda que opera dentro do hub PlaceFit). Quando ele falar em MuscularFit, Muscular, PlaceFit,
  "a loja", "a gente" ou "meus", é tudo esta mesma conta: responda com estes dados.
- Nunca recuse por causa do nome da marca.

COMO FALAR
- Curto e direto, sem rito de venda, sem enrolação. Português do Brasil informal.
- Cumprimento sozinho (oi, bom dia, tudo bem...): se CONVERSA EM ANDAMENTO for "não",
  responda exatamente: "${SAUDACAO_GERENTE}". Se for "sim", NUNCA repita essa frase:
  responda em poucas palavras e retome o último assunto (ex.: "Tô aqui. Quer mais algo
  dos orçamentos?").
- Números e listas: use só o RESUMO DO CRM abaixo. Nunca invente, nunca estime.
- Listas: no máximo 10 linhas, as mais relevantes primeiro; diga quantas ficaram de fora.
- Se a pergunta pede um dado que não está no resumo, diga que esse dado você ainda não
  consegue puxar pelo WhatsApp.

ÁUDIO TRANSCRITO
- Se ORIGEM DA ÚLTIMA MENSAGEM for "áudio transcrito", o texto pode estar errado.
- Se parecer sem sentido, contraditório, cortado, curto demais ou fora do contexto, NÃO
  responda em cima dele: confirme antes, em uma frase ("Entendi que você perguntou <X>, é isso?").
- Se estiver claro e coerente, responda normalmente.

SOMENTE LEITURA
- Você não executa nada: não manda mensagem pra cliente, não altera cadastro, não muda
  etapa, não converte orçamento em pedido, não dá desconto.
- Se o dono pedir uma ação dessas, responda que é ação de escrita, que precisa de
  confirmação explícita dele e que por aqui você ainda não executa — ele faz pelo
  painel do CRM.
- Exceção: CRIAR orçamento tem fluxo próprio por aqui. Se ele quiser criar um e a mensagem
  não deixou claro, explique como pedir: "faz um orçamento pro cliente <CNPJ ou nome> de
  <quantidade> <produto>, ..."; ele confere o resumo e responde "grava".

Responda só com o texto da mensagem, sem aspas nem explicações.`;

const TZ = 'America/Sao_Paulo';
const brl = (v: number) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quando = (s: string) => new Date(/Z|[+-]\d\d:?\d\d$/.test(String(s)) ? s : String(s) + 'Z');
const diaBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' });

/** Início de hoje e da semana (segunda) no horário de Brasília, em UTC. */
function marcos() {
  const agora = new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
  }).formatToParts(agora).map((x) => [x.type, x.value]));
  const hoje = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), 3, 0, 0)); // BRT = UTC-3
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(String(p.weekday));
  const semana = new Date(hoje.getTime() - Math.max(dow, 0) * 86400000);
  const seteDias = new Date(agora.getTime() - 7 * 86400000);
  return { agora, hoje, semana, seteDias };
}

export async function montarResumoGerente(base44: any, tenantId: string, ownerPhone: string): Promise<string> {
  const { agora, hoje, semana, seteDias } = marcos();
  const db = base44.asServiceRole.entities;
  const linhas: string[] = [];
  try {
    const conta = await db.User.get(tenantId);
    linhas.push(`CONTA: ${conta?.empresa || conta?.full_name || 'conta do dono'} (revenda no hub PlaceFit) — todos os dados abaixo são desta conta.`);
  } catch (_) {
    linhas.push('CONTA: conta do dono (MuscularFit, revenda no hub PlaceFit) — todos os dados abaixo são desta conta.');
  }
  linhas.push(`Agora: ${agora.toLocaleString('pt-BR', { timeZone: TZ })} (Brasília). "Semana" = desde segunda ${diaBR(semana)}.`);

  // Orçamentos em aberto: Pedido tipo=orcamento, status=pendente
  try {
    const orc = await db.Pedido.filter({ fornecedor_id: tenantId, tipo: 'orcamento', status: 'pendente' }, '-created_date', 500);
    const soma = (orc || []).reduce((s: number, o: any) => s + (Number(o.total) || 0), 0);
    const deHoje = (orc || []).filter((o: any) => quando(o.created_date) >= hoje).length;
    const daSemana = (orc || []).filter((o: any) => quando(o.created_date) >= semana).length;
    linhas.push(`\nORÇAMENTOS EM ABERTO (Pedido tipo orçamento, status pendente): ${orc.length}${orc.length >= 500 ? '+' : ''} · soma ${brl(soma)} · criados hoje ${deHoje} · nesta semana ${daSemana}`);
    linhas.push('Mais recentes primeiro ("últimos orçamentos" = os primeiros desta lista):');
    for (const o of (orc || []).slice(0, 25)) {
      linhas.push(`- ${o.numero_pedido || 's/nº'} · ${o.cliente_nome || 'sem nome'} · ${brl(o.total)} · ${o.data_pedido || diaBR(quando(o.created_date))}`);
    }
  } catch (e) {
    linhas.push('\nORÇAMENTOS: não consegui ler agora.');
  }

  // Leads e conversas: CRMConversa (exclui a conversa do próprio dono)
  try {
    const conv = ((await db.CRMConversa.filter({ owner_id: tenantId }, '-created_date', 500)) || [])
      .filter((c: any) => String(c.telefone || '') !== ownerPhone);
    const porEtapa: Record<string, number> = {};
    for (const c of conv) porEtapa[c.etapa || 'novo'] = (porEtapa[c.etapa || 'novo'] || 0) + 1;
    const novos = conv.filter((c: any) => (c.etapa || 'novo') === 'novo');
    const leadsHoje = conv.filter((c: any) => quando(c.created_date) >= hoje);
    const leadsSemana = conv.filter((c: any) => quando(c.created_date) >= semana);
    const leads7 = conv.filter((c: any) => quando(c.created_date) >= seteDias);
    linhas.push(`\nLEADS / CONVERSAS (CRMConversa): total ${conv.length}${conv.length >= 500 ? '+' : ''} · etapa novo ${novos.length}`);
    linhas.push(`Por etapa: ${Object.entries(porEtapa).map(([k, v]) => `${k} ${v}`).join(' · ') || 'nenhuma'}`);
    linhas.push(`Leads que chegaram: hoje ${leadsHoje.length} · nesta semana ${leadsSemana.length} · últimos 7 dias ${leads7.length}`);
    for (const c of leadsSemana.slice(0, 15)) {
      linhas.push(`- ${c.nome_contato || c.telefone} · ${c.etapa || 'novo'} · chegou ${diaBR(quando(c.created_date))} · última: ${String(c.ultima_mensagem || '').slice(0, 60)}`);
    }
    const pend = conv.filter((c: any) => String(c.pendencia || '').trim());
    linhas.push(`\nPENDÊNCIAS PROMETIDAS AO CLIENTE (o time precisa confirmar): ${pend.length}`);
    for (const c of pend.slice(0, 15)) {
      const ultima = String(c.pendencia).trim().split('\n').pop();
      linhas.push(`- ${c.nome_contato || c.telefone}: ${ultima}`);
    }
  } catch (e) {
    linhas.push('\nLEADS: não consegui ler agora.');
  }

  // Volume de mensagens (CRMMensagem), sem a conversa do dono
  try {
    const msgs = ((await db.CRMMensagem.filter({ owner_id: tenantId }, '-created_date', 500)) || [])
      .filter((m: any) => String(m.telefone || '') !== ownerPhone && quando(m.created_date) >= semana);
    const rec = msgs.filter((m: any) => m.direcao === 'recebida');
    const env = msgs.filter((m: any) => m.direcao === 'enviada');
    const recHoje = rec.filter((m: any) => quando(m.created_date) >= hoje).length;
    const auto = env.filter((m: any) => m.origem === 'respondedor_ia').length;
    linhas.push(`\nMENSAGENS NESTA SEMANA: recebidas ${rec.length} (hoje ${recHoje}) · enviadas ${env.length} (automáticas ${auto})`);
  } catch (e) {
    linhas.push('\nMENSAGENS: não consegui ler agora.');
  }

  return linhas.join('\n');
}
