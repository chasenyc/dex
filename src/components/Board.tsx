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
  addColumn,
  moveSession,
  reorderSessionsInColumn,
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
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

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

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeSession = sessions.get(activeId);
    if (!activeSession) return;

    // Dropped on a column droppable
    if (overId.startsWith("column-")) {
      const columnName = overId.replace("column-", "");
      moveSession(activeId, columnName);
      return;
    }

    // Dropped on another card
    const targetSession = sessions.get(overId);
    if (!targetSession) return;

    if (activeSession.column === targetSession.column) {
      // Reorder within same column
      const columnSessions = Array.from(sessions.values())
        .filter((s) => s.column === activeSession.column)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const oldIndex = columnSessions.findIndex((s) => s.id === activeId);
      const newIndex = columnSessions.findIndex((s) => s.id === overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const ids = columnSessions.map((s) => s.id);
        ids.splice(oldIndex, 1);
        ids.splice(newIndex, 0, activeId);
        reorderSessionsInColumn(activeSession.column, ids);
      }
    } else {
      // Move to target's column, placed at target's position
      moveSession(activeId, targetSession.column, targetSession.order);
    }
  }

  function handleAddColumn() {
    const trimmed = newColumnName.trim();
    if (trimmed) {
      addColumn(trimmed);
    }
    setNewColumnName("");
    setAddingColumn(false);
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

          {/* Add column button */}
          <div className="min-w-[200px] shrink-0">
            {addingColumn ? (
              <input
                type="text"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddColumn();
                  if (e.key === "Escape") {
                    setAddingColumn(false);
                    setNewColumnName("");
                  }
                }}
                onBlur={handleAddColumn}
                ref={(el) => el?.focus()}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="column name..."
                className="w-full bg-[#131313] text-[11px] font-semibold uppercase tracking-wider text-[#e8e8e8] rounded-lg px-3 py-2.5 outline-none border border-[#7c6aef]/30 placeholder:text-[#333333] placeholder:normal-case"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingColumn(true)}
                className="text-[11px] text-[#333333] hover:text-[#555555] transition-colors px-3 py-2.5"
              >
                + Add Column
              </button>
            )}
          </div>
        </div>
        <DragOverlay>
          {activeCard ? (
            <div className="bg-[#1c1c1c] rounded-lg p-3 shadow-lg shadow-black/40 border border-[#7c6aef]/20 w-[260px]">
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
