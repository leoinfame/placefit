import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Package, Truck, CheckCircle2, RefreshCw, Phone } from "lucide-react";
import { hub, brl, linkMapa } from "../lib/hubApi";
import { Cartao, Vazio, Abas, Erro } from "../components/Cartao";
import Status from "../components/Status";
import RegistrarCustodia from "../components/RegistrarCustodia";

export default function Fretista() {
  const [aba, setAba] = useState("fila");
  const [fila, setFila] = useState(null);
  const [meus, setMeus] = useState(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const [custodia, setCustodia] = useState(null);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const [f, m] = await Promise.all([hub("fila_fretista").catch((e) => ({ erro: e.message })), hub("meus_fretes")]);
      if (f.erro) setErro(f.erro); else setFila(f.fretes);
      setMeus(m);
    } catch (e) { setErro(e.message); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const agir = async (f, acao_frete) => {
    setOcupado(f.id + acao_frete);
    setErro("");
    try {
      await hub("acao_frete", { freight_leg_id: f.id, acao_frete });
      if (acao_frete === "aceitar") setAba("meus");
      await carregar();
    } catch (e) { setErro(e.message); await carregar(); }
    setOcupado(null);
  };

  const destino = (f) => [f.destino_endereco, f.destino_cidade && `${f.destino_cidade}/${f.destino_uf || ""}`].filter(Boolean).join(" — ");

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Fretes</h1>
        <Button variant="ghost" size="icon" onClick={carregar}><RefreshCw className="h-5 w-5" /></Button>
      </div>
      <Abas abas={[["fila", `Fila${fila ? ` (${fila.length})` : ""}`], ["meus", `Meus${meus ? ` (${meus.ativos.length})` : ""}`]]} ativa={aba} onTrocar={setAba} />
      <Erro texto={erro} />

      {aba === "fila" && (
        !fila ? <Spinner /> : fila.length === 0 ? <Vazio>Nenhum pedido consolidado aguardando frete.</Vazio> : (
          <div className="space-y-3">
            {fila.map((f) => (
              <Cartao key={f.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">{f.numero}</p>
                    <p className="text-lg font-bold">{f.destino_cidade}/{f.destino_uf}</p>
                    <p className="text-sm text-slate-600">{f.cliente_nome}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Você recebe</p>
                    <p className="text-2xl font-extrabold text-emerald-600">{brl(f.valor_frete)}</p>
                  </div>
                </div>
                <p className="mt-2 flex items-center gap-1 text-sm text-slate-600">
                  <Package className="h-4 w-4" />{[f.volumes && `${f.volumes} vol.`, f.peso_kg && `${Number(f.peso_kg).toLocaleString("pt-BR")} kg`].filter(Boolean).join(" · ") || "Volumes a confirmar na base"}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button variant="outline" className="h-12" disabled={!!ocupado} onClick={() => agir(f, "recusar")}>Recusar</Button>
                  <Button className="col-span-2 h-12 bg-emerald-600 text-base hover:bg-emerald-700" disabled={!!ocupado} onClick={() => agir(f, "aceitar")}>
                    {ocupado === f.id + "aceitar" ? <Loader2 className="h-5 w-5 animate-spin" /> : "Aceitar frete"}
                  </Button>
                </div>
              </Cartao>
            ))}
          </div>
        )
      )}

      {aba === "meus" && (
        !meus ? <Spinner /> : (
          <div className="space-y-3">
            {meus.ativos.length === 0 && <Vazio>Você não tem fretes em andamento.</Vazio>}
            {meus.ativos.map((f) => (
              <Cartao key={f.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400">{f.numero} · {brl(f.valor_frete)}</p>
                    <p className="text-lg font-bold">{f.cliente_nome || "Cliente"}</p>
                  </div>
                  <Status status={f.status} />
                </div>
                {destino(f) && (
                  <a href={linkMapa(destino(f))} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-sm text-blue-700">
                    <MapPin className="h-4 w-4 shrink-0" />{destino(f)}
                  </a>
                )}
                {f.destino_telefone && (
                  <a href={`tel:${f.destino_telefone}`} className="mt-1 flex items-center gap-1 text-sm text-blue-700"><Phone className="h-4 w-4" />{f.destino_telefone}</a>
                )}
                <div className="mt-3 grid gap-2">
                  {f.status === "aceito" && (
                    <>
                      <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Na base, escaneie o QR mestre colado no pedido consolidado.</p>
                      <Button className="h-14 bg-emerald-600 text-base hover:bg-emerald-700" onClick={() => setCustodia({ tipo: "retirado_pelo_fretista", f })}>
                        <Truck className="mr-2 h-5 w-5" />Retirei na base
                      </Button>
                      <Button variant="ghost" disabled={!!ocupado} onClick={() => confirm("Devolver este frete para a fila?") && agir(f, "desistir")}>Desistir</Button>
                    </>
                  )}
                  {f.status === "retirado" && (
                    <Button className="h-14 text-base" onClick={() => setCustodia({ tipo: "entregue_ao_cliente", f })}>
                      <CheckCircle2 className="mr-2 h-5 w-5" />Entreguei ao cliente
                    </Button>
                  )}
                </div>
              </Cartao>
            ))}
            {meus.historico.length > 0 && (
              <div className="pt-3">
                <p className="mb-2 text-sm font-semibold text-slate-500">Histórico</p>
                {meus.historico.map((f) => (
                  <div key={f.id} className="flex items-center justify-between border-b border-slate-200 py-2 text-sm">
                    <span>{f.numero} · {f.destino_cidade}/{f.destino_uf}</span><Status status={f.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {custodia && (
        <RegistrarCustodia
          aberto
          tipo={custodia.tipo}
          papel="fretista"
          freightLegId={custodia.f.id}
          referencia={custodia.f.numero}
          onFechar={() => setCustodia(null)}
          onFeito={carregar}
        />
      )}
    </div>
  );
}

function Spinner() {
  return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
}
