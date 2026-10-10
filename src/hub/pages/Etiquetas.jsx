import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, Printer } from "lucide-react";
import { hub } from "../lib/hubApi";
import { qrDataUrl } from "../lib/qr";
import { useHub } from "../components/HubContexto";

// Pagina de impressao. Sem parametro: etiquetas do dia (coletas prontas que ainda nao sairam do fabricante).
// ?ids=a,b = coletas escolhidas; ?frete=id = etiqueta mestre do pedido consolidado.
export default function Etiquetas() {
  const ctx = useHub();
  const [params] = useSearchParams();
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const papel = ctx.perfis.some((p) => p.tipo === "base") ? "base" : "admin";
    const ids = (params.get("ids") || "").split(",").filter(Boolean);
    const frete = params.get("frete");
    hub("etiquetas", { papel, ids, frete_ids: frete ? [frete] : [] })
      .then(async (r) => {
        const lista = [
          ...r.fretes.map((f) => ({ ...f, mestre: true })),
          ...r.pickups.map((p) => ({ ...p, mestre: false })),
        ];
        setItens(await Promise.all(lista.filter((x) => x.qr).map(async (x) => ({ ...x, img: await qrDataUrl(x.qr) }))));
      })
      .catch((e) => setErro(e.message));
  }, [params, ctx.perfis]);

  if (erro) return <p className="p-6 text-red-700">{erro}</p>;
  if (!itens) return <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-white">
      <style>{`@media print { .nao-imprimir { display: none !important } @page { margin: 8mm } .etiqueta { break-inside: avoid } }`}</style>
      <div className="nao-imprimir flex items-center justify-between border-b p-4">
        <p className="font-semibold">{itens.length} etiqueta(s)</p>
        <Button onClick={() => window.print()} disabled={!itens.length}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
      </div>
      {itens.length === 0 && <p className="p-10 text-center text-slate-500">Nenhuma coleta pronta para etiquetar hoje.</p>}
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        {itens.map((x) => (
          <div key={x.id} className="etiqueta flex gap-3 rounded-lg border-2 border-black p-3 text-black">
            <img src={x.img} alt={x.qr} className="h-36 w-36 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide">{x.mestre ? "Hub PlaceFit · QR MESTRE" : "Hub PlaceFit · Subpedido"}</p>
              <p className="text-2xl font-black">{x.numero}</p>
              {x.mestre ? (
                <>
                  <p className="text-sm font-semibold">{x.cliente_nome}</p>
                  <p className="text-sm">{x.destino_cidade}/{x.destino_uf}</p>
                  <p className="text-xs">{x.volumes ? `${x.volumes} volume(s)` : ""}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">{x.fabricante_nome}</p>
                  <p className="text-xs">Revenda: {x.revendedor_nome}</p>
                  <p className="line-clamp-3 text-[11px]">{x.itens_resumo}</p>
                </>
              )}
              <p className="mt-1 font-mono text-[11px]">{x.qr.split(":").pop()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
