import { useCallback, useEffect, useState } from "react";
import { Board } from "./components/Board";
import { QuickSwitch } from "./components/QuickSwitch";
import { Terminal } from "./components/Terminal";
import { buildCommand } from "./lib/commands";
import {
  addSession,
  loadRegistry,
  resumeSession,
  setActiveSession,
  useActiveSession,
  useRegistryLoaded,
  useSessions,
} from "./store/sessions";

type View = "board" | "focus";

export function App() {
  const sessions = useSessions();
  const activeSession = useActiveSession();
  const loaded = useRegistryLoaded();
  const [view, setView] = useState<View>("board");
  const [quickSwitchOpen, setQuickSwitchOpen] = useState(false);

  // Load persisted sessions on startup
  useEffect(() => {
    loadRegistry();
  }, []);

  const openSession = useCallback(
    (id: string) => {
      const session = sessions.find((s) => s.id === id);
      if (
        session &&
        (session.status === "closed" || session.status === "exited")
      ) {
        resumeSession(id);
      }
      setActiveSession(id);
      setView("focus");
    },
    [sessions],
  );

  const goToBoard = useCallback(() => {
    setView("board");
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "k") {
        e.preventDefault();
        setQuickSwitchOpen((prev) => !prev);
        return;
      }

      if (mod && e.key === "n") {
        e.preventDefault();
        const name = `session-${sessions.length + 1}`;
        const session = addSession({ name, cwd: "~" });
        openSession(session.id);
        return;
      }

      if (mod && e.key === "b") {
        e.preventDefault();
        setView((v) => (v === "board" ? "focus" : "board"));
        return;
      }

      if (mod && e.key === "]") {
        e.preventDefault();
        if (sessions.length < 2 || !activeSession) return;
        const idx = sessions.findIndex((s) => s.id === activeSession.id);
        const next = sessions[(idx + 1) % sessions.length];
        openSession(next.id);
        return;
      }

      if (mod && e.key === "[") {
        e.preventDefault();
        if (sessions.length < 2 || !activeSession) return;
        const idx = sessions.findIndex((s) => s.id === activeSession.id);
        const prev = sessions[(idx - 1 + sessions.length) % sessions.length];
        openSession(prev.id);
      }
    },
    [sessions, activeSession, openSession],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const runningSessions = sessions.filter(
    (s) => s.status === "running" || s.status === "idle",
  );

  if (!loaded) {
    return (
      <div className="h-screen w-screen bg-[#0f0f0f] flex items-center justify-center">
        <span className="text-[11px] text-[#555555]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#0f0f0f] overflow-hidden flex flex-col">
      {/* Title bar */}
      <div
        data-tauri-drag-region
        className="h-10 shrink-0 flex items-center px-4 gap-2 border-b border-white/[0.04]"
      >
        <span className="text-[11px] text-[#444444] ml-[70px] select-none">
          Termaude
        </span>

        {/* Focus view: show active session name + column */}
        {view === "focus" && activeSession && (
          <span className="text-[11px] text-[#555555] select-none">
            <span className="text-[#666666]">{activeSession.name}</span>
            <span className="mx-1.5 text-[#333333]">·</span>
            <span>{activeSession.column}</span>
          </span>
        )}

        <div className="flex-1" />

        {view === "focus" && (
          <button
            type="button"
            onClick={goToBoard}
            className="text-[11px] text-[#555555] hover:text-[#888888] transition-colors duration-100 mr-3"
          >
            ← Board
          </button>
        )}

        <div className="flex gap-1">
          {sessions
            .filter((s) => s.status === "running" || s.status === "idle")
            .map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => openSession(session.id)}
                className={`text-[11px] px-2.5 py-1 rounded-md transition-colors duration-100 ${
                  activeSession?.id === session.id && view === "focus"
                    ? "bg-[#252525] text-[#e8e8e8]"
                    : "text-[#555555] hover:text-[#888888] hover:bg-white/[0.03]"
                }`}
              >
                {session.name}
              </button>
            ))}
          <button
            type="button"
            onClick={() => {
              const name = `session-${sessions.length + 1}`;
              const session = addSession({ name, cwd: "~" });
              openSession(session.id);
            }}
            className="text-[11px] px-2 py-1 text-[#444444] hover:text-[#666666] transition-colors duration-100"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute inset-0 flex flex-col transition-opacity duration-[180ms] ease-out"
          style={{
            opacity: view === "board" ? 1 : 0,
            pointerEvents: view === "board" ? "auto" : "none",
          }}
        >
          <Board onOpenSession={openSession} />
        </div>

        <div
          className="absolute inset-0 transition-opacity duration-[180ms] ease-out"
          style={{
            opacity: view === "focus" ? 1 : 0,
            pointerEvents: view === "focus" ? "auto" : "none",
          }}
        >
          {runningSessions.map((session) => (
            <div
              key={`${session.id}-${session.generation}`}
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
                command={buildCommand(session, session.generation > 1)}
                visible={activeSession?.id === session.id && view === "focus"}
                onExit={goToBoard}
              />
            </div>
          ))}
        </div>
      </div>

      <QuickSwitch
        open={quickSwitchOpen}
        onClose={() => {
          setQuickSwitchOpen(false);
          if (activeSession) setView("focus");
        }}
      />
    </div>
  );
}
