// Layout do card em coluna com 3 faixas, sem DOM nem canvas (testavel puro):
//   topo   - logo a esquerda + badge de peso a direita, mesma linha
//   miolo  - cresce (flex-grow) e centraliza a foto, que escala ao maximo
//            DENTRO dele mantendo a proporcao
//   rodape - painel ancorado na base: nome, preco e WhatsApp
// As faixas topo e rodape ficam dentro da zona segura do destino. Uma escala
// unica de espacamento vale para todas as faixas e todos os formatos.
// verificarLayout() confere automaticamente que nada cruza a propria faixa e
// que nenhum componente encosta em outro.

export const ESPACO = { p: 24, m: 32, g: 48 };

const dentro = (a, b) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;
const separadas = (a, b, folga = 0) =>
  a.x + a.w + folga <= b.x || b.x + b.w + folga <= a.x || a.y + a.h + folga <= b.y || b.y + b.h + folga <= a.y;

// entrada (todas as medidas de texto ja feitas por quem desenha):
//   W, H, topo, base           - quadro e faixas cobertas pela interface do app
//   alturaTopo                 - altura da faixa 1
//   logo {w,h} | null          - tamanho natural da logo (ja aparada)
//   badge {w,h} | null         - badge de peso ja medido
//   foto {w,h} | null          - tamanho natural da foto (ja aparada)
//   reservaSombra              - espaco abaixo da foto para a sombra de contato
//   alturaNome                 - bloco do nome (linhas x entrelinha)
//   preco {w,h}                - linha do preco (valor + sufixo)
//   contato {w,h} | null       - icone + numero
//   contatoAoLado              - contato na linha do preco (senao, embaixo)
export function calcularLayout(e) {
  const { W, H } = e;
  const x0 = ESPACO.g, largura = W - 2 * ESPACO.g;
  const yIni = e.topo, yFim = H - e.base;

  // faixa 3 (rodape): altura vem do conteudo
  const pad = ESPACO.m;
  const alturaLinhaPreco = Math.max(e.preco.h, e.contato && e.contatoAoLado ? e.contato.h : 0);
  const alturaRodape = pad + e.alturaNome + ESPACO.p + alturaLinhaPreco
    + (e.contato && !e.contatoAoLado ? ESPACO.p + e.contato.h : 0) + pad;

  const faixas = {
    topo: { x: x0, y: yIni, w: largura, h: e.alturaTopo },
    rodape: { x: x0, y: yFim - alturaRodape, w: largura, h: alturaRodape },
  };
  const yMiolo = faixas.topo.y + faixas.topo.h + ESPACO.m;
  faixas.miolo = { x: x0, y: yMiolo, w: largura, h: faixas.rodape.y - ESPACO.m - yMiolo };

  const caixas = {};

  // faixa 1: badge a direita; logo ocupa o que sobra a esquerda (com folga g)
  if (e.badge) {
    caixas.badge = { x: x0 + largura - e.badge.w, y: yIni + (e.alturaTopo - e.badge.h) / 2, w: e.badge.w, h: e.badge.h };
  }
  if (e.logo) {
    const larguraMax = Math.min(largura * 0.5, largura - (e.badge ? e.badge.w + ESPACO.g : 0));
    const s = Math.min(e.alturaTopo / e.logo.h, larguraMax / e.logo.w);
    const lw = e.logo.w * s, lh = e.logo.h * s;
    caixas.logo = { x: x0, y: yIni + (e.alturaTopo - lh) / 2, w: lw, h: lh };
  }

  // faixa 2: foto + sombra centralizadas, maior escala que caiba na faixa
  if (e.foto && faixas.miolo.h > e.reservaSombra) {
    const m = faixas.miolo;
    const s = Math.min(m.w / e.foto.w, (m.h - e.reservaSombra) / e.foto.h, 4);
    const pw = e.foto.w * s, ph = e.foto.h * s;
    const y = m.y + (m.h - ph - e.reservaSombra) / 2;
    caixas.foto = { x: m.x + (m.w - pw) / 2, y, w: pw, h: ph };
    const ls = Math.min(m.w, pw * 1.0);
    caixas.sombra = { x: m.x + (m.w - ls) / 2, y: y + ph - e.reservaSombra / 2, w: ls, h: e.reservaSombra };
  }

  // faixa 3: painel e conteudo
  const r = faixas.rodape;
  caixas.painel = { ...r };
  caixas.nome = { x: r.x + pad, y: r.y + pad, w: r.w - 2 * pad, h: e.alturaNome };
  const yPreco = caixas.nome.y + e.alturaNome + ESPACO.p;
  caixas.preco = { x: r.x + pad, y: yPreco + (alturaLinhaPreco - e.preco.h) / 2, w: e.preco.w, h: e.preco.h };
  if (e.contato) {
    caixas.contato = e.contatoAoLado
      ? { x: r.x + r.w - pad - e.contato.w, y: yPreco + (alturaLinhaPreco - e.contato.h) / 2, w: e.contato.w, h: e.contato.h }
      : { x: r.x + pad, y: yPreco + alturaLinhaPreco + ESPACO.p, w: e.contato.w, h: e.contato.h };
  }

  const layout = { faixas, caixas };
  layout.violacoes = verificarLayout(layout, e);
  return layout;
}

const FAIXA_DE = { logo: "topo", badge: "topo", foto: "miolo", sombra: "miolo", painel: "rodape", nome: "rodape", preco: "rodape", contato: "rodape" };

export function verificarLayout({ faixas, caixas }, e) {
  const v = [];
  const zona = { x: 0, y: e.topo, w: e.W, h: e.H - e.topo - e.base };
  for (const [nome, f] of Object.entries(faixas)) {
    if (f.h <= 0) v.push(`faixa ${nome} sem altura (${Math.round(f.h)}px)`);
    if (!dentro(f, zona)) v.push(`faixa ${nome} fora da zona segura`);
  }
  if (faixas.miolo.h < 160) v.push(`miolo pequeno demais para a foto (${Math.round(faixas.miolo.h)}px)`);
  if (!separadas(faixas.topo, faixas.miolo) || !separadas(faixas.miolo, faixas.rodape) || !separadas(faixas.topo, faixas.rodape)) {
    v.push("faixas sobrepostas");
  }
  for (const [nome, c] of Object.entries(caixas)) {
    if (!dentro(c, faixas[FAIXA_DE[nome]])) v.push(`${nome} cruza o limite da faixa ${FAIXA_DE[nome]}`);
  }
  // nenhum componente encosta em outro (painel contem nome/preco/contato por definicao)
  const soltos = Object.keys(caixas).filter((k) => k !== "painel" && k !== "sombra");
  for (let i = 0; i < soltos.length; i++) {
    for (let j = i + 1; j < soltos.length; j++) {
      const a = soltos[i], b = soltos[j];
      const folga = (a === "logo" && b === "badge") || (a === "badge" && b === "logo") ? ESPACO.p : 1;
      if (!separadas(caixas[a], caixas[b], folga)) v.push(`${a} encosta em ${b}`);
    }
  }
  return v;
}
