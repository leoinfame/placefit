import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { hub, dataHora } from "../lib/hubApi";
import { Cartao, Vazio, Erro } from "../components/Cartao";
import Status from "../components/Status";

const ETAPAS = [
  ["aguardando_consolidacao", "Coletando nos fabricantes"],
  ["consolidado", "Consolidado na base"],
  ["disponivel", "Aguardando fretista"],
  ["aceito", "Fretista a caminho da base"],
  ["retirado", "Saiu para entrega"],
  ["entregue", "Entregue"],
];

// Revenda acompanha os pedidos dela no Hub (somente leitura).
export default function Acompanhar() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => { hub("acompanhar").then(setDados).catch((e) => setErro(e.message)); }, []);

  if (erro) return <Erro texto={erro} />;
  if (!dados) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="text-xl font-bold">Meus pedidos no Hub</h1>
      {dados.pedidos.length === 0 && <Vazio>Nenhum pedido seu passou pelo Hub ainda.</Vazio>}
      {dados.pedidos.map((f) => {
        const atual = ETAPAS.findIndex(([s]) => s === f.status);
        return (
          <Cartao key={f.id}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">{f.numero}</p>
                <p className="font-bold">{f.cliente_nome} — {f.destino_cidade}/{f.destino_uf}</p>
              </div>
              <Status status={f.status} />
            </div>
            <ol className="mt-3 flex gap-1">
              {ETAPAS.map(([s, rotulo], i) => (
                <li key={s} title={rotulo} className={`h-2 flex-1 rounded-full ${f.status === "cancelado" ? "bg-slate-200" : i <= atual ? "bg-emerald-500" : "bg-slate-200"}`} />
              ))}
            </ol>
            <p className="mt-1 text-xs text-slate-500">{ETAPAS[atual]?.[1]}{f.entregue_em ? ` em ${dataHora(f.entregue_em)} — recebido por ${f.recebedor_nome}` : ""}</p>
            <ul className="mt-3 space-y-1">
              {f.subpedidos.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span>{s.fabricante_nome}</span><Status status={s.status} />
                </li>
              ))}
            </ul>
          </Cartao>
        );
      })}
    </div>
  );
}
