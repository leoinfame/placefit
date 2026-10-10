import React, { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
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

// Area do Hub PlaceFit (/hub). Mesmo login da loja, layout proprio e mobile-first.
// Acesso: admin, quem tem TransportProfile ativo, ou revenda com o hub ligado (flag por revenda).
export default function HubApp() {
  const [ctx, setCtx] = useState(null);
  const [erro, setErro] = useState("");

  const recarregar = useCallback(() => hub("contexto").then(setCtx).catch((e) => setErro(e.message)), []);
  useEffect(() => { recarregar(); }, [recarregar]);

  if (erro) return <Aviso titulo="Não foi possível abrir o Hub" texto={erro} />;
  if (!ctx) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-slate-500" /></div>
  );
  if (!ctx.tem_acesso) return (
    <Aviso titulo="Hub PlaceFit" texto="Sua conta ainda não tem acesso ao Hub. Fale com a PlaceFit para ativar seu perfil de coletor, fretista ou base." />
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
          <Route path="*" element={<Navigate to="/hub" replace />} />
        </Route>
      </Routes>
    </HubContexto.Provider>
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
