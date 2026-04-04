import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useState } from "react";
import {
  moveSession,
  type Session,
  useColumns,
  useSessionStore,
} from "../store/sessions";
import { Column } from "./Column";

interface BoardProps {
  onOpenSession: (id: string) => void;
}

export function Board({ onOpenSession }: BoardProps) {
  const columns = useColumns();
  const { sessions } = useSessionStore();
  const [activeCard, setActiveCard] = useState<Session | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    const session = sessions.get(String(event.active.id));
    setActiveCard(session ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);

    // Dropped on a column droppable
    if (overId.startsWith("column-")) {
      const columnName = overId.replace("column-", "");
      moveSession(String(active.id), columnName);
      return;
    }

    // Dropped on another card — move to that card's column
    const targetSession = sessions.get(overId);
    if (targetSession) {
      moveSession(String(active.id), targetSession.column);
    }
  }

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 h-full">
          {columns.map((col) => (
            <Column key={col} name={col} onOpenSession={onOpenSession} />
          ))}
        </div>
        <DragOverlay>
          {activeCard ? (
            <div className="bg-[#1c1c1c] rounded-lg p-3 shadow-xl shadow-black/50 rotate-2 scale-[1.03] border border-[#7c6aef]/20 w-[260px]">
              <div className="text-[13px] font-medium text-[#e8e8e8] truncate">
                {activeCard.name}
              </div>
              <div className="text-[11px] text-[#555555] truncate">
                {activeCard.cwd}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
