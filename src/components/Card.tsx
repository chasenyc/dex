import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { removeSession, type Session } from "../store/sessions";

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
      <div className="mb-1">
        <span className="text-[13px] font-medium text-[#e8e8e8] truncate block pr-5">
          {session.name}
        </span>
      </div>
      <div className="text-[11px] text-[#555555] truncate">{session.cwd}</div>
      {session.previewLines && session.previewLines.length > 0 && (
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
          {timeAgo(session.lastActivity)}
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
