import { useCallback, useEffect, useState } from "react";
import { QuickSwitch } from "./components/QuickSwitch";
import { Terminal } from "./components/Terminal";
import {
  addSession,
  setActiveSession,
  useActiveSession,
  useSessions,
} from "./store/sessions";

export function App() {
  const sessions = useSessions();
  const activeSession = useActiveSession();
  const [quickSwitchOpen, setQuickSwitchOpen] = useState(false);

  useEffect(() => {
    if (sessions.length === 0) {
      addSession("main", "~");
    }
  }, [sessions.length]);

  // Global keyboard shortcuts
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
        addSession(name, "~");
        return;
      }

      // Cmd+] — next session
      if (mod && e.key === "]") {
        e.preventDefault();
        if (sessions.length < 2 || !activeSession) return;
        const idx = sessions.findIndex((s) => s.id === activeSession.id);
        const next = sessions[(idx + 1) % sessions.length];
        setActiveSession(next.id);
        return;
      }

      // Cmd+[ — previous session
      if (mod && e.key === "[") {
        e.preventDefault();
        if (sessions.length < 2 || !activeSession) return;
        const idx = sessions.findIndex((s) => s.id === activeSession.id);
        const prev = sessions[(idx - 1 + sessions.length) % sessions.length];
        setActiveSession(prev.id);
      }
    },
    [sessions, activeSession],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-screen w-screen bg-[#0f0f0f] overflow-hidden flex flex-col">
      <div
        data-tauri-drag-region
        className="h-8 shrink-0 flex items-center px-4 gap-2"
      >
        <span className="text-[11px] text-[#555555] ml-[70px]">Termaude</span>
        <div className="flex-1" />
        <div className="flex gap-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => setActiveSession(session.id)}
              className={`text-[11px] px-2 py-0.5 rounded transition-colors ${
                activeSession?.id === session.id
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
              addSession(name, "~");
            }}
            className="text-[11px] px-2 py-0.5 text-[#555555] hover:text-[#888888] transition-colors"
          >
            +
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="absolute inset-0"
            style={{
              display: activeSession?.id === session.id ? "block" : "none",
            }}
          >
            <Terminal
              sessionId={session.id}
              cwd={session.cwd}
              visible={activeSession?.id === session.id}
            />
          </div>
        ))}
      </div>
      <QuickSwitch
        open={quickSwitchOpen}
        onClose={() => setQuickSwitchOpen(false)}
      />
    </div>
  );
}
