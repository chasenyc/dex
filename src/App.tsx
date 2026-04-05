import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Board } from "./components/Board";
import { QuickSwitch } from "./components/QuickSwitch";
import { Terminal } from "./components/Terminal";
import { buildCommand } from "./lib/commands";
import {
  addSession,
  loadRegistry,
  renameSession,
  resumeSession,
  setActiveSession,
  startHookListener,
  updateSessionStatus,
  useActiveSession,
  useRegistryLoaded,
  useSessions,
} from "./store/sessions";

type View = "board" | "focus";

interface GitInfo {
  branch: string;
  additions: number;
  deletions: number;
}

export function App() {
  const sessions = useSessions();
  const activeSession = useActiveSession();
  const loaded = useRegistryLoaded();
  const [view, setView] = useState<View>("board");
  const [quickSwitchOpen, setQuickSwitchOpen] = useState(false);
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null);
  const [titleRenaming, setTitleRenaming] = useState(false);
  const [titleRenameValue, setTitleRenameValue] = useState("");
  const titleRenameRef = useRef<HTMLInputElement>(null);

  // Load persisted sessions on startup
  useEffect(() => {
    loadRegistry();
  }, []);

  // Start hook state listener once
  useEffect(() => {
    startHookListener();
  }, []);

  // Fetch git info for active session, refresh on cwd change and every 10s
  useEffect(() => {
    if (!activeSession || view !== "focus") {
      setGitInfo(null);
      return;
    }

    function fetchGit() {
      if (!activeSession) return;
      invoke<GitInfo | null>("get_git_info", { cwd: activeSession.cwd }).then(
        (info) => setGitInfo(info ?? null),
      );
    }

    fetchGit();
    const interval = setInterval(fetchGit, 10000);
    return () => clearInterval(interval);
  }, [activeSession, view]);

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

      // Cmd+W — kill active terminal, go back to board
      if (mod && e.key === "w" && view === "focus" && activeSession) {
        e.preventDefault();
        updateSessionStatus(activeSession.id, "closed");
        setView("board");
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
    [sessions, activeSession, openSession, view],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const runningSessions = sessions.filter(
    (s) =>
      s.status === "running" ||
      s.status === "idle" ||
      s.status === "permission" ||
      // Keep closed/exited terminals mounted if they're the active session in focus view
      // so the user can read exit messages (e.g. "session not found")
      (s.id === activeSession?.id && view === "focus"),
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
        {/* Board view: show app name. Focus view: show session info */}
        {view === "board" ? (
          <span className="text-[11px] text-[#444444] ml-[70px] select-none">
            Termaude
          </span>
        ) : null}
        {view === "focus" && activeSession && (
          <div className="text-[11px] text-[#555555] select-none flex items-center gap-1.5 ml-[70px]">
            {titleRenaming ? (
              <input
                ref={titleRenameRef}
                type="text"
                value={titleRenameValue}
                onChange={(e) => setTitleRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const trimmed = titleRenameValue.trim();
                    if (trimmed && activeSession) {
                      renameSession(activeSession.id, trimmed);
                    }
                    setTitleRenaming(false);
                  }
                  if (e.key === "Escape") setTitleRenaming(false);
                }}
                onBlur={() => {
                  const trimmed = titleRenameValue.trim();
                  if (trimmed && activeSession) {
                    renameSession(activeSession.id, trimmed);
                  }
                  setTitleRenaming(false);
                }}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="text-[11px] text-[#e8e8e8] bg-transparent outline-none border-b border-[#7c6aef]/40 max-w-[150px]"
              />
            ) : (
              <button
                type="button"
                className="text-[#666666] truncate max-w-[150px] bg-transparent border-none p-0 text-left text-[11px] cursor-text hover:text-[#888888] transition-colors duration-100"
                onDoubleClick={() => {
                  if (activeSession) {
                    setTitleRenameValue(activeSession.name);
                    setTitleRenaming(true);
                    requestAnimationFrame(() =>
                      titleRenameRef.current?.select(),
                    );
                  }
                }}
              >
                {activeSession.name}
              </button>
            )}
            <span className="text-[#333333] shrink-0">·</span>
            <span className="shrink-0">{activeSession.column}</span>
            {gitInfo && (
              <>
                <span className="text-[#333333] shrink-0">·</span>
                <span className="text-[#555555] shrink-0">
                  {gitInfo.branch}
                </span>
                {(gitInfo.additions > 0 || gitInfo.deletions > 0) && (
                  <span className="shrink-0">
                    {gitInfo.additions > 0 && (
                      <span className="text-[#22c55e]">
                        +{gitInfo.additions}
                      </span>
                    )}
                    {gitInfo.additions > 0 && gitInfo.deletions > 0 && " "}
                    {gitInfo.deletions > 0 && (
                      <span className="text-[#ef4444]">
                        -{gitInfo.deletions}
                      </span>
                    )}
                  </span>
                )}
              </>
            )}
          </div>
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
            .filter(
              (s) =>
                s.status === "running" ||
                s.status === "idle" ||
                s.status === "permission",
            )
            .map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => openSession(session.id)}
                className={`text-[11px] px-2.5 py-1 rounded-md transition-colors duration-100 max-w-[120px] truncate ${
                  activeSession?.id === session.id && view === "focus"
                    ? "bg-[#252525] text-[#e8e8e8]"
                    : "text-[#555555] hover:text-[#888888] hover:bg-white/[0.03]"
                }`}
                title={session.name}
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
