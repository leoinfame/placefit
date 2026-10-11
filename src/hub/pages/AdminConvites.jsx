import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Copy, MessageCircle, XCircle, PackageSearch, Truck, Check, UserPlus } from "lucide-react";
import { hub, dataHora, linkWhats } from "../lib/hubApi";
import { Cartao, Vazio, Abas, Erro } from "../components/Cartao";
import { Campo } from "../components/Campos";

const ROTULO_TIPO = { coletor: "coletor", fretista: "fretista" };
const ESTADO = {
  aberto: ["Aguardando", "bg-amber-100 text-amber-800"],
  usado: ["Aceito", "bg-emerald-100 text-emerald-800"],
  cancelado: ["Cancelado", "bg-slate-200 text-slate-600"],
  expirado: ["Vencido", "bg-red-100 text-red-700"],
};

const urlDo = (c) => `${window.location.origin}${c.link}`;
const mensagem = (c) =>
  `Olá${c.nome ? `, ${c.nome.split(" ")[0]}` : ""}! Você foi convidado(a) para ser ${ROTULO_TIPO[c.tipo]} no Hub PlaceFit. ` +
  `Pelo link você entra com sua conta PlaceFit (ou cria uma), preenche seus dados e a gente libera seu acesso: ${urlDo(c)} ` +
  `(o link vale por 14 dias).`;

export default function AdminConvites() {
  const [params] = useSearchParams();
  const [tipo, setTipo] = useState(params.get("tipo") === "fretista" ? "fretista" : "coletor");
  const [form, setForm] = useState({ nome: "", whatsapp: "", observacoes: "" });
  const [convites, setConvites] = useState(null);
  const [novo, setNovo] = useState(null);
  const [filtro, setFiltro] = useState("aberto");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [copiado, setCopiado] = useState("");

  const carregar = useCallback(() => hub("listar_convites").then((r) => setConvites(r.convites)).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);

  const gerar = async () => {
    setOcupado("gerar");
    setErro("");
    try {
      const r = await hub("criar_convite", { tipo, ...form });
      setNovo(r.convite);
      setForm({ nome: "", whatsapp: "", observacoes: "" });
      await carregar();
    } catch (e) { setErro(e.message); }
    setOcupado("");
  };

  const copiar = async (c) => {
    try { await navigator.clipboard.writeText(mensagem(c)); setCopiado(c.id); setTimeout(() => setCopiado(""), 2000); }
    catch { setErro("Não deu para copiar. Segure o link para copiar manualmente."); }
  };
  const whats = (c) => window.open(linkWhats(c.whatsapp, mensagem(c)) || `https://wa.me/?text=${encodeURIComponent(mensagem(c))}`, "_blank");
  const cancelar = async (c) => {
    setOcupado(c.id);
    setErro("");
    try { await hub("cancelar_convite", { convite_id: c.id }); if (novo?.id === c.id) setNovo(null); await carregar(); }
    catch (e) { setErro(e.message); }
    setOcupado("");
  };

  const lista = (convites || []).filter((c) => filtro === "todos" || c.estado === filtro);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Convites</h1>
      <p className="text-sm text-slate-600">
        Gere um link para cada pessoa. Ela entra com a conta PlaceFit, preenche os dados e o perfil aparece em Cadastros como
        pendente para você verificar. Cada link vale para uma pessoa, por 14 dias.
      </p>
      <Erro texto={erro} />

      <Cartao className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[["coletor", "Coletor", PackageSearch], ["fretista", "Fretista", Truck]].map(([id, rotulo, Icone]) => (
            <button key={id} onClick={() => setTipo(id)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 font-semibold ${tipo === id ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`}>
              <Icone className="h-5 w-5" />{rotulo}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo rotulo="Nome (opcional)"><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Campo>
          <Campo rotulo="WhatsApp (opcional)"><Input inputMode="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="37 99999-0000" /></Campo>
        </div>
        <Campo rotulo="Observação interna (opcional)"><Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Indicação do João, faz Itaúna" /></Campo>
        <Button className="h-11 w-full" disabled={ocupado === "gerar"} onClick={gerar}>
          {ocupado === "gerar" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          Gerar convite de {ROTULO_TIPO[tipo]}
        </Button>
      </Cartao>

      {novo && (
        <Cartao className="space-y-3 border-2 border-emerald-300">
          <p className="font-semibold text-emerald-800">Convite de {ROTULO_TIPO[novo.tipo]}{novo.nome ? ` para ${novo.nome}` : ""} pronto. Envie agora:</p>
          <p className="break-all rounded-lg bg-slate-50 p-2 font-mono text-xs text-slate-700">{urlDo(novo)}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => whats(novo)}><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</Button>
            <Button variant="outline" onClick={() => copiar(novo)}>{copiado === novo.id ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}Copiar mensagem</Button>
          </div>
        </Cartao>
      )}

      <Abas abas={[["aberto", "Aguardando"], ["usado", "Aceitos"], ["todos", "Todos"]]} ativa={filtro} onTrocar={setFiltro} />
      {!convites ? <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : lista.length === 0 ? <Vazio>{filtro === "aberto" ? "Nenhum convite aguardando resposta." : "Nada por aqui ainda."}</Vazio>
        : lista.map((c) => {
          const [rotulo, cor] = ESTADO[c.estado] || ESTADO.aberto;
          return (
            <Cartao key={c.id} className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.nome || "Sem nome"} <span className="text-xs font-normal text-slate-500">· {ROTULO_TIPO[c.tipo]}</span></p>
                  <p className="text-xs text-slate-500">
                    Criado {dataHora(c.created_date)}{c.criado_por_nome ? ` por ${c.criado_por_nome}` : ""}
                    {c.estado === "aberto" && c.expira_em ? ` · vence ${dataHora(c.expira_em)}` : ""}
                    {c.estado === "usado" && c.usado_em ? ` · aceito ${dataHora(c.usado_em)}` : ""}
                  </p>
                  {c.observacoes && <p className="text-xs text-slate-500">{c.observacoes}</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cor}`}>{rotulo}</span>
              </div>
              {c.estado === "aberto" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => whats(c)}><MessageCircle className="mr-1 h-4 w-4" />WhatsApp</Button>
                  <Button size="sm" variant="outline" onClick={() => copiar(c)}>{copiado === c.id ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}Copiar</Button>
                  <Button size="sm" variant="ghost" className="text-red-600" disabled={ocupado === c.id} onClick={() => cancelar(c)}><XCircle className="mr-1 h-4 w-4" />Cancelar</Button>
                </div>
              )}
              {c.estado === "usado" && (
                <Link to="/hub/admin/cadastros" className="inline-block text-xs font-semibold text-emerald-700">Verificar perfil em Cadastros →</Link>
              )}
            </Cartao>
          );
        })}
    </div>
  );
}
