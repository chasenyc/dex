import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSessionsByColumn } from "../store/sessions";
import { Card } from "./Card";
import { NewSessionInput } from "./NewSessionInput";

interface ColumnProps {
  name: string;
  onOpenSession: (id: string) => void;
}

export function Column({ name, onOpenSession }: ColumnProps) {
  const sessions = useSessionsByColumn(name);
  const { setNodeRef, isOver } = useDroppable({ id: `column-${name}` });

  return (
    <div
      className={`
        flex flex-col min-w-[260px] w-[280px] shrink-0
        bg-[#131313] rounded-lg
        ${isOver ? "ring-1 ring-[#7c6aef]/30" : ""}
      `}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#555555]">
            {name}
          </span>
          <span className="text-[10px] text-[#333333]">{sessions.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-2"
      >
        <SortableContext
          items={sessions.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {sessions.map((session) => (
            <Card key={session.id} session={session} onOpen={onOpenSession} />
          ))}
        </SortableContext>
        <NewSessionInput column={name} onCreated={onOpenSession} />
      </div>
    </div>
  );
}
