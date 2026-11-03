import React from "react";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

/** Item 024B: semáforo por etapa, contado da última atividade. */
export default function SemaforoBadge({ semaforo, proximoPasso, compacto = false }) {
  if (!semaforo) return null;
  const comPasso = Boolean(proximoPasso);

  if (compacto) {
    return (
      <span
        className={"inline-block h-2.5 w-2.5 shrink-0 rounded-full " + semaforo.dot}
        title={`${semaforo.label} · ${semaforo.diasParado} dia(s) parado(s) · limite ${semaforo.limite} dia(s)`}
      />
    );
  }

  return (
    <Badge className={"gap-1 border-0 text-[11px] " + semaforo.color} title={`Limite de ${semaforo.limite} dia(s) nesta etapa`}>
      {semaforo.label} · {semaforo.diasParado}d
      {comPasso && <Check className="h-3 w-3" />}
    </Badge>
  );
}