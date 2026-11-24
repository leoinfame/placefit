import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

let consulta = null; // uma consulta por carregamento da pagina

const perguntar = () => base44.functions.invoke("minhaMensalidade", {}).then((r) => r?.data);

const consultar = async () => {
  let d = await perguntar();
  // Pre-cadastro feito pelo admin e aplicado no primeiro acesso.
  if (d?.bloqueado && d.motivo === "pendente") {
    const r = await base44.functions.invoke("aplicarPreCadastro", {}).catch(() => null);
    if (r?.data?.applied) d = await perguntar();
  }
  return d;
};

const TEXTOS = {
  pendente: ["Acesso não habilitado", "Sua conta ainda não foi habilitada pela PlaceFit. Fale com a gente ou faça a sua inscrição. Se já pagou, entre com o mesmo e-mail da inscrição."],
  atraso: ["Acesso suspenso", "Sua mensalidade está em aberto. Depois do pagamento, o acesso volta sozinho. Se já pagou, atualize a página."],
  cancelada: ["Acesso suspenso", "Sua inscrição foi cancelada."],
};

// Se a consulta falhar ou demorar, o acesso segue liberado. O Hub tem controle proprio.
export default function AcessoMensalidade({ children }) {
  const noHub = window.location.pathname === "/hub" || window.location.pathname.startsWith("/hub/");
  const [info, setInfo] = useState(noHub ? {} : null);

  useEffect(() => {
    if (noHub) return undefined;
    let vivo = true;
    consulta = consulta || consultar().catch(() => ({}));
    Promise.race([consulta, new Promise((ok) => setTimeout(() => ok({}), 10000))]).then((d) => vivo && setInfo(d || {}));
    return () => { vivo = false; };
  }, [noHub]);

  if (!info) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!info.bloqueado) return children;

  const [titulo, texto] = TEXTOS[info.motivo] || TEXTOS.pendente;
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-xl border p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>
        <p className="text-gray-600">{texto}</p>
        {info.link && <a className="block w-full rounded-lg bg-green-700 text-white py-3 font-semibold" href={info.link}>Pagar mensalidade</a>}
        {info.motivo === "pendente" && <a className="block w-full rounded-lg bg-green-700 text-white py-3 font-semibold" href="https://www.placefit.com.br/curso.html#lista">Fazer inscrição</a>}
        <a className="inline-block text-green-700 underline" href="https://wa.me/5537999147206" target="_blank" rel="noopener noreferrer">Falar no WhatsApp</a>
        <button className="block mx-auto text-sm text-gray-500 underline" onClick={() => base44.auth.logout("/")}>Sair desta conta</button>
      </div>
    </div>
  );
}
