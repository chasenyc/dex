import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { type Session, setActiveSession, useSessions } from "../store/sessions";

interface QuickSwitchProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_ICONS: Record<string, string> = {
  running: "●",
  idle: "●",
  permission: "●",
  closed: "○",
  exited: "○",
  error: "●",
};

const STATUS_COLORS: Record<string, string> = {
  running: "text-[#22c55e]",
  idle: "text-[#e8e8e8]",
  permission: "text-[#f59e0b]",
  closed: "text-[#444444]",
  exited: "text-[#444444]",
  error: "text-[#ef4444]",
};

interface Command {
  id: string;
  name: string;
  description: string;
  action: () => Promise<void>;
}

function matchesQuery(session: Session, query: string): boolean {
  const q = query.toLowerCase();
  return (
    session.name.toLowerCase().includes(q) ||
    session.cwd.toLowerCase().includes(q) ||
    session.column.toLowerCase().includes(q)
  );
}

function matchesCommand(cmd: Command, query: string): boolean {
  const q = query.toLowerCase();
  return (
    cmd.name.toLowerCase().includes(q) ||
    cmd.description.toLowerCase().includes(q)
  );
}

export function QuickSwitch({ open, onClose }: QuickSwitchProps) {
  const sessions = useSessions();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [folderPrompt, setFolderPrompt] = useState(false);
  const [folderValue, setFolderValue] = useState("");
  const [currentDefaultFolder, setCurrentDefaultFolder] = useState<
    string | null
  >(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const isCommandMode = query.startsWith(">");
  const commandQuery = isCommandMode ? query.slice(1).trim() : "";

  const commands: Command[] = [
    {
      id: "install-hooks",
      name: "Install Claude Hooks",
      description: "Set up real-time session state tracking",
      action: async () => {
        const result = await invoke<string>("install_hooks");
        setFeedback(result);
        setTimeout(() => {
          setFeedback(null);
          onClose();
        }, 2000);
      },
    },
    {
      id: "uninstall-hooks",
      name: "Uninstall Claude Hooks",
      description: "Remove Termaude hooks from Claude",
      action: async () => {
        const result = await invoke<string>("uninstall_hooks");
        setFeedback(result);
        setTimeout(() => {
          setFeedback(null);
          onClose();
        }, 2000);
      },
    },
    {
      id: "rescan-projects",
      name: "Rescan Projects",
      description: "Refresh the project directory index",
      action: async () => {
        await invoke("scan_projects");
        setFeedback("Projects rescanned.");
        setTimeout(() => {
          setFeedback(null);
          onClose();
        }, 1500);
      },
    },
    {
      id: "set-default-folder",
      name: "Set Default Folder",
      description: `${currentDefaultFolder ? `Current: ${currentDefaultFolder}` : "Default: ~"} — new sessions start here`,
      action: async () => {
        setFolderPrompt(true);
        setFolderValue(currentDefaultFolder ?? "~/");
        requestAnimationFrame(() => folderRef.current?.select());
      },
    },
  ];

  const filteredSessions = isCommandMode
    ? []
    : query
      ? sessions.filter((s) => matchesQuery(s, query))
      : sessions;

  const filteredCommands = isCommandMode
    ? commandQuery
      ? commands.filter((c) => matchesCommand(c, commandQuery))
      : commands
    : [];

  const totalItems = isCommandMode
    ? filteredCommands.length
    : filteredSessions.length;

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setFeedback(null);
      setFolderPrompt(false);
      requestAnimationFrame(() => inputRef.current?.focus());
      // Load current default folder
      invoke<string | null>("get_default_folder").then((f) =>
        setCurrentDefaultFolder(f),
      );
    }
  }, [open]);

  useEffect(() => {
    if (selectedIndex >= totalItems) {
      setSelectedIndex(Math.max(0, totalItems - 1));
    }
  }, [totalItems, selectedIndex]);

  function selectSession(session: Session) {
    setActiveSession(session.id);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (feedback) return; // Ignore keys while showing feedback

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (isCommandMode && filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        } else if (!isCommandMode && filteredSessions[selectedIndex]) {
          selectSession(filteredSessions[selectedIndex]);
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] animate-fadeIn">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        onKeyDown={() => {}}
        role="presentation"
      />
      <div
        className="relative w-[480px] bg-[#1c1c1c] rounded-xl shadow-2xl shadow-black/60 overflow-hidden border border-white/[0.04]"
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
              setFeedback(null);
            }}
            placeholder={
              isCommandMode
                ? "Type a command..."
                : "Switch session or > for commands..."
            }
            className="flex-1 bg-transparent text-[14px] text-[#e8e8e8] outline-none placeholder:text-[#555555]"
          />
        </div>

        {folderPrompt ? (
          <div className="px-4 py-3">
            <div className="text-[11px] text-[#555555] mb-2">
              Enter default start folder:
            </div>
            <input
              ref={folderRef}
              type="text"
              value={folderValue}
              onChange={(e) => setFolderValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const trimmed = folderValue.trim();
                  if (trimmed) {
                    invoke("set_default_folder", { folder: trimmed });
                    setCurrentDefaultFolder(trimmed);
                    setFeedback(`Default folder set to ${trimmed}`);
                    setFolderPrompt(false);
                    setTimeout(() => {
                      setFeedback(null);
                      onClose();
                    }, 1500);
                  }
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setFolderPrompt(false);
                }
              }}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full bg-[#252525] text-[13px] text-[#e8e8e8] rounded px-3 py-2 outline-none border border-[#7c6aef]/30 focus:border-[#7c6aef]/60 placeholder:text-[#555555] font-mono"
              placeholder="~/projects"
            />
          </div>
        ) : feedback ? (
          <div className="px-4 py-3 text-[13px] text-[#34d399]">{feedback}</div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto py-1">
            {isCommandMode ? (
              filteredCommands.length === 0 ? (
                <div className="px-4 py-3 text-[13px] text-[#555555]">
                  No commands found
                </div>
              ) : (
                filteredCommands.map((cmd, index) => (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => cmd.action()}
                    className={`w-full text-left px-4 py-2 transition-colors duration-100 ${
                      index === selectedIndex
                        ? "bg-[#252525]"
                        : "hover:bg-[#1f1f1f]"
                    }`}
                  >
                    <div className="text-[13px] text-[#e8e8e8]">{cmd.name}</div>
                    <div className="text-[11px] text-[#555555]">
                      {cmd.description}
                    </div>
                  </button>
                ))
              )
            ) : filteredSessions.length === 0 ? (
              <div className="px-4 py-3 text-[13px] text-[#555555]">
                No sessions found
              </div>
            ) : (
              filteredSessions.map((session, index) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => selectSession(session)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors duration-100 ${
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
        )}
      </div>
    </div>
  );
}
