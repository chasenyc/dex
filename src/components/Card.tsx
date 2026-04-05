import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRef, useState } from "react";
import { removeSession, renameSession, type Session } from "../store/sessions";

interface CardProps {
  session: Session;
  onOpen: (id: string) => void;
}

const STATUS_DOTS: Record<string, { color: string; label: string }> = {
  running: { color: "bg-[#22c55e]", label: "working" },
  idle: { color: "bg-[#e8e8e8]", label: "waiting for input" },
  permission: { color: "bg-[#f59e0b]", label: "needs permission" },
  closed: { color: "bg-[#444444]", label: "closed — double-click to resume" },
  exited: { color: "bg-[#444444]", label: "exited" },
  error: { color: "bg-[#ef4444]", label: "error" },
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function Card({ session, onOpen }: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: session.id });
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.name);
  const renameRef = useRef<HTMLInputElement>(null);

  function handleRenameSubmit() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== session.name) {
      renameSession(session.id, trimmed);
    }
    setRenaming(false);
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dot = STATUS_DOTS[session.status] ?? STATUS_DOTS.idle;

  return (
    // biome-ignore lint/a11y/useSemanticElements: div required for dnd-kit drag handle
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onDoubleClick={() => onOpen(session.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(session.id);
      }}
      className={`
        group relative bg-[#1c1c1c] rounded-lg p-3 cursor-grab active:cursor-grabbing
        border border-transparent hover:border-white/[0.06]
        hover:bg-[#202020] hover:shadow-md hover:shadow-black/20
        transition-all duration-100 ease-out
        ${isDragging ? "opacity-30" : ""}
      `}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          removeSession(session.id);
        }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/[0.06]"
        title="Delete session"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          role="img"
          aria-label="Delete"
          className="text-[#555555] hover:text-[#c05050] transition-colors"
        >
          <path
            d="M5.5 1.5h5M2.5 4h11M13 4l-.5 8.5a1.5 1.5 0 01-1.5 1.5H5a1.5 1.5 0 01-1.5-1.5L3 4m3.5 0V2.5a1 1 0 011-1h1a1 1 0 011 1V4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className="mb-1 flex items-center gap-1.5">
        {session.type === "claude" ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 1200 1200"
            fill="none"
            role="img"
            aria-label="Claude"
            className="shrink-0"
          >
            <path
              fill="#D97757"
              d="M234 800l235-132 4-11-4-6h-11l-40-3-134-3-116-5-113-6-28-6-27-35 3-18 24-16 34 3 76 5 113 8 82 5 122 13h19l3-8-6-5-5-5-118-79-127-84-66-48-36-25-18-23-8-50 33-36 44 3 11 3 44 34 95 73 124 91 18 15 7-5 1-4-8-13-67-122-72-124-32-51-8-31c-3-13-5-23-5-36l37-50 21-7 49 7 21 18 31 70 50 111 77 151 23 44 12 42 4 12h8v-7l6-85 12-104 11-134 4-38 19-45 37-25 29 14 24 34-3 22-14 92-28 145-18 96 10 1 12-12 49-65 82-103 36-41 42-45 28-21 51 0 38 56-17 58-53 67-44 57-62 84-40 68 4 5 9-1 142-30 77-14 91-16 42 19 4 20-16 40-98 24-115 23-170 40-2 2 2 3 77 7 33 2 81 0 150 11 39 26 24 32-4 24-61 31-81-20-190-45-66-16-9 0 0 5 54 53 100 90 125 116 6 29-16 22-17-2-110-83-42-37-96-80-6 0 0 8 22 33 117 175 6 54-9 17-30 11-33-6-68-96-71-107-57-97-7 4-34 361-16 18-36 14-30-23-16-37 16-74 20-96 16-76 14-86 8-32 0-2-7 1-71 98-109 146-85 91-21 8-35-18-29-58 2-33 20-29 118-150 72-93 46-54 0-8-3 0-315 205-56 7-25-22 3-37 11-12 95-65Z"
            />
          </svg>
        ) : (
          <span className="text-[11px] font-mono text-[#7c6aef] shrink-0">
            &gt;_
          </span>
        )}
        {renaming ? (
          <input
            ref={renameRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") setRenaming(false);
            }}
            onBlur={handleRenameSubmit}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="text-[13px] font-medium text-[#e8e8e8] bg-transparent outline-none border-b border-[#7c6aef]/40 w-full pr-5"
          />
        ) : (
          <button
            type="button"
            className="text-[13px] font-medium text-[#e8e8e8] truncate pr-5 cursor-text bg-transparent border-none p-0 text-left"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setRenameValue(session.name);
              setRenaming(true);
              requestAnimationFrame(() => renameRef.current?.select());
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {session.name}
          </button>
        )}
      </div>
      <div className="text-[11px] text-[#555555] truncate">{session.cwd}</div>
      {session.type === "claude" &&
        session.previewLines &&
        session.previewLines.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {session.previewLines.map((line) => (
              <div
                key={`${session.id}-${line.slice(0, 60)}`}
                className="text-[10px] font-mono text-[#444444] truncate leading-tight"
              >
                {line}
              </div>
            ))}
          </div>
        )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-[#444444]">
          {timeAgo(session.createdAt)} · {timeAgo(session.lastActivity)}
        </span>
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${dot.color} ${
            session.status === "running" ? "animate-pulse" : ""
          }`}
          title={dot.label}
        />
      </div>
    </div>
  );
}
