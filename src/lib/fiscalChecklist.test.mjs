// Testes do checklist fiscal — só dados simulados, nenhum acesso a servidor.
// Rodar: npx esbuild src/lib/fiscalChecklist.test.mjs --bundle --platform=node \
//   --outfile=/tmp/fiscalChecklist.test.mjs && node /tmp/fiscalChecklist.test.mjs
import {
  validarCnpj, normalizarCnpj, formatarCnpj, validarCep, validarCodigoIbge, validarSerie,
  avaliarProntidao, EMISSAO_BLOQUEADA, ITENS_TRIBUTACAO,
} from "./fiscalChecklist.ts";

let falhas = 0;
let total = 0;
function ok(cond, nome) {
  total++;
  if (!cond) { falhas++; console.log("FALHOU:", nome); }
}

// CNPJ numérico
ok(validarCnpj("11.222.333/0001-81").ok, "CNPJ numérico válido com máscara");
ok(validarCnpj("11222333000181").ok, "CNPJ numérico válido sem máscara");
ok(validarCnpj("41.920.834/0001-00").ok, "CNPJ do piloto MuscularFit (DV confere)");
ok(!validarCnpj("11.222.333/0001-82").ok, "DV numérico errado");
ok(!validarCnpj("00000000000000").ok, "todos iguais");
ok(!validarCnpj("").ok, "vazio");
ok(!validarCnpj("1122233300018").ok, "13 caracteres");

// CNPJ alfanumérico (exemplo oficial da Receita: 12.ABC.345/01DE-35)
ok(validarCnpj("12.ABC.345/01DE-35").ok, "CNPJ alfanumérico oficial válido");
ok(validarCnpj("12abc34501de35").ok, "alfanumérico em minúsculas é normalizado");
ok(!validarCnpj("12.ABC.345/01DE-36").ok, "DV alfanumérico errado");
ok(!validarCnpj("12.ABC.345/01DE-3A").ok, "DV não pode ser letra");
ok(!validarCnpj("12.ABC.345/01D@-35").ok, "caractere especial");
ok(normalizarCnpj(" 12.abc.345/01de-35 ") === "12ABC34501DE35", "normalização");
ok(formatarCnpj("12ABC34501DE35") === "12.ABC.345/01DE-35", "formatação");

// Campos simples
ok(validarCep("35520-000") && !validarCep("3552000"), "CEP");
ok(validarCodigoIbge("3117306", "MG").ok, "IBGE de MG");
ok(!validarCodigoIbge("3550308", "MG").ok, "IBGE de SP com UF MG");
ok(!validarCodigoIbge("31173", "MG").ok, "IBGE curto");
ok(validarSerie("1").ok && validarSerie("0").ok, "série 0 e 1");
ok(!validarSerie("890").ok && !validarSerie("1000").ok && !validarSerie("A").ok, "séries inválidas");
ok(!validarSerie("").ok, "série vazia não vira 1 por padrão");
ok(validarSerie("889").ok && !validarSerie("889").motivo, "889 é o limite para emitente CNPJ");
ok(/0 a 889/.test(validarSerie("").motivo), "mensagem de formato cita 0 a 889, não 0 a 999");
ok(/0 a 889/.test(validarSerie("900").motivo), "mensagem de faixa reservada indica 0 a 889");
ok(!/0 a 999/.test(validarSerie("abc").motivo), "nenhuma mensagem promete 0 a 999");

// Prontidão: vazio
const vazio = avaliarProntidao({});
ok(!vazio.cadastroCompleto && !vazio.prontoTesteLocal, "vazio não está pronto");
ok(vazio.emissaoPermitida === false && EMISSAO_BLOQUEADA === true, "emissão bloqueada");
ok(vazio.pendencias.every((p) => p.motivo && p.acao), "toda pendência tem motivo e ação");

// Cadastro completo, sem confirmação do contador
const cadastro = {
  cnpj: "41.920.834/0001-00", razao_social: "Emitente Teste", inscricao_estadual: "0000000000000",
  uf: "MG", municipio: "Cláudio", codigo_ibge: "3117306", logradouro: "Rua Teste", numero: "1",
  bairro: "Centro", cep: "35530000", crt: "4",
};
const r1 = avaliarProntidao(cadastro);
ok(r1.cadastroCompleto, "cadastro completo");
ok(!r1.prontoTesteLocal, "CRT sem confirmação do contador não libera teste");
ok(r1.pendencias.some((p) => p.codigo === "crt_contador"), "pendência de CRT do contador");

// Tudo declarado e confirmado: ainda assim, provedor/produção/emissão bloqueados
const trib = Object.fromEntries(ITENS_TRIBUTACAO.map((i) => [i.chave, true]));
const tudo = {
  ...cadastro, crt_confirmado_contador: true, serie: "1", serie_confirmada_contador: true,
  numeracao_confirmada_contador: true, tributacao: trib,
  credenciamento: "declarado_credenciado", credenciamento_data: "2026-10-08", credenciamento_evidencia: "protocolo X",
};
const r2 = avaliarProntidao(tudo);
ok(r2.prontoTesteLocal, "pronto para teste local (simulação)");
ok(!r2.habilitadoProvedorHomologacao && !r2.prontoProducao && !r2.emissaoPermitida, "provedor, produção e emissão continuam bloqueados");
ok(r2.pendencias.some((p) => p.codigo === "a1"), "A1 pendente sem validação do servidor");

// Valores adulterados vindos do navegador não liberam nada
const adulterado = avaliarProntidao({ ...tudo, a1_estado: "validado", pronta_homologacao: true, emissaoPermitida: true });
ok(!adulterado.habilitadoProvedorHomologacao && !adulterado.emissaoPermitida, "flags adulteradas não habilitam provedor nem emissão");

// CNPJ malicioso
const malicioso = avaliarProntidao({ ...tudo, cnpj: "41.920.834/0001-01" });
ok(!malicioso.cadastroCompleto && malicioso.pendencias.some((p) => p.codigo === "cnpj"), "CNPJ com DV adulterado");

// A1 expirado/incompatível aparecem como pendência
ok(avaliarProntidao({ ...tudo, a1_estado: "expirado" }).pendencias.some((p) => p.codigo === "a1" && /Expirado/.test(p.motivo)), "A1 expirado");
ok(avaliarProntidao({ ...tudo, a1_estado: "incompativel" }).pendencias.some((p) => p.codigo === "a1" && /Incompatível/.test(p.motivo)), "A1 incompatível");

// Credenciamento declarado sem evidência
ok(avaliarProntidao({ ...tudo, credenciamento_evidencia: "" }).pendencias.some((p) => p.codigo === "credenciamento_evidencia"), "credenciamento sem evidência");

console.log(`${total - falhas}/${total} testes passaram`);
if (falhas) process.exit(1);
