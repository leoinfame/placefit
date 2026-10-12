import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw, AlertTriangle, AlertCircle, ExternalLink, Settings, MessageCircle, ShoppingBag, Store } from "lucide-react";
import WhatsappCatalogo from "@/components/loja/WhatsappCatalogo";
import MercadoLivreExport from "@/components/loja/MercadoLivreExport";

// Canais da área. Pra plugar um canal novo: um item aqui + o bloco dele na função conexoesExternas.
const CANAIS_UI = {
  whatsapp: { icone: MessageCircle, Configurar: WhatsappCatalogo },
  google: { icone: ShoppingBag, Configurar: WhatsappCatalogo }, // o feed do Google usa a mesma configuração (token + domínio)
  mercadolivre: { icone: Store, Configurar: MercadoLivreExport },
};

const STATUS = {
  ativo: { label: "Ativo", cls: "bg-green-100 text-green-800" },
  conectado: { label: "Conectado", cls: "bg-blue-100 text-blue-800" },
  pausado: { label: "Pausado", cls: "bg-gray-200 text-gray-700" },
  erro: { label: "Erro", cls: "bg-red-100 text-red-800" },
  desconectado: { label: "Desconectado", cls: "bg-gray-100 text-gray-600" },
  em_breve: { label: "Em breve", cls: "bg-amber-100 text-amber-800" },
};

const fmtBR = (iso) => {
  if (!iso) return "nunca";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
};

function Alertas({ alertas }) {
  if (!alertas?.length) return null;
  return (
    <div className="space-y-1.5">
      {alertas.map((a, i) => (
        <div key={i} className={`flex gap-2 text-sm rounded-md px-2 py-1.5 ${a.nivel === "erro" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>
          {a.nivel === "erro" ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{a.msg}{a.em ? <span className="opacity-70"> · {fmtBR(a.em)}</span> : null}</span>
        </div>
      ))}
    </div>
  );
}

function DetalheWhatsapp({ d, abrirLista }) {
  return (
    <div className="flex flex-wrap gap-2">
      {d?.link_catalogo && (
        <Button variant="outline" size="sm" asChild>
          <a href={d.link_catalogo} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-1" /> Ver catálogo no WhatsApp</a>
        </Button>
      )}
      {d?.sem_foto > 0 && (
        <Button variant="outline" size="sm" onClick={() => abrirLista("Fora do catálogo por falta de foto", (d.sem_foto_lista || []).map((p) => `${p.cod ? p.cod + " — " : ""}${p.nome}`))}>
          Ver os {d.sem_foto} sem foto
        </Button>
      )}
    </div>
  );
}

function DetalheGoogle({ d, abrirLista }) {
  const m = d?.merchant;
  if (!m?.ok) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-700">
        <strong className="text-green-700">{m.aprovados}</strong> aprovados · <strong className="text-red-700">{m.reprovados}</strong> reprovados · <strong>{m.pendentes}</strong> em análise
        <span className="text-gray-400"> (de {m.encontrados} achados no Merchant Center)</span>
      </p>
      {m.motivos?.length > 0 && (
        <ul className="text-sm text-gray-600 list-disc pl-5">
          {m.motivos.map((x) => <li key={x.motivo}>{x.motivo} ({x.qtd})</li>)}
        </ul>
      )}
      {m.reprovados > 0 && (
        <Button variant="outline" size="sm" onClick={() => abrirLista("Reprovados no Google", (m.reprovados_lista || []).map((p) => `${p.titulo || p.offer_id} — ${p.motivos.join("; ")}`))}>
          Ver produtos reprovados
        </Button>
      )}
    </div>
  );
}

function DetalheMl({ d }) {
  if (!d?.conectado) return <p className="text-sm text-gray-500">Integração na próxima etapa.</p>;
  return <p className="text-sm text-gray-600">Conta conectada: <strong>@{d.apelido}</strong></p>;
}

export default function ConexoesExternas({ config, onSaved }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [configurando, setConfigurando] = useState(null);
  const [lista, setLista] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await base44.functions.invoke("conexoesExternas", {});
      const d = res?.data || res;
      if (d?.error) throw new Error(d.error);
      setDados(d);
    } catch (e) {
      setErro(e?.message || "Não consegui carregar as conexões.");
    }
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Volta do login do Mercado Livre: abre a configuração dele para mostrar o resultado
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("ml_connected") || p.get("ml_error")) setConfigurando({ id: "mercadolivre", nome: "Mercado Livre" });
  }, []);

  if (!config?.slug) return <p className="text-gray-500 text-sm">Salve sua loja (defina o slug) antes de conectar canais.</p>;

  const abrirLista = (titulo, itens) => setLista({ titulo, itens });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Onde seus produtos ativos estão sendo publicados. Horários em Brasília.</p>
        <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
          {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-1">Atualizar</span>
        </Button>
      </div>

      {erro && <div className="text-sm text-red-700 bg-red-50 rounded-md p-3">{erro}</div>}
      {carregando && !dados && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(dados?.canais || []).map((c) => {
          const ui = CANAIS_UI[c.id] || {};
          const Icone = ui.icone || Store;
          const st = STATUS[c.status] || STATUS.desconectado;
          return (
            <Card key={c.id} className={c.status === "erro" ? "border-red-300" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2"><Icone className="w-5 h-5" /> {c.nome}</CardTitle>
                  <Badge className={st.cls}>{st.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {c.contagem !== null && c.contagem !== undefined && (
                  <p className="text-2xl font-bold">{c.contagem} <span className="text-sm font-normal text-gray-500">{c.contagem_label}</span></p>
                )}
                {!c.em_breve || c.ultima_sync ? (
                  <p className="text-sm text-gray-600">{c.ultima_sync_label}: <strong>{fmtBR(c.ultima_sync)}</strong></p>
                ) : null}
                <Alertas alertas={c.alertas} />
                {c.id === "whatsapp" && <DetalheWhatsapp d={c.detalhes} abrirLista={abrirLista} />}
                {c.id === "google" && <DetalheGoogle d={c.detalhes} abrirLista={abrirLista} />}
                {c.id === "mercadolivre" && <DetalheMl d={c.detalhes} />}
                {ui.Configurar && (
                  <Button size="sm" variant={c.em_breve ? "outline" : "default"} onClick={() => setConfigurando(c)}>
                    <Settings className="w-4 h-4 mr-1" /> Configurar
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {configurando && (
        <Dialog open onOpenChange={(v) => { if (!v) { setConfigurando(null); carregar(); } }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Configurar — {configurando.nome}</DialogTitle></DialogHeader>
            {React.createElement(CANAIS_UI[configurando.id].Configurar, { config, onSaved })}
          </DialogContent>
        </Dialog>
      )}

      {lista && (
        <Dialog open onOpenChange={(v) => { if (!v) setLista(null); }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{lista.titulo} ({lista.itens.length})</DialogTitle></DialogHeader>
            <ul className="text-sm space-y-1">
              {lista.itens.map((t, i) => <li key={i} className="border-b py-1">{t}</li>)}
            </ul>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
