// Item 008 (16/10/2026): importacao de tabela de fabricante DIRETO no catalogo padronizado.
// Todo produto importado vira (ou reaproveita) um ProductTemplate e ganha um SupplierProduct do fabricante,
// para aparecer automaticamente no Catalogo Geral, no Ver Catalogo da revenda, no Baixar Tabela,
// em Meus Produtos e no orcamento. NAO grava mais na entidade antiga Product.
import { base44 } from "@/api/base44Client";

export const CATEGORIAS_CATALOGO = ["Anilhas", "Halteres", "Dumbbells", "Tijolinhos", "Pisos", "Colchonetes", "Kettlebells", "Kits", "Barras", "Puxadores", "Suportes", "Acessórios", "Estruturas", "Outros"];

// Padrao de codigos do catalogo para itens novos: PREFIXO-N### (ex.: ACE-N111, KIT-N059, PIS-N002)
const PREFIXO_CATEGORIA = {
  "Anilhas": "ANI", "Halteres": "HAL", "Dumbbells": "DUM", "Tijolinhos": "TIJ", "Pisos": "PIS",
  "Colchonetes": "COL", "Kettlebells": "KET", "Kits": "KIT", "Barras": "BAR", "Puxadores": "PUX",
  "Suportes": "SUP", "Acessórios": "ACE", "Estruturas": "EST", "Outros": "OUT",
};

const semAcento = (s) => (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const normalizarNome = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

// Categoria que nao existe no catalogo vai para Acessorios (decisao do Sr. Leo, 16/10/2026)
export const normalizarCategoria = (c) => {
  const n = normalizarNome(c);
  const achada = CATEGORIAS_CATALOGO.find(cat => normalizarNome(cat) === n);
  return achada || "Acessórios";
};

export const normalizarUnidade = (u) => {
  const n = normalizarNome(u);
  if (["par", "pares"].includes(n)) return "par";
  if (["kg", "quilo", "kilo"].includes(n)) return "kg";
  if (["m2", "m 2", "metro quadrado", "metros quadrados"].includes(n) || (u || "").includes("²")) return "m²";
  if (["kit", "kits", "conjunto"].includes(n)) return "kit";
  return "peça";
};

const numero = (v) => {
  if (v == null) return null;
  let s = String(v).replace(/[R$\s]/g, "");
  if (!s) return null;
  // aceita 1.234,56 e 1234.56
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

// Mapeia colunas pelo NOME do cabecalho; se nao reconhecer, cai no padrao posicional antigo
// nome,codigo,categoria,unidade,peso,dimensoes,preco,foto
const ALIASES = {
  nome: ["nome", "produto", "descricao", "nome do produto", "item"],
  cod: ["codigo", "cod", "sku", "referencia", "ref", "cod origem"],
  categoria: ["categoria", "grupo", "linha"],
  und: ["unidade", "und", "un", "unid"],
  peso: ["peso", "peso kg", "kg"],
  dimensoes: ["dimensoes", "dimensao", "medidas", "medida"],
  preco: ["preco", "valor", "preco unitario", "preco fabrica", "preco r", "preco de fabrica", "valor unitario"],
  foto: ["foto", "imagem", "url foto", "url imagem"],
};
export const mapearColunas = (headers) => {
  const norm = headers.map(h => normalizarNome(h));
  const idx = {};
  for (const [campo, nomes] of Object.entries(ALIASES)) {
    const i = norm.findIndex(h => nomes.includes(h));
    if (i >= 0) idx[campo] = i;
  }
  const reconheceu = idx.nome != null && idx.cod != null && idx.preco != null;
  if (!reconheceu) {
    return { nome: 0, cod: 1, categoria: 2, und: 3, peso: 4, dimensoes: 5, preco: 6, foto: 7, _posicional: true };
  }
  return idx;
};

export const linhaParaItem = (values, idx) => ({
  nome: (values[idx.nome] || "").trim(),
  cod: (values[idx.cod] || "").trim(),
  categoria: idx.categoria != null ? (values[idx.categoria] || "").trim() : "",
  und: idx.und != null ? (values[idx.und] || "").trim() : "",
  peso: idx.peso != null ? numero(values[idx.peso]) : null,
  dimensoes: idx.dimensoes != null ? (values[idx.dimensoes] || "").trim() : "",
  preco: numero(values[idx.preco]),
  foto: idx.foto != null ? (values[idx.foto] || "").trim() : "",
});

const proximoCodigo = (prefixo, codigosUsados) => {
  const re = new RegExp(`^${prefixo}-N(\\d+)$`);
  let max = 0;
  for (const c of codigosUsados) {
    const m = re.exec(c || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  let n = max + 1;
  let cod = `${prefixo}-N${String(n).padStart(3, "0")}`;
  while (codigosUsados.has(cod)) { n++; cod = `${prefixo}-N${String(n).padStart(3, "0")}`; }
  return cod;
};

/**
 * Importa itens de um fabricante para o catalogo.
 * - SKU do fabricante ja importado antes (cod_origem) => ATUALIZA o preco (nao duplica)
 * - Nome igual a um template existente => reaproveita o template e vincula o preco
 * - Senao => cria template novo com codigo no padrao PREFIXO-N### e vincula o preco
 * @returns {{criados:number, vinculados:number, atualizados:number, erros:string[], novosTemplates:Array}}
 */
export async function importarItensNoCatalogo({ fabricante, itens, onProgress }) {
  const fabNome = fabricante.nome_fantasia || fabricante.razao_social || "";
  const [templates, spsFab] = await Promise.all([
    base44.entities.ProductTemplate.list("cod", 10000),
    base44.entities.SupplierProduct.filter({ fabricante_id: fabricante.id }, null, 10000),
  ]);
  const codigosUsados = new Set(templates.map(t => t.cod));
  const templatePorNome = new Map();
  for (const t of templates) {
    const k = normalizarNome(t.nome);
    if (k && !templatePorNome.has(k)) templatePorNome.set(k, t);
  }
  const spPorCodOrigem = new Map();
  const spPorProduto = new Map();
  for (const sp of spsFab) {
    if (sp.cod_origem) spPorCodOrigem.set(sp.cod_origem.trim().toUpperCase(), sp);
    spPorProduto.set(sp.product_id, sp);
  }

  const res = { criados: 0, vinculados: 0, atualizados: 0, erros: [], novosTemplates: [] };
  let i = 0;
  for (const item of itens) {
    i++;
    onProgress?.(i, itens.length);
    try {
      if (!item.nome || !item.cod) { res.erros.push(`Linha ${i}: nome e código são obrigatórios.`); continue; }
      if (!(item.preco > 0)) { res.erros.push(`${item.cod}: sem preço válido.`); continue; }
      const chaveCod = item.cod.toUpperCase();

      // 1) Mesmo SKU do fabricante ja importado => atualiza preco
      const spExistente = spPorCodOrigem.get(chaveCod);
      if (spExistente) {
        await base44.entities.SupplierProduct.update(spExistente.id, { preco: item.preco, disponivel: true, fabricante_nome: fabNome });
        res.atualizados++;
        continue;
      }

      // 2) Template com o mesmo nome => vincula
      let tmpl = templatePorNome.get(normalizarNome(item.nome));
      let criouTemplate = false;
      if (!tmpl) {
        // 3) Cria template novo no padrao de codigos do catalogo
        const categoria = normalizarCategoria(item.categoria);
        const prefixo = PREFIXO_CATEGORIA[categoria] || "ACE";
        const cod = proximoCodigo(prefixo, codigosUsados);
        const dados = {
          nome: item.nome,
          cod,
          categoria,
          und: normalizarUnidade(item.und),
          ativo: true,
        };
        if (item.peso != null) dados.peso_kg = item.peso;
        if (item.foto) dados.foto = item.foto;
        if (item.dimensoes) dados.descricao_padrao = `${item.nome} — ${item.dimensoes}`;
        tmpl = await base44.entities.ProductTemplate.create(dados);
        codigosUsados.add(cod);
        templatePorNome.set(normalizarNome(item.nome), tmpl);
        criouTemplate = true;
        res.novosTemplates.push({ cod, nome: item.nome, cod_origem: item.cod });
      }

      // Se o fabricante ja tem preco nesse template, atualiza em vez de duplicar
      const spMesmoProduto = spPorProduto.get(tmpl.id);
      if (spMesmoProduto) {
        await base44.entities.SupplierProduct.update(spMesmoProduto.id, { preco: item.preco, disponivel: true, cod_origem: item.cod, fabricante_nome: fabNome });
        spPorCodOrigem.set(chaveCod, spMesmoProduto);
        res.atualizados++;
        continue;
      }

      const sp = await base44.entities.SupplierProduct.create({
        fabricante_id: fabricante.id,
        fabricante_nome: fabNome,
        product_id: tmpl.id,
        preco: item.preco,
        margem: 0,
        disponivel: true,
        cod_origem: item.cod,
      });
      spPorCodOrigem.set(chaveCod, sp);
      spPorProduto.set(tmpl.id, sp);
      if (criouTemplate) res.criados++; else res.vinculados++;
    } catch (e) {
      console.error("Erro ao importar item", item, e);
      res.erros.push(`${item.cod || "linha " + i}: ${e?.message || "erro"}`);
    }
  }
  return res;
}
