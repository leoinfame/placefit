// Item 024: testes da busca completa da gamificação (filtros e ordenação).
import { test } from "node:test";
import assert from "node:assert/strict";
import { FILTROS_VAZIOS, aplicarFiltros, contarFiltrosAtivos, ordenarLinhas } from "./gamificacaoFiltros.js";

const linha = (extra = {}) => ({
  id: extra.id || "1",
  nome: "Cliente",
  numero: "ORC-1",
  telefone: "5537999990000",
  valor: 1000,
  diasSemRetorno: 3,
  diasUltimoContato: 5,
  criado: "2026-10-01T10:00:00Z",
  ultimoContatoCliente: "2026-10-20T10:00:00Z",
  ultimoContatoNosso: "2026-10-21T10:00:00Z",
  etapa: "orcamento",
  semaforoFaixa: "esfriando",
  passoRegistrado: false,
  pausado: false,
  pontos: 20,
  orcamento: { numero_pedido: "ORC-1", itens: [{ nome: "Anilha vazada 10 kg", cod: "ANI-1" }] },
  ...extra
});

const nomes = (linhas) => linhas.map((l) => l.nome);

test("busca ignora acento e acha nome, telefone, número e item", () => {
  const base = [linha({ id: "a", nome: "João Pé de Anjo" }), linha({ id: "b", nome: "Academia Forte", telefone: "5537988887777", numero: "ORC-999" })];
  assert.deepEqual(nomes(aplicarFiltros(base, { busca: "joao pe" })), ["João Pé de Anjo"]);
  assert.deepEqual(nomes(aplicarFiltros(base, { busca: "988887777" })), ["Academia Forte"]);
  assert.deepEqual(nomes(aplicarFiltros(base, { busca: "orc-999" })), ["Academia Forte"]);
  assert.deepEqual(nomes(aplicarFiltros(base, { busca: "anilha vazada" })), ["João Pé de Anjo", "Academia Forte"]);
  assert.deepEqual(nomes(aplicarFiltros(base, { busca: "inexistente" })), []);
});

test("faixas de valor e de dias são inclusivas e aceitam vazio", () => {
  const base = [linha({ id: "a", valor: 500, diasSemRetorno: 1 }), linha({ id: "b", valor: 5000, diasSemRetorno: 8 })];
  assert.deepEqual(aplicarFiltros(base, { valorMin: "1000" }).map((l) => l.id), ["b"]);
  assert.deepEqual(aplicarFiltros(base, { valorMax: "1000" }).map((l) => l.id), ["a"]);
  assert.deepEqual(aplicarFiltros(base, { valorMin: "500", valorMax: "5000" }).length, 2);
  assert.deepEqual(aplicarFiltros(base, { diasMin: "5", diasMax: "10" }).map((l) => l.id), ["b"]);
  assert.deepEqual(aplicarFiltros(base, { valorMin: "60000" }).length, 0);
});

test("filtra etapa, semáforo, próximo passo e estado do bot", () => {
  const base = [
    linha({ id: "a", etapa: "negociacao", semaforoFaixa: "parado", passoRegistrado: true, pausado: true }),
    linha({ id: "b", etapa: "novo", semaforoFaixa: "", passoRegistrado: false, pausado: false })
  ];
  assert.deepEqual(aplicarFiltros(base, { etapa: "negociacao" }).map((l) => l.id), ["a"]);
  assert.deepEqual(aplicarFiltros(base, { semaforo: "parado" }).map((l) => l.id), ["a"]);
  assert.deepEqual(aplicarFiltros(base, { semaforo: "sem_regra" }).map((l) => l.id), ["b"]);
  assert.deepEqual(aplicarFiltros(base, { passo: "com" }).map((l) => l.id), ["a"]);
  assert.deepEqual(aplicarFiltros(base, { passo: "sem" }).map((l) => l.id), ["b"]);
  assert.deepEqual(aplicarFiltros(base, { bot: "pausado" }).map((l) => l.id), ["a"]);
  assert.deepEqual(aplicarFiltros(base, { bot: "automatico" }).map((l) => l.id), ["b"]);
});

test("períodos de orçamento e de última resposta do cliente", () => {
  const base = [
    linha({ id: "a", criado: "2026-10-01T10:00:00Z", ultimoContatoCliente: "2026-10-20T10:00:00Z" }),
    linha({ id: "b", criado: "2026-10-25T10:00:00Z", ultimoContatoCliente: "" })
  ];
  assert.deepEqual(aplicarFiltros(base, { criadoDe: "2026-10-20" }).map((l) => l.id), ["b"]);
  assert.deepEqual(aplicarFiltros(base, { criadoAte: "2026-10-10" }).map((l) => l.id), ["a"]);
  assert.deepEqual(aplicarFiltros(base, { contatoDe: "2026-10-19" }).map((l) => l.id), ["a"]);
  assert.deepEqual(aplicarFiltros(base, { contatoAte: "2026-10-19" }).length, 0);
});

test("ordem alfabética e por valor respeitam a direção", () => {
  const base = [
    linha({ id: "a", nome: "Zeta", valor: 100 }),
    linha({ id: "b", nome: "alfa", valor: 900 }),
    linha({ id: "c", nome: "Beta", valor: 500 })
  ];
  assert.deepEqual(ordenarLinhas(base, "nome", "asc").map((l) => l.nome), ["alfa", "Beta", "Zeta"]);
  assert.deepEqual(ordenarLinhas(base, "valor", "desc").map((l) => l.valor), [900, 500, 100]);
  assert.deepEqual(aplicarFiltros(base, { ...FILTROS_VAZIOS, ordenarPor: "valor", direcao: "asc" }).map((l) => l.valor), [100, 500, 900]);
});

test("datas vazias ficam no fim em qualquer direção", () => {
  const base = [
    linha({ id: "sem", ultimoContatoCliente: "" }),
    linha({ id: "antigo", ultimoContatoCliente: "2026-09-01T10:00:00Z" }),
    linha({ id: "novo", ultimoContatoCliente: "2026-10-30T10:00:00Z" })
  ];
  assert.deepEqual(ordenarLinhas(base, "contatoCliente", "desc").map((l) => l.id), ["novo", "antigo", "sem"]);
  assert.deepEqual(ordenarLinhas(base, "contatoCliente", "asc").map((l) => l.id), ["antigo", "novo", "sem"]);
});

test("contagem de filtros ativos ignora ordenação", () => {
  assert.equal(contarFiltrosAtivos({}), 0);
  assert.equal(contarFiltrosAtivos({ ordenarPor: "valor", direcao: "asc" }), 0);
  assert.equal(contarFiltrosAtivos({ busca: "x", valorMin: "10" }), 2);
  assert.equal(contarFiltrosAtivos({ etapa: "novo", passo: "sem" }), 2);
});