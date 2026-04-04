import { useEffect, useRef, useState } from "react";
import { type Session, setActiveSession, useSessions } from "../store/sessions";

interface QuickSwitchProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_ICONS: Record<string, string> = {
  running: "●",
  idle: "○",
  exited: "✓",
  error: "●",
  disconnected: "○",
};

const STATUS_COLORS: Record<string, string> = {
  running: "text-[#34d399]",
  idle: "text-[#555555]",
  exited: "text-[#34d399]",
  error: "text-[#f87171]",
  disconnected: "text-[#555555]",
};

function matchesQuery(session: Session, query: string): boolean {
  const q = query.toLowerCase();
  return (
    session.name.toLowerCase().includes(q) ||
    session.cwd.toLowerCase().includes(q) ||
    session.column.toLowerCase().includes(q)
  );
}

export function QuickSwitch({ open, onClose }: QuickSwitchProps) {
  const sessions = useSessions();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? sessions.filter((s) => matchesQuery(s, query))
    : sessions;

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      // Focus after render
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Clamp selected index when filtered list changes
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  function selectSession(session: Session) {
    setActiveSession(session.id);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[selectedIndex]) {
          selectSession(filtered[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        onKeyDown={() => {}}
        role="presentation"
      />
      <div
        className="relative w-[480px] bg-[#1c1c1c] rounded-xl shadow-2xl overflow-hidden"
        role="dialog"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <span className="text-[11px] text-[#555555]">⌘K</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Switch session..."
            className="flex-1 bg-transparent text-[14px] text-[#e8e8e8] outline-none placeholder:text-[#555555]"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-[13px] text-[#555555]">
              No sessions found
            </div>
          ) : (
            filtered.map((session, index) => (
              <button
                key={session.id}
                type="button"
                onClick={() => selectSession(session)}
                className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                  index === selectedIndex
                    ? "bg-[#252525]"
                    : "hover:bg-[#1f1f1f]"
                }`}
              >
                <span
                  className={`text-[10px] ${STATUS_COLORS[session.status] ?? "text-[#555555]"}`}
                >
                  {STATUS_ICONS[session.status] ?? "○"}
                </span>
                <span className="text-[13px] text-[#e8e8e8] flex-1">
                  {session.name}
                </span>
                <span className="text-[11px] text-[#555555]">
                  {session.column}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
