import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Session } from "../store/sessions";

interface CardProps {
  session: Session;
  onOpen: (id: string) => void;
}

const STATUS_DOTS: Record<string, { color: string; label: string }> = {
  running: { color: "bg-[#34d399]", label: "running" },
  idle: { color: "bg-[#555555]", label: "idle" },
  closed: { color: "bg-[#555555]", label: "closed — double-click to resume" },
  exited: { color: "bg-[#34d399]", label: "exited" },
  error: { color: "bg-[#f87171]", label: "error" },
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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
        bg-[#1c1c1c] rounded-lg p-3 cursor-grab active:cursor-grabbing
        border border-transparent hover:border-white/[0.06]
        hover:bg-[#202020] transition-colors
        ${isDragging ? "shadow-lg shadow-black/40 rotate-1 scale-[1.02]" : ""}
      `}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-medium text-[#e8e8e8] truncate">
          {session.name}
        </span>
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${dot.color} ${
            session.status === "running" ? "animate-pulse" : ""
          }`}
          title={dot.label}
        />
      </div>
      <div className="text-[11px] text-[#555555] truncate">{session.cwd}</div>
      <div className="mt-2 text-[10px] text-[#444444]">
        {timeAgo(session.lastActivity)}
      </div>
    </div>
  );
}
