import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Importa a tabela de um Fabricante a partir de itens JÁ NORMALIZADOS.
 *
 * Diferenças em relação a processSupplierTableUpload:
 *  - Trabalha sobre a entidade Fabricante (fabricante_id), não sobre o User logado.
 *    É isso que permite subir tabela de fabricante que ainda não tem conta.
 *  - Não usa LLM. Quem envia já resolveu extração, tipo_preco e faixa de peso,
 *    então aqui só resta casar com o catálogo — deterministico e auditável.
 *
 * modo='analisar'  -> não grava nada, devolve o plano
 * modo='confirmar' -> grava SupplierProduct + SupplierSkuMap
 *
 * Item de entrada:
 *   { nome, preco, tipo_preco: 'por_kg'|'absoluto', pesos_faixa?: number[],
 *     peso_no_nome?: number, cod_origem?: string }
 */

const stripAccents = (s: string) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

const normalizeCod = (cod: string) =>
  String(cod ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const SINONIMOS: [RegExp, string][] = [
  [/\bbamper\b/g, 'bumper'],
  [/\bhalt\b/g, 'halter'],
  [/\bdumbel{1,2}\b/g, 'dumbbell'],
  [/\bkettle\s*bells?\b/g, 'kettlebell'],
  [/\banilhas\b/g, 'anilha'],
  [/\bolimpico\b/g, 'olimpica'],
  [/\bemborrachado\b/g, 'emborrachada'],
  [/\bpintado\b/g, 'pintada'],
  [/\binjetado\b/g, 'injetada'],
  [/\bcromado\b/g, 'cromada'],
];

const normalizeName = (name: string) => {
  let n = stripAccents(String(name ?? '').trim().toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [re, sub] of SINONIMOS) n = n.replace(re, sub);
  return n;
};

/**
 * Nome sem o peso, para agrupar variações irmãs.
 * O strip do peso vem ANTES de mexer na pontuação, senão "1,5kg" vira "1 5kg"
 * e o item cai num grupo separado — foi o bug corrigido na Onda 1.
 */
const getBaseKey = (name: string) => {
  if (!name) return '';
  const semPeso = stripAccents(String(name).toLowerCase())
    .replace(/\d+(?:[.,]\d+)?\s*kg\b/g, ' ');
  let n = semPeso.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, sub] of SINONIMOS) n = n.replace(re, sub);
  return n;
};

const tokens = (s: string) =>
  new Set(normalizeName(s).split(' ').filter((w) => w.length > 1));

/** Jaccard entre conjuntos de tokens. */
const similaridade = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
};

const chaveDePara = (nome: string, peso: number | null) => {
  const base = normalizeName(nome).split(' ').filter((w) => w.length > 1).sort().join(' ');
  return peso != null ? `${base}|${peso}` : base;
};

const DETERMINISTICO = ['de_para', 'sku_exato', 'nome_exato', 'nome_peso_exato'];
const MARGEM_FUZZY = 0.08; // vantagem mínima sobre o 2º colocado (regra da Onda 1)
const SCORE_MINIMO = 0.45;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Apenas admin pode importar tabela de fabricante' }, { status: 403 });
    }

    const body = await req.json();
    const { fabricante_id, itens, modo = 'analisar', margem_padrao = 0 } = body;

    if (!fabricante_id) return Response.json({ error: 'fabricante_id é obrigatório' }, { status: 400 });
    if (!Array.isArray(itens) || !itens.length) {
      return Response.json({ error: 'itens é obrigatório e não pode ser vazio' }, { status: 400 });
    }

    const fabricante = await base44.asServiceRole.entities.Fabricante.get(fabricante_id);
    if (!fabricante) return Response.json({ error: 'Fabricante não encontrado' }, { status: 404 });

    const [templates, skuMaps, existentes] = await Promise.all([
      base44.asServiceRole.entities.ProductTemplate.filter({ ativo: true }),
      base44.asServiceRole.entities.SupplierSkuMap.filter({ supplier_id: fabricante_id, ativo: true }),
      base44.asServiceRole.entities.SupplierProduct.filter({ fabricante_id }),
    ]);

    // índices do catálogo
    const porId = new Map(templates.map((t: any) => [t.id, t]));
    const porCod = new Map<string, any>();
    const porBaseKey = new Map<string, any[]>();
    for (const t of templates) {
      const c = normalizeCod(t.cod);
      if (c && !porCod.has(c)) porCod.set(c, t);
      const bk = getBaseKey(t.nome);
      if (!porBaseKey.has(bk)) porBaseKey.set(bk, []);
      porBaseKey.get(bk)!.push(t);
    }
    const tokensPorTemplate = new Map(templates.map((t: any) => [t.id, tokens(t.nome)]));

    const existentePorPid = new Map(existentes.map((sp: any) => [sp.product_id, sp]));
    const mapPorChave = new Map<string, any>();
    for (const m of skuMaps) if (m.chave) mapPorChave.set(m.chave, m);

    /** Acha o template de um nome + peso alvo. */
    const casar = (nome: string, pesoAlvo: number | null, codOrigem: string | null) => {
      // 1. de-para já confirmado numa importação anterior
      const chaveCod = codOrigem ? normalizeCod(codOrigem) : '';
      const hit = mapPorChave.get(chaveDePara(nome, pesoAlvo)) ||
                  (chaveCod ? mapPorChave.get(chaveCod) : null);
      if (hit && porId.has(hit.product_id)) {
        return { template: porId.get(hit.product_id), via: 'de_para', score: 1 };
      }

      // 2. código exato do catálogo
      if (chaveCod && porCod.has(chaveCod)) {
        return { template: porCod.get(chaveCod), via: 'sku_exato', score: 1 };
      }

      // 3. baseKey idêntico + peso exato
      const grupo = porBaseKey.get(getBaseKey(nome)) || [];
      if (grupo.length) {
        if (pesoAlvo == null) {
          if (grupo.length === 1) return { template: grupo[0], via: 'nome_exato', score: 1 };
        } else {
          const exatos = grupo.filter(
            (t: any) => t.peso_kg != null && Math.abs(t.peso_kg - pesoAlvo) < 0.001
          );
          if (exatos.length === 1) return { template: exatos[0], via: 'nome_peso_exato', score: 1 };
          if (exatos.length > 1) {
            return { template: null, via: 'ambiguo', score: 0.9, ambiguidade: exatos.length };
          }
        }
      }

      // 4. fuzzy por tokens, exigindo vantagem sobre o 2º colocado
      const alvo = tokens(nome);
      const candidatos = templates
        .filter((t: any) => pesoAlvo == null || (t.peso_kg != null && Math.abs(t.peso_kg - pesoAlvo) < 0.001))
        .map((t: any) => ({ t, s: similaridade(alvo, tokensPorTemplate.get(t.id)!) }))
        .sort((a, b) => b.s - a.s);

      if (!candidatos.length || candidatos[0].s < SCORE_MINIMO) {
        return { template: null, via: 'sem_match', score: 0 };
      }
      const segundo = candidatos[1]?.s ?? 0;
      if (candidatos[0].s - segundo < MARGEM_FUZZY) {
        return { template: null, via: 'fuzzy_ambiguo', score: candidatos[0].s, rival: candidatos[1]?.t?.nome };
      }
      return { template: candidatos[0].t, via: 'fuzzy', score: Math.round(candidatos[0].s * 100) / 100 };
    };

    // expande cada linha de entrada nos SKUs concretos que ela representa
    const linhas: any[] = [];
    for (const it of itens) {
      const nome = String(it.nome ?? '').trim();
      const preco = Number(it.preco);
      if (!nome || !preco || preco <= 0) {
        linhas.push({ nome, status: 'vermelho', motivo: 'Linha sem nome ou sem preço válido' });
        continue;
      }

      if (it.tipo_preco === 'por_kg') {
        const pesos: number[] = Array.isArray(it.pesos_faixa) ? it.pesos_faixa : [];
        if (!pesos.length) {
          linhas.push({ nome, status: 'vermelho', motivo: 'Preço por kg sem faixa de peso declarada' });
          continue;
        }
        for (const w of pesos) {
          linhas.push({
            nome, peso_kg: w, preco_final: Math.round(preco * w * 100) / 100,
            preco_origem: preco, tipo_preco: 'por_kg', cod_origem: it.cod_origem ?? null,
          });
        }
      } else {
        const peso = it.peso_no_nome != null && it.peso_no_nome !== '' ? Number(it.peso_no_nome) : null;
        linhas.push({
          nome, peso_kg: peso, preco_final: Math.round(preco * 100) / 100,
          preco_origem: preco, tipo_preco: 'absoluto', cod_origem: it.cod_origem ?? null,
        });
      }
    }

    // casa cada SKU com o catálogo
    const plano: any[] = [];
    const usosPorTemplate = new Map<string, number>();
    for (const l of linhas) {
      if (l.status === 'vermelho') { plano.push(l); continue; }
      const r = casar(l.nome, l.peso_kg ?? null, l.cod_origem);
      if (!r.template) {
        let motivo = 'Nenhum template correspondente no catálogo';
        if (r.via === 'fuzzy_ambiguo') {
          motivo = `Empate entre templates (melhor ${r.score}, rival "${r.rival}") — precisa de escolha manual`;
        } else if (r.via === 'ambiguo') {
          motivo = `${r.ambiguidade} templates com mesmo nome e peso — precisa de escolha manual`;
        }
        plano.push({ ...l, status: 'vermelho', via: r.via, motivo });
        continue;
      }
      const t = r.template;
      usosPorTemplate.set(t.id, (usosPorTemplate.get(t.id) ?? 0) + 1);
      const atual = existentePorPid.get(t.id);
      const deterministico = DETERMINISTICO.includes(r.via);
      // Apenas categorias vendidas por peso usam preço por kg; Pisos, Tijolinhos,
      // Colchonetes, Kits etc. são sempre por unidade, mesmo se a origem veio como por_kg.
      const WEIGHT_CATEGORIES = ['Anilhas', 'Halteres', 'Dumbells', 'Kettlebells'];
      const isWeightCategory = t.categoria && WEIGHT_CATEGORIES.includes(t.categoria);
      const precoFinal = isWeightCategory ? l.preco_final : l.preco_origem;
      plano.push({
        ...l,
        preco_final: precoFinal,
        product_id: t.id, cod: t.cod, nome_catalogo: t.nome, categoria: t.categoria,
        template_peso_kg: t.peso_kg,
        via: r.via, score: r.score,
        ja_existe: !!atual,
        preco_atual: atual?.preco ?? null,
        delta: atual?.preco != null ? Math.round((precoFinal - atual.preco) * 100) / 100 : null,
        status: deterministico ? 'verde' : 'amarelo',
        motivo: deterministico ? `Casado por ${r.via}` : `Casado por similaridade (${r.score})`,
      });
    }

    // dois SKUs caindo no mesmo template = preço da origem colidindo
    for (const p of plano) {
      if (p.product_id && (usosPorTemplate.get(p.product_id) ?? 0) > 1) {
        p.conflito = true;
        if (p.status === 'verde') p.status = 'amarelo';
        p.motivo = `${p.motivo} — ATENÇÃO: outro item da tabela casou com este mesmo template`;
      }
    }

    const resumo = {
      fabricante: fabricante.razao_social,
      linhas_entrada: itens.length,
      skus_gerados: plano.length,
      verde: plano.filter((p) => p.status === 'verde').length,
      amarelo: plano.filter((p) => p.status === 'amarelo').length,
      vermelho: plano.filter((p) => p.status === 'vermelho').length,
      novos: plano.filter((p) => p.product_id && !p.ja_existe).length,
      atualizados: plano.filter((p) => p.product_id && p.ja_existe).length,
      com_mudanca_de_preco: plano.filter((p) => p.delta != null && p.delta !== 0).length,
      conflitos_mesmo_template: plano.filter((p) => p.conflito).length,
    };

    if (modo !== 'confirmar') {
      return Response.json({ success: true, modo: 'analisar', resumo, plano });
    }

    // ---- gravação
    const gravaveis = plano.filter((p) => p.product_id && p.status !== 'vermelho');
    let criados = 0, atualizados = 0, mapeamentos = 0;

    for (const p of gravaveis) {
      const dados: any = {
        fabricante_id,
        product_id: p.product_id,
        preco: p.preco_final,
        margem: margem_padrao,
        fabricante_nome: fabricante.razao_social,
        disponivel: true,
      };
      if (p.cod_origem) dados.cod_origem = p.cod_origem;

      const atual = existentePorPid.get(p.product_id);
      if (atual) {
        await base44.asServiceRole.entities.SupplierProduct.update(atual.id, dados);
        atualizados++;
      } else {
        const novo = await base44.asServiceRole.entities.SupplierProduct.create(dados);
        existentePorPid.set(p.product_id, novo);
        criados++;
      }

      // grava o de-para para a próxima importação não adivinhar de novo
      const chave = chaveDePara(p.nome, p.peso_kg ?? null);
      if (mapPorChave.has(chave)) continue;
      await base44.asServiceRole.entities.SupplierSkuMap.create({
        supplier_id: fabricante_id,
        chave,
        tipo_chave: 'nome',
        cod_origem: p.cod_origem ?? undefined,
        descricao_origem: p.nome,
        product_id: p.product_id,
        origem_match: DETERMINISTICO.includes(p.via) ? 'sku_exato' : 'fuzzy_confirmado',
        confirmado_por: user.email,
        ativo: true,
      });
      mapPorChave.set(chave, true);
      mapeamentos++;
    }

    return Response.json({
      success: true, modo: 'confirmar',
      resumo: { ...resumo, criados, atualizados, mapeamentos_gravados: mapeamentos },
    });
  } catch (error) {
    console.error('Erro importarTabelaFabricante:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});