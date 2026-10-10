import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Truck } from "lucide-react";
import { useHub } from "./HubContexto";
import HubSino from "./HubSino";

export default function HubLayout() {
  const ctx = useHub();
  const tem = (tipo) => ctx.perfis.some((p) => p.tipo === tipo);
  const areas = [
    tem("coletor") && { to: "/hub/coletor", rotulo: "Coletas" },
    tem("fretista") && { to: "/hub/fretista", rotulo: "Fretes" },
    (ctx.admin || tem("base")) && { to: "/hub/base", rotulo: "Base" },
    ctx.revenda_ativa && { to: "/hub/acompanhar", rotulo: "Meus pedidos" },
    ctx.admin && { to: "/hub/admin", rotulo: "Admin", fim: false },
  ].filter(Boolean);
  const adminSub = [
    { to: "/hub/admin", rotulo: "Ao vivo", fim: true },
    { to: "/hub/admin/pedidos", rotulo: "Pedidos" },
    { to: "/hub/admin/financeiro", rotulo: "Financeiro" },
    { to: "/hub/admin/cadastros", rotulo: "Cadastros" },
  ];
  const naAdmin = useLocation().pathname.startsWith("/hub/admin");

  const pilula = ({ isActive }) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${isActive ? "bg-white text-slate-900" : "text-slate-200 hover:bg-white/10"}`;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <NavLink to="/hub" className="flex items-center gap-2 font-bold">
            <Truck className="h-6 w-6 text-emerald-400" />Hub PlaceFit
          </NavLink>
          <div className="flex-1" />
          <HubSino user={{ id: ctx.usuario.id }} sempre escuro />
          <a href="/app" className="hidden text-xs text-slate-300 hover:text-white sm:block">Loja PlaceFit</a>
        </div>
        {areas.length > 1 && (
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-3">
            {areas.map((a) => <NavLink key={a.to} to={a.to} end={a.fim !== false} className={pilula}>{a.rotulo}</NavLink>)}
          </nav>
        )}
        {ctx.admin && naAdmin && (
          <nav className="border-t border-white/10 bg-slate-800">
            <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2">
              {adminSub.map((a) => <NavLink key={a.to} to={a.to} end={a.fim} className={pilula}>{a.rotulo}</NavLink>)}
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
