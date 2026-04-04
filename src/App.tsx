import { useCallback, useEffect, useState } from "react";
import { Board } from "./components/Board";
import { QuickSwitch } from "./components/QuickSwitch";
import { Terminal } from "./components/Terminal";
import {
  addSession,
  setActiveSession,
  useActiveSession,
  useSessions,
} from "./store/sessions";

type View = "board" | "focus";

export function App() {
  const sessions = useSessions();
  const activeSession = useActiveSession();
  const [view, setView] = useState<View>("board");
  const [quickSwitchOpen, setQuickSwitchOpen] = useState(false);

  useEffect(() => {
    if (sessions.length === 0) {
      addSession("main", "~");
    }
  }, [sessions.length]);

  const openSession = useCallback((id: string) => {
    setActiveSession(id);
    setView("focus");
  }, []);

  const goToBoard = useCallback(() => {
    setView("board");
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+K — quick switch
      if (mod && e.key === "k") {
        e.preventDefault();
        setQuickSwitchOpen((prev) => !prev);
        return;
      }

      // Cmd+N — new session
      if (mod && e.key === "n") {
        e.preventDefault();
        const name = `session-${sessions.length + 1}`;
        const session = addSession(name, "~");
        openSession(session.id);
        return;
      }

      // Escape — back to board (only in focus view, when quick switch is closed)
      if (e.key === "Escape" && view === "focus" && !quickSwitchOpen) {
        // Don't steal Escape from terminal apps — use Cmd+Escape instead
        return;
      }

      // Cmd+B — toggle board
      if (mod && e.key === "b") {
        e.preventDefault();
        setView((v) => (v === "board" ? "focus" : "board"));
        return;
      }

      // Cmd+] — next session
      if (mod && e.key === "]") {
        e.preventDefault();
        if (sessions.length < 2 || !activeSession) return;
        const idx = sessions.findIndex((s) => s.id === activeSession.id);
        const next = sessions[(idx + 1) % sessions.length];
        openSession(next.id);
        return;
      }

      // Cmd+[ — previous session
      if (mod && e.key === "[") {
        e.preventDefault();
        if (sessions.length < 2 || !activeSession) return;
        const idx = sessions.findIndex((s) => s.id === activeSession.id);
        const prev = sessions[(idx - 1 + sessions.length) % sessions.length];
        openSession(prev.id);
      }
    },
    [sessions, activeSession, view, quickSwitchOpen, openSession],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-screen w-screen bg-[#0f0f0f] overflow-hidden flex flex-col">
      {/* Title bar */}
      <div
        data-tauri-drag-region
        className="h-8 shrink-0 flex items-center px-4 gap-2"
      >
        <span className="text-[11px] text-[#555555] ml-[70px]">Termaude</span>
        <div className="flex-1" />

        {view === "focus" && (
          <button
            type="button"
            onClick={goToBoard}
            className="text-[11px] text-[#555555] hover:text-[#888888] transition-colors mr-2"
          >
            ← Board
          </button>
        )}

        <div className="flex gap-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => openSession(session.id)}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                activeSession?.id === session.id && view === "focus"
                  ? "bg-[#252525] text-[#e8e8e8]"
                  : "text-[#555555] hover:text-[#888888]"
              }`}
            >
              {session.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const name = `session-${sessions.length + 1}`;
              const session = addSession(name, "~");
              openSession(session.id);
            }}
            className="text-[11px] px-2 py-0.5 text-[#555555] hover:text-[#888888] transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 relative">
        {/* Board view */}
        <div
          className="absolute inset-0 flex flex-col transition-opacity duration-200"
          style={{
            opacity: view === "board" ? 1 : 0,
            pointerEvents: view === "board" ? "auto" : "none",
          }}
        >
          <Board onOpenSession={openSession} />
        </div>

        {/* Focus view — all terminals stacked, only active visible */}
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{
            opacity: view === "focus" ? 1 : 0,
            pointerEvents: view === "focus" ? "auto" : "none",
          }}
        >
          {sessions.map((session) => (
            <div
              key={session.id}
              className="absolute inset-0"
              style={{
                display:
                  activeSession?.id === session.id && view === "focus"
                    ? "block"
                    : "none",
              }}
            >
              <Terminal
                sessionId={session.id}
                cwd={session.cwd}
                command={session.command}
                visible={activeSession?.id === session.id && view === "focus"}
              />
            </div>
          ))}
        </div>
      </div>

      <QuickSwitch
        open={quickSwitchOpen}
        onClose={() => {
          setQuickSwitchOpen(false);
          // If a session was selected, switch to focus view
          if (activeSession) setView("focus");
        }}
      />
    </div>
  );
}
