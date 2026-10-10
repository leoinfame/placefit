import React from "react";
import { Link, Navigate } from "react-router-dom";
import { PackageSearch, Truck, Warehouse, LayoutDashboard, ClipboardList } from "lucide-react";
import { useHub } from "../components/HubContexto";

export default function HubInicio() {
  const ctx = useHub();
  const tem = (tipo) => ctx.perfis.some((p) => p.tipo === tipo);
  const opcoes = [
    tem("coletor") && { to: "/hub/coletor", titulo: "Coletas", texto: "Fila da sua região e suas coletas", icone: PackageSearch },
    tem("fretista") && { to: "/hub/fretista", titulo: "Fretes", texto: "Pedidos consolidados aguardando frete", icone: Truck },
    (ctx.admin || tem("base")) && { to: "/hub/base", titulo: "Base", texto: "Conferir, consolidar e liberar", icone: Warehouse },
    ctx.revenda_ativa && { to: "/hub/acompanhar", titulo: "Meus pedidos", texto: "Acompanhe cada etapa da entrega", icone: ClipboardList },
    ctx.admin && { to: "/hub/admin", titulo: "Administração", texto: "Ao vivo, pedidos, financeiro e cadastros", icone: LayoutDashboard },
  ].filter(Boolean);

  if (opcoes.length === 1) return <Navigate to={opcoes[0].to} replace />;

  const pendentes = ctx.perfis.filter((p) => p.verificacao !== "verificado");
  return (
    <div className="mx-auto max-w-md space-y-3">
      <h1 className="text-xl font-bold text-slate-900">Olá, {ctx.usuario.nome?.split(" ")[0]}</h1>
      {pendentes.map((p) => (
        <p key={p.id} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Seu perfil de {p.tipo} está {p.verificacao === "suspenso" ? "suspenso" : "aguardando verificação"}. A fila aparece depois da liberação.
        </p>
      ))}
      {opcoes.map(({ to, titulo, texto, icone: Icone }) => (
        <Link key={to} to={to} className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm active:scale-[0.99]">
          <Icone className="h-9 w-9 text-emerald-600" />
          <div>
            <p className="text-lg font-bold text-slate-900">{titulo}</p>
            <p className="text-sm text-slate-500">{texto}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
