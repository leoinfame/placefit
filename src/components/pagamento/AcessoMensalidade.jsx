import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

let consulta = null; // uma consulta por sessao de navegacao

// Se a consulta falhar, o acesso segue liberado.
export default function AcessoMensalidade({ children }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let vivo = true;
    consulta = consulta || base44.functions.invoke("minhaMensalidade", {}).then((r) => r?.data).catch(() => null);
    consulta.then((d) => vivo && setInfo(d));
    return () => { vivo = false; };
  }, []);

  if (!info?.bloqueado) return children;
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl border p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Acesso suspenso</h1>
        <p className="text-gray-600">
          {info.cancelada ? "Sua inscrição foi cancelada." : "Sua mensalidade está em aberto. Depois do pagamento, o acesso volta sozinho. Se já pagou, atualize a página."}
        </p>
        {info.link && <a className="inline-block w-full rounded-lg bg-green-700 text-white py-3 font-semibold" href={info.link}>Pagar mensalidade</a>}
        <a className="inline-block text-green-700 underline" href="https://wa.me/5537999147206" target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>
      </div>
    </div>
  );
}
