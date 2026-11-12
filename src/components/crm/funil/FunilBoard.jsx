import React, { useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Badge } from "@/components/ui/badge";
import { STAGES, corDoTempo, tempoDesde } from "@/components/crm/funil/etapasFunil";

// Funil comercial arrastável: cada coluna é uma etapa da CRMConversa.
// Soltar um card em outra coluna chama onMover(conversa, etapa) — quem grava
// é a tela do CRM, com reversão automática se o salvamento falhar.
export default function FunilBoard({ conversas = [], orcInfo = {}, agora, nomeContato, nomeTelefone, onAbrir, onMover }) {
  const ultimoArrasto = useRef(0);

  function aoSoltar({ source, destination, draggableId }) {
    ultimoArrasto.current = Date.now();
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    const conversa = conversas.find((item) => item.id === draggableId);
    if (!conversa) return;
    onMover(conversa, destination.droppableId);
  }

  function abrir(conversation) {
    // Um arrasto não deve abrir a conversa ao soltar.
    if (Date.now() - ultimoArrasto.current < 250) return;
    onAbrir(conversation.id);
  }

  return (
    <DragDropContext onDragEnd={aoSoltar}>
      <div className="grid gap-4 overflow-x-auto pb-3 md:grid-cols-2 xl:grid-cols-3">
        {STAGES.map((stage) => {
          const rows = conversas.filter((conversation) => (conversation.etapa || "novo") === stage.value);
          return (
            <Droppable droppableId={stage.value} key={stage.value}>
              {(dropProvided, dropSnapshot) => (
                <div
                  ref={dropProvided.innerRef}
                  {...dropProvided.droppableProps}
                  className={"min-h-[220px] rounded-2xl border bg-slate-50 p-3 transition-colors " + (dropSnapshot.isDraggingOver ? "border-emerald-400 bg-emerald-50" : "border-slate-200")}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={"h-2.5 w-2.5 rounded-full " + stage.dot} />
                      <span className="text-sm font-semibold text-slate-800">{stage.label}</span>
                    </div>
                    <Badge variant="secondary">{rows.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {rows.map((conversation, index) => (
                      <Draggable draggableId={conversation.id} index={index} key={conversation.id}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={dragSnapshot.isDragging ? "opacity-95" : ""}
                          >
                            <button
                              type="button"
                              onClick={() => abrir(conversation)}
                              className={"w-full cursor-grab rounded-xl border bg-white p-3 text-left active:cursor-grabbing " + (dragSnapshot.isDragging ? "border-emerald-400 shadow-lg" : "border-slate-200 hover:border-emerald-300")}
                            >
                              <p className="text-sm font-semibold text-slate-900">{nomeContato(conversation)}</p>
                              <p className="mt-1 text-xs text-slate-500">{nomeTelefone(conversation)}</p>
                              <p className="mt-2 truncate text-xs text-slate-400">{conversation.ultima_mensagem || "Sem mensagens"}</p>
                              {orcInfo[conversation.id] && (
                                <div className="mt-2 space-y-1">
                                  <div
                                    className={"inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium " + corDoTempo(orcInfo[conversation.id].criado, agora)}
                                    title={"Orçamento " + orcInfo[conversation.id].numero}
                                  >
                                    Orçamento há {tempoDesde(orcInfo[conversation.id].criado, agora)}
                                  </div>
                                  <p className={"text-[11px] " + (orcInfo[conversation.id].retorno ? "text-emerald-700" : "text-slate-500")}>
                                    {orcInfo[conversation.id].retorno
                                      ? "Cliente respondeu há " + tempoDesde(orcInfo[conversation.id].retorno, agora)
                                      : "Sem retorno do cliente desde o orçamento"}
                                  </p>
                                </div>
                              )}
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {dropProvided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}