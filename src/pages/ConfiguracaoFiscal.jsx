import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Lock, ShieldAlert } from "lucide-react";
import {
  avaliarProntidao, validarCnpj, formatarCnpj, CRT_OPCOES, A1_ESTADOS,
  CREDENCIAMENTO_ESTADOS, ITENS_TRIBUTACAO, UFS,
} from "@/lib/fiscalChecklist";

// Unidade 1 — formulário fiscal LOCAL.
// Esta página não lê nem grava no banco, não chama funções, provedor ou APIs
// externas e não usa armazenamento do navegador. O que se digita fica só na
// memória da página e some ao sair. Prontidão = simulação; emissão bloqueada.

const VAZIO = {
  cnpj: "", razao_social: "", nome_fantasia: "", inscricao_estadual: "",
  uf: "", municipio: "", codigo_ibge: "", logradouro: "", numero: "", bairro: "", cep: "",
  crt: "", crt_confirmado_contador: false,
  credenciamento: "nao_informado", credenciamento_data: "", credenciamento_evidencia: "",
  serie: "", serie_confirmada_contador: false, numeracao_confirmada_contador: false,
  tributacao: {},
};

const NIVEIS = [
  { chave: "cadastro", titulo: "Cadastro completo" },
  { chave: "teste_local", titulo: "Pronto para teste local (simulação)" },
  { chave: "provedor_homologacao", titulo: "Habilitado no provedor (homologação)" },
  { chave: "producao", titulo: "Pronto para produção" },
];

function Campo({ label, children, dica }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {dica && <p className="text-xs text-gray-500">{dica}</p>}
    </div>
  );
}

function Confirmacao({ checked, onChange, children }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-4 h-4 rounded border-gray-300" />
      <span className="text-sm">{children}</span>
    </label>
  );
}

export default function ConfiguracaoFiscal() {
  const [dados, setDados] = useState(VAZIO);
  const set = (campo) => (valor) => setDados((d) => ({ ...d, [campo]: valor }));
  const setTrib = (chave, valor) => setDados((d) => ({ ...d, tributacao: { ...d.tributacao, [chave]: valor } }));

  // A1 nunca vem do navegador: nesta fase é sempre "pendente".
  const resultado = useMemo(() => avaliarProntidao({ ...dados, a1_estado: "pendente" }), [dados]);
  const cnpj = validarCnpj(dados.cnpj);
  const status = {
    cadastro: resultado.cadastroCompleto,
    teste_local: resultado.prontoTesteLocal,
    provedor_homologacao: resultado.habilitadoProvedorHomologacao,
    producao: resultado.prontoProducao,
  };

  const bloquearEnvio = (e) => e.preventDefault();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <form onSubmit={bloquearEnvio} className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl shadow-lg">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Configurações Fiscais — NF-e 55</h1>
            <p className="text-gray-600">Preparação do emitente. Nada é salvo nem enviado nesta fase.</p>
          </div>
        </div>

        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <p>
            <strong>Simulação local.</strong> Os dados digitados ficam só nesta tela e somem ao sair. Nenhuma NF-e é
            emitida, nenhum dado vai para provedor ou SEFAZ, e estados de certificado e credenciamento são apenas
            declarações exibidas, não prova.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle>Emitente</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Campo label="CNPJ" dica={dados.cnpj ? (cnpj.ok ? `Válido: ${formatarCnpj(dados.cnpj)}` : cnpj.motivo) : "Aceita o formato numérico e o alfanumérico."}>
              <Input value={dados.cnpj} onChange={(e) => set("cnpj")(e.target.value)} placeholder="00.000.000/0000-00" />
            </Campo>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="Razão social"><Input value={dados.razao_social} onChange={(e) => set("razao_social")(e.target.value)} /></Campo>
              <Campo label="Nome fantasia"><Input value={dados.nome_fantasia} onChange={(e) => set("nome_fantasia")(e.target.value)} /></Campo>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="Inscrição Estadual" dica="Formato por UF a confirmar com o contador.">
                <Input value={dados.inscricao_estadual} onChange={(e) => set("inscricao_estadual")(e.target.value)} />
              </Campo>
              <Campo label="CRT (regime)" dica="Escolha conforme o contador. O sistema não deduz o CRT.">
                <Select value={dados.crt} onValueChange={set("crt")}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {CRT_OPCOES.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Campo>
            </div>
            <Confirmacao checked={dados.crt_confirmado_contador} onChange={set("crt_confirmado_contador")}>
              O contador confirmou o CRT acima (declaração).
            </Confirmacao>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Endereço do emitente</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Campo label="CEP"><Input value={dados.cep} onChange={(e) => set("cep")(e.target.value)} placeholder="00000-000" /></Campo>
              <div className="md:col-span-2">
                <Campo label="Logradouro"><Input value={dados.logradouro} onChange={(e) => set("logradouro")(e.target.value)} /></Campo>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Campo label="Número"><Input value={dados.numero} onChange={(e) => set("numero")(e.target.value)} /></Campo>
              <div className="md:col-span-2">
                <Campo label="Bairro"><Input value={dados.bairro} onChange={(e) => set("bairro")(e.target.value)} /></Campo>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Campo label="UF">
                <Select value={dados.uf} onValueChange={set("uf")}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(UFS).sort().map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Município"><Input value={dados.municipio} onChange={(e) => set("municipio")(e.target.value)} /></Campo>
              <Campo label="Código IBGE do município"><Input value={dados.codigo_ibge} onChange={(e) => set("codigo_ibge")(e.target.value)} placeholder="7 dígitos" /></Campo>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>NF-e modelo 55</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="Ambiente" dica="Produção travada nesta fase.">
                <Input value="Homologação (fixo)" disabled />
              </Campo>
              <Campo label="Série" dica="Sem valor padrão: definir com o contador.">
                <Input value={dados.serie} onChange={(e) => set("serie")(e.target.value)} placeholder="Ex.: definida pelo contador" />
              </Campo>
            </div>
            <Confirmacao checked={dados.serie_confirmada_contador} onChange={set("serie_confirmada_contador")}>
              O contador confirmou a série (declaração).
            </Confirmacao>
            <Campo label="Numeração" dica={`Escopo: CNPJ + modelo 55 + homologação. Não editável aqui; será controlada pelo servidor/provedor.`}>
              <Input value="Não reservada — controle definido em etapa própria" disabled />
            </Campo>
            <Confirmacao checked={dados.numeracao_confirmada_contador} onChange={set("numeracao_confirmada_contador")}>
              O contador e o provedor definiram quem controla a numeração (declaração).
            </Confirmacao>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Credenciamento e certificado</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Campo label="Credenciamento NF-e 55 na UF (declarado pela revenda)" dica="Declaração exibida; não é verificação na SEFAZ.">
              <Select value={dados.credenciamento} onValueChange={set("credenciamento")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CREDENCIAMENTO_ESTADOS).map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Campo label="Data da confirmação"><Input type="date" value={dados.credenciamento_data} onChange={(e) => set("credenciamento_data")(e.target.value)} /></Campo>
              <Campo label="Evidência (ex.: protocolo, quem confirmou)"><Input value={dados.credenciamento_evidencia} onChange={(e) => set("credenciamento_evidencia")(e.target.value)} /></Campo>
            </div>
            <div className="rounded-lg border bg-slate-50 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <Lock className="w-4 h-4" /> Certificado digital A1
              </div>
              <p className="mt-1 text-slate-700">Estado: {A1_ESTADOS.pendente}</p>
              <p className="mt-1 text-xs text-slate-500">
                Sem upload nesta fase. O certificado e a senha nunca são digitados aqui; o envio será por canal seguro, em etapa própria.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tributação por operação e item (contador)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-gray-600 mb-2">
              O sistema não aplica CFOP, CST, alíquota ou tributação padrão. Marque apenas o que o contador já definiu.
            </p>
            {ITENS_TRIBUTACAO.map((item) => (
              <Confirmacao key={item.chave} checked={Boolean(dados.tributacao[item.chave])} onChange={(v) => setTrib(item.chave, v)}>
                {item.rotulo} — definido pelo contador
              </Confirmacao>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Prontidão (simulação)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {NIVEIS.map((n) => (
                <div key={n.chave} className={`rounded-lg border p-3 text-sm ${status[n.chave] ? "border-green-300 bg-green-50 text-green-900" : "border-slate-200 bg-white text-slate-700"}`}>
                  {status[n.chave] ? "✓ " : "○ "}{n.titulo}
                </div>
              ))}
            </div>
            {NIVEIS.map((n) => {
              const itens = resultado.pendencias.filter((p) => p.nivel === n.chave);
              if (!itens.length) return null;
              return (
                <div key={n.chave}>
                  <p className="font-semibold text-sm text-slate-800 mb-1">{n.titulo} — {itens.length} pendência(s)</p>
                  <ul className="space-y-1">
                    {itens.map((p) => (
                      <li key={p.codigo} className="text-sm rounded border border-yellow-200 bg-yellow-50 p-2">
                        <span className="text-yellow-900">{p.motivo}</span>
                        <span className="block text-xs text-yellow-800">Ação: {p.acao}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex flex-col items-end gap-2">
          <Button type="button" disabled className="w-full md:w-auto">
            <Lock className="w-4 h-4 mr-2" /> Salvar desativado nesta fase
          </Button>
          <p className="text-xs text-gray-500 text-right">Gravação será habilitada só com validação no servidor (unidade 2). Emissão bloqueada.</p>
        </div>
      </form>
    </div>
  );
}
