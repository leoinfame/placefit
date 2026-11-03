// Item 024 — testes das regras de painel (sem DOM). Rodar: node --test src/lib/crmGamificacao.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularPlacar, semaforoDaConversa, sugestaoFollowUp, proximoPassoSugerido,
  nomeExibicaoCliente, configEfetiva, diasDesde, NAO_IDENTIFICADO
} from "./crmGamificacao.js";

const config = configEfetiva({});
const orcamento = (total, extra = {}) => ({
  id: "o1", numero_pedido: "ORC-1", total,
  created_date: new Date(Date.now() - 3 * 86400000).toISOString(),
  itens: [{ cod: "ANI-10", nome: "Anilha Olímpica 10 kg", quantidade: 4, preco_unitario: 120 }],
  ...extra
});

// ACEITE 1 — placar com motivo visível e semáforo na etapa certa.
test("placar mostra motivo de cada ponto", () => {
  const placar = calcularPlacar({ orcamento: orcamento(6000), diasSemRetorno: 3, diasUltimoContato: 0, config });
  assert.equal(placar.pontos, 10); // +20 valor alto, +20 contato hoje, -30 (3 dias x 10)
  assert.ok(placar.motivos.some((m) => m.pontos === 20 && /acima de/.test(m.motivo)));
  assert.ok(placar.motivos.some((m) => m.pontos === -30 && /3 dias sem retorno/.test(m.motivo)));
  assert.ok(placar.motivos.every((m) => typeof m.motivo === "string" && m.motivo.length > 3));
});

test("sem orçamento o placar explica que começa no orçamento", () => {
  const placar = calcularPlacar({ orcamento: null, config });
  assert.equal(placar.pontos, 0);
  assert.match(placar.motivos[0].motivo, /orçamento/i);
});

test("semáforo: orçamento esfria em 2 dias, negociação em 5", () => {
  assert.equal(semaforoDaConversa("orcamento", 2, config).faixa, "conversa");
  assert.equal(semaforoDaConversa("orcamento", 3, config).faixa, "esfriando");
  assert.equal(semaforoDaConversa("orcamento", 5, config).faixa, "parado");
  assert.equal(semaforoDaConversa("orcamento", 7, config).faixa, "recuperar");
  assert.equal(semaforoDaConversa("negociacao", 5, config).faixa, "conversa");
  assert.equal(semaforoDaConversa("negociacao", 6, config).faixa, "esfriando");
  assert.equal(semaforoDaConversa("ganho", 30, config), null);
});

test("limites são trocáveis em configuração", () => {
  const trocado = configEfetiva({ limite_orcamento_dias: 4, limite_negociacao_dias: 9 });
  assert.equal(semaforoDaConversa("orcamento", 4, trocado).faixa, "conversa");
  assert.equal(semaforoDaConversa("negociacao", 9, trocado).faixa, "conversa");
  assert.equal(trocado.limite_atendimento_dias, 2);
});

// ACEITE 2 — ranking: dias sem retorno e próximo passo sugerido.
test("próximo passo sugerido segue a cadência 1-2 / 4-5 / 10-14", () => {
  assert.match(proximoPassoSugerido(1), /1 a 2 dias/);
  assert.match(proximoPassoSugerido(4), /4 a 5 dias/);
  assert.match(proximoPassoSugerido(12), /10 a 14 dias/);
  assert.match(proximoPassoSugerido(30), /liberação do estoque/i);
});

test("dias sem retorno é contado em dias inteiros", () => {
  const iso = new Date(Date.now() - 3 * 86400000).toISOString();
  assert.equal(diasDesde(iso), 3);
  assert.equal(diasDesde(""), 0);
});

// ACEITE 4 — sugestão sempre com motivo novo e nunca enviada sozinha.
test("sugestão tem motivo novo em cada faixa e cita o orçamento", () => {
  const faixas = [[0, "Dúvida técnica"], [4, "Frete e prazo"], [10, "Condição comercial"], [20, "Liberação de estoque"]];
  for (const [dias, motivo] of faixas) {
    const s = sugestaoFollowUp({ orcamento: orcamento(3000), diasSemRetorno: dias, nome: "Carlos Silva" });
    assert.equal(s.motivo, motivo);
    assert.match(s.texto, /^Oi, Carlos!/);
    assert.match(s.texto, /ORC-1/);
    assert.doesNotMatch(s.texto, /e a[íi],? viu/i);
    assert.ok(s.texto.length > 60);
  }
});

// ACEITE 5 — contato sem telefone real nunca ganha número inventado.
test("contato sem nome/telefone real aparece como não identificado", () => {
  assert.equal(nomeExibicaoCliente({ orcamento: { cliente_nome: "" }, conversa: { nome_contato: "5537999998888" } }), NAO_IDENTIFICADO);
  assert.equal(nomeExibicaoCliente({ orcamento: { cliente_nome: "" }, conversa: null }), NAO_IDENTIFICADO);
  assert.equal(nomeExibicaoCliente({ orcamento: { cliente_nome: "Ana" }, conversa: null }), "Ana");
  assert.equal(NAO_IDENTIFICADO, "Não identificado");
});