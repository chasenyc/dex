import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useRef, useState } from "react";
import {
  removeColumn,
  renameColumn,
  useColumns,
  useSessionsByColumn,
} from "../store/sessions";
import { Card } from "./Card";
import { NewSessionInput } from "./NewSessionInput";

interface ColumnProps {
  name: string;
  onOpenSession: (id: string) => void;
}

export function Column({ name, onOpenSession }: ColumnProps) {
  const sessions = useSessionsByColumn(name);
  const columns = useColumns();
  const { setNodeRef, isOver } = useDroppable({ id: `column-${name}` });
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);
  const renameRef = useRef<HTMLInputElement>(null);

  function handleRenameSubmit() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== name) {
      renameColumn(name, trimmed);
    }
    setRenaming(false);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    // Simple inline rename on right-click
    setRenameValue(name);
    setRenaming(true);
    requestAnimationFrame(() => renameRef.current?.select());
  }

  return (
    <div
      className={`
        group/column flex flex-col min-w-[260px] w-[280px] shrink-0
        bg-[#131313] rounded-lg transition-all duration-100
        ${isOver ? "ring-1 ring-[#7c6aef]/30 bg-[#161616]" : ""}
      `}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: context menu on column header */}
      <div
        className="flex items-center justify-between px-3 py-2.5"
        onContextMenu={handleContextMenu}
      >
        {renaming ? (
          <input
            ref={renameRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") setRenaming(false);
            }}
            onBlur={handleRenameSubmit}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="text-[11px] font-semibold uppercase tracking-wider text-[#e8e8e8] bg-transparent outline-none border-b border-[#7c6aef]/40 w-full"
          />
        ) : (
          <div className="flex items-center gap-2 flex-1">
            {/* biome-ignore lint/a11y/noStaticElementInteractions: double-click to rename */}
            <span
              className="text-[11px] font-semibold uppercase tracking-wider text-[#555555] cursor-default"
              onDoubleClick={() => {
                setRenameValue(name);
                setRenaming(true);
                requestAnimationFrame(() => renameRef.current?.select());
              }}
            >
              {name}
            </span>
            <span className="text-[10px] text-[#333333]">
              {sessions.length}
            </span>
          </div>
        )}
        {!renaming && columns.length > 1 && (
          <button
            type="button"
            onClick={() => removeColumn(name)}
            className="opacity-0 group-hover/column:opacity-100 text-[#333333] hover:text-[#c05050] transition-all duration-100 p-0.5"
            title="Delete column"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 16 16"
              fill="none"
              role="img"
              aria-label="Delete column"
            >
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
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
      </div>
      <div className="px-2 pb-2 shrink-0">
        <NewSessionInput column={name} onCreated={onOpenSession} />
      </div>
    </div>
  );
}
