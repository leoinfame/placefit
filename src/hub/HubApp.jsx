import React, { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, Outlet, NavLink, useLocation } from "react-router-dom";
import { Loader2, Truck, LogIn } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { hub } from "./lib/hubApi";
import { HubContexto } from "./components/HubContexto";
import HubLayout from "./components/HubLayout";
import HubInicio from "./pages/HubInicio";
import Coletor from "./pages/Coletor";
import Fretista from "./pages/Fretista";
import Base from "./pages/Base";
import Acompanhar from "./pages/Acompanhar";
import Etiquetas from "./pages/Etiquetas";
import AdminAoVivo from "./pages/AdminAoVivo";
import AdminPedidos from "./pages/AdminPedidos";
import AdminFinanceiro from "./pages/AdminFinanceiro";
import AdminCadastros from "./pages/AdminCadastros";
import AdminConvites from "./pages/AdminConvites";
import ComoFunciona from "./pages/ComoFunciona";
import ConviteAceitar from "./pages/ConviteAceitar";

// Area do Hub PlaceFit (/hub). Mesmo login da loja, layout proprio e mobile-first.
// Acesso: admin, quem tem TransportProfile ativo, ou revenda com o hub ligado (flag por revenda).
// Sem login ou sem acesso: so a pagina "Como funciona" e o aceite de convite (/hub/convite/:token).
export default function HubApp() {
  const [logado, setLogado] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [erro, setErro] = useState("");

  const recarregar = useCallback(() => hub("contexto").then(setCtx).catch((e) => setErro(e.message)), []);
  useEffect(() => {
    base44.auth.isAuthenticated()
      .then((ok) => { setLogado(ok); if (ok) recarregar(); })
      .catch(() => setLogado(false));
  }, [recarregar]);

  if (erro) return <Aviso titulo="Não foi possível abrir o Hub" texto={erro} />;
  if (logado === null || (logado && !ctx)) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>
  );
  if (!logado || !ctx.tem_acesso) return (
    <Routes>
      <Route element={<LayoutPublico logado={logado} />}>
        <Route index element={<ComoFunciona />} />
        <Route path="convite/:token" element={<ConviteAceitar logado={logado} onAceito={recarregar} />} />
        <Route path="*" element={<ComoFunciona />} />
      </Route>
    </Routes>
  );

  const tem = (tipo) => ctx.perfis.some((p) => p.tipo === tipo);
  const so = (ok, el) => (ok ? el : <Navigate to="/hub" replace />);

  return (
    <HubContexto.Provider value={{ ...ctx, recarregar }}>
      <Routes>
        <Route path="etiquetas" element={so(ctx.admin || tem("base"), <Etiquetas />)} />
        <Route element={<HubLayout />}>
          <Route index element={<HubInicio />} />
          <Route path="coletor" element={so(tem("coletor"), <Coletor />)} />
          <Route path="fretista" element={so(tem("fretista"), <Fretista />)} />
          <Route path="base" element={so(ctx.admin || tem("base"), <Base />)} />
          <Route path="acompanhar" element={so(ctx.admin || ctx.revenda_ativa, <Acompanhar />)} />
          <Route path="admin" element={so(ctx.admin, <AdminAoVivo />)} />
          <Route path="admin/pedidos" element={so(ctx.admin, <AdminPedidos />)} />
          <Route path="admin/financeiro" element={so(ctx.admin, <AdminFinanceiro />)} />
          <Route path="admin/cadastros" element={so(ctx.admin, <AdminCadastros />)} />
          <Route path="admin/convites" element={so(ctx.admin, <AdminConvites />)} />
          <Route path="como-funciona" element={<ComoFunciona />} />
          <Route path="convite/:token" element={<ConviteAceitar logado onAceito={recarregar} />} />
          <Route path="*" element={<Navigate to="/hub" replace />} />
        </Route>
      </Routes>
    </HubContexto.Provider>
  );
}

// Casca para quem ainda nao entrou no Hub: explicacao + convite.
function LayoutPublico({ logado }) {
  const noConvite = useLocation().pathname.includes("/convite/");
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <NavLink to="/hub" className="flex items-center gap-2 font-bold"><Truck className="h-6 w-6 text-emerald-400" />Hub PlaceFit</NavLink>
          <div className="flex-1" />
          {logado ? (
            <a href="/app" className="text-xs text-slate-300 hover:text-white">Loja PlaceFit</a>
          ) : (
            <button onClick={() => base44.auth.redirectToLogin(window.location.href)} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">
              <LogIn className="h-4 w-4" />Entrar
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">
        {logado && !noConvite && (
          <p className="mx-auto mb-4 max-w-3xl rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Sua conta ainda não tem acesso ao Hub. Se você recebeu um convite, abra o link dele; se não, peça o seu à PlaceFit.
          </p>
        )}
        <Outlet />
      </main>
    </div>
  );
}

function Aviso({ titulo, texto }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow">
        <h1 className="text-lg font-bold text-slate-900">{titulo}</h1>
        <p className="mt-2 text-sm text-slate-600">{texto}</p>
        <a href="/app" className="mt-4 inline-block text-sm font-medium text-blue-700">Ir para o PlaceFit</a>
      </div>
    </div>
  );
}
