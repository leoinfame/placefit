import React from "react";
import { Link } from "react-router-dom";
import { PackageSearch, Truck, Warehouse, LayoutDashboard, ClipboardList, BookOpen, UserPlus, ChevronRight } from "lucide-react";
import { useHub } from "../components/HubContexto";

// Pagina principal do Hub: atalhos do que a pessoa faz, como funciona e (admin) convites.
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
  const pendentes = ctx.perfis.filter((p) => p.verificacao !== "verificado");

  return (
    <div className="mx-auto max-w-md space-y-3">
      <h1 className="text-xl font-bold text-slate-900">Olá, {ctx.usuario.nome?.split(" ")[0]}</h1>
      {pendentes.map((p) => (
        <p key={p.id} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Seu perfil de {p.tipo} está {p.verificacao === "suspenso" ? "suspenso. Fale com a PlaceFit." : "aguardando verificação da PlaceFit. A fila aparece assim que for liberado."}
        </p>
      ))}

      {opcoes.map(({ to, titulo, texto, icone: Icone }) => (
        <Link key={to} to={to} className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm active:scale-[0.99]">
          <Icone className="h-9 w-9 shrink-0 text-emerald-600" />
          <div className="flex-1">
            <p className="text-lg font-bold text-slate-900">{titulo}</p>
            <p className="text-sm text-slate-500">{texto}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300" />
        </Link>
      ))}

      {ctx.admin && (
        <Link to="/hub/admin/convites" className="flex items-center gap-4 rounded-2xl bg-emerald-600 p-5 text-white shadow-sm active:scale-[0.99]">
          <UserPlus className="h-9 w-9 shrink-0" />
          <div className="flex-1">
            <p className="text-lg font-bold">Convidar coletor ou fretista</p>
            <p className="text-sm text-emerald-50">Gere o link e envie pelo WhatsApp</p>
          </div>
          <ChevronRight className="h-5 w-5 text-emerald-200" />
        </Link>
      )}

      <Link to="/hub/como-funciona" className="flex items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white p-5 active:scale-[0.99]">
        <BookOpen className="h-9 w-9 shrink-0 text-slate-600" />
        <div className="flex-1">
          <p className="text-lg font-bold text-slate-900">Como o Hub funciona</p>
          <p className="text-sm text-slate-500">Do pedido fechado à entrega no cliente</p>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-300" />
      </Link>
    </div>
  );
}
