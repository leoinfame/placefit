import React, { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { hub, dataHora } from "../lib/hubApi";

// Sino do Hub. Na loja so aparece para quem ja recebeu alguma notificacao do Hub
// (ex.: revenda piloto vendo "saiu para entrega"); para os demais nao renderiza nada.
export default function HubSino({ user, sempre = false, escuro = false }) {
  const [lista, setLista] = useState([]);

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLista(await base44.entities.HubNotificacao.filter({ destinatario_user_id: user.id }, "-created_date", 30));
    } catch {
      setLista([]);
    }
  }, [user?.id]);

  useEffect(() => {
    carregar();
    if (!user?.id) return;
    const sair = base44.entities.HubNotificacao.subscribe((ev) => {
      if (ev?.data?.destinatario_user_id === user.id) carregar();
    });
    return () => sair?.();
  }, [carregar, user?.id]);

  if (!sempre && lista.length === 0) return null;
  const naoLidas = lista.filter((n) => !n.lida).length;

  const abrir = async (aberto) => {
    if (!aberto && naoLidas) {
      await hub("marcar_lidas").catch(() => null);
      carregar();
    }
  };

  return (
    <DropdownMenu onOpenChange={abrir}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={`relative ${escuro ? "text-white hover:bg-white/10 hover:text-white" : ""}`} aria-label="Notificações do Hub">
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Hub PlaceFit</div>
        <div className="max-h-96 divide-y overflow-y-auto">
          {lista.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Nenhuma notificação</p>}
          {lista.map((n) => (
            <a key={n.id} href={n.link || "/hub"} className={`block px-4 py-3 hover:bg-slate-50 ${n.lida ? "" : "bg-blue-50/60"}`}>
              <p className="text-sm font-semibold text-slate-900">{n.titulo}</p>
              <p className="text-sm text-slate-600">{n.mensagem}</p>
              <p className="mt-1 text-xs text-slate-400">{dataHora(n.created_date)}</p>
            </a>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
