import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useSyncExternalStore } from "react";

export type SessionStatus =
  | "running"
  | "idle"
  | "exited"
  | "error"
  | "closed"
  | "permission";

export type SessionType = "claude" | "shell";

export interface Session {
  id: string;
  name: string;
  cwd: string;
  column: string;
  type: SessionType;
  claudeSessionId?: string;
  status: SessionStatus;
  previewLines?: string[];
  order: number;
  createdAt: number;
  lastActivity: number;
  generation: number;
}

interface SessionStore {
  sessions: Map<string, Session>;
  activeSessionId: string | null;
  columns: string[];
  loaded: boolean;
}

// Serializable format for disk
interface RegistryData {
  sessions: Session[];
  columns: string[];
}

type Listener = () => void;

let store: SessionStore = {
  sessions: new Map(),
  activeSessionId: null,
  columns: ["Backlog", "Active", "Done"],
  loaded: false,
};

const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SessionStore {
  return store;
}

// --- Persistence ---

function toRegistryData(): RegistryData {
  return {
    sessions: Array.from(store.sessions.values()),
    columns: store.columns,
  };
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const data = JSON.stringify(toRegistryData(), null, 2);
    invoke("save_registry", { data }).catch((err) => {
      console.error("Failed to save registry:", err);
    });
  }, 300);
}

export async function loadRegistry(): Promise<void> {
  try {
    const raw = await invoke<string>("load_registry");
    if (raw && raw !== "null") {
      const data: RegistryData = JSON.parse(raw);
      const sessions = new Map<string, Session>();
      for (const s of data.sessions) {
        // Mark any previously running sessions as closed on reload
        const status =
          s.status === "running" || s.status === "idle" ? "closed" : s.status;
        sessions.set(s.id, { ...s, status });
      }
      store = {
        sessions,
        activeSessionId: null,
        columns: data.columns ?? ["Backlog", "Active", "Done"],
        loaded: true,
      };
      emitChange();
    } else {
      store = { ...store, loaded: true };
      emitChange();
    }
  } catch (err) {
    console.error("Failed to load registry:", err);
    store = { ...store, loaded: true };
    emitChange();
  }
}

// --- Actions ---

export function addSession(opts: {
  name: string;
  cwd: string;
  column?: string;
  type?: SessionType;
}): Session {
  const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const sessionType = opts.type ?? "claude";
  // Place new session at the end of its column
  const col = opts.column ?? "Active";
  const maxOrder = Math.max(
    0,
    ...Array.from(store.sessions.values())
      .filter((s) => s.column === col)
      .map((s) => s.order ?? 0),
  );
  const session: Session = {
    id,
    name: opts.name,
    cwd: opts.cwd,
    column: col,
    type: sessionType,
    claudeSessionId: sessionType === "claude" ? crypto.randomUUID() : undefined,
    status: "running",
    order: maxOrder + 1,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    generation: 1,
  };

  const next = new Map(store.sessions);
  next.set(id, session);
  store = { ...store, sessions: next, activeSessionId: id };
  emitChange();
  scheduleSave();
  return session;
}

export function resumeSession(id: string) {
  const session = store.sessions.get(id);
  if (!session) return;
  const next = new Map(store.sessions);
  next.set(id, {
    ...session,
    status: "running",
    generation: session.generation + 1,
    lastActivity: Date.now(),
  });
  store = { ...store, sessions: next, activeSessionId: id };
  emitChange();
  scheduleSave();
}

export function updatePreviewLines(id: string, lines: string[]) {
  const session = store.sessions.get(id);
  if (!session) return;
  const next = new Map(store.sessions);
  next.set(id, { ...session, previewLines: lines });
  store = { ...store, sessions: next };
  emitChange();
  // Don't save preview lines to disk — they're ephemeral
}

export function removeSession(id: string) {
  const next = new Map(store.sessions);
  next.delete(id);
  const activeSessionId =
    store.activeSessionId === id ? null : store.activeSessionId;
  store = { ...store, sessions: next, activeSessionId };
  emitChange();
  scheduleSave();
}

export function setActiveSession(id: string | null) {
  if (store.activeSessionId === id) return;
  store = { ...store, activeSessionId: id };
  emitChange();
}

export function updateSessionStatus(id: string, status: SessionStatus) {
  const session = store.sessions.get(id);
  if (!session) return;
  const next = new Map(store.sessions);
  next.set(id, { ...session, status, lastActivity: Date.now() });
  store = { ...store, sessions: next };
  emitChange();
  scheduleSave();
}

export function renameSession(id: string, name: string) {
  const session = store.sessions.get(id);
  if (!session || session.name === name) return;
  const next = new Map(store.sessions);
  next.set(id, { ...session, name });
  store = { ...store, sessions: next };
  emitChange();
  scheduleSave();
}

export function updateSessionCwd(id: string, cwd: string) {
  const session = store.sessions.get(id);
  if (!session || session.cwd === cwd) return;
  const next = new Map(store.sessions);
  next.set(id, { ...session, cwd });
  store = { ...store, sessions: next };
  emitChange();
  scheduleSave();
}

export function updateSessionColumn(id: string, column: string) {
  const session = store.sessions.get(id);
  if (!session) return;
  const next = new Map(store.sessions);
  next.set(id, { ...session, column });
  store = { ...store, sessions: next };
  emitChange();
  scheduleSave();
}

export function moveSession(id: string, toColumn: string, newOrder?: number) {
  const session = store.sessions.get(id);
  if (!session) return;
  const next = new Map(store.sessions);
  const order =
    newOrder ??
    Math.max(
      0,
      ...Array.from(next.values())
        .filter((s) => s.column === toColumn)
        .map((s) => s.order ?? 0),
    ) + 1;
  next.set(id, { ...session, column: toColumn, order });
  store = { ...store, sessions: next };
  emitChange();
  scheduleSave();
}

export function reorderSessionsInColumn(column: string, orderedIds: string[]) {
  const next = new Map(store.sessions);
  for (let i = 0; i < orderedIds.length; i++) {
    const session = next.get(orderedIds[i]);
    if (session && session.column === column) {
      next.set(orderedIds[i], { ...session, order: i });
    }
  }
  store = { ...store, sessions: next };
  emitChange();
  scheduleSave();
}

export function setColumns(columns: string[]) {
  store = { ...store, columns };
  emitChange();
  scheduleSave();
}

export function addColumn(name: string) {
  if (store.columns.includes(name)) return;
  store = { ...store, columns: [...store.columns, name] };
  emitChange();
  scheduleSave();
}

export function removeColumn(name: string) {
  // Move sessions from deleted column to the first remaining column
  const remaining = store.columns.filter((c) => c !== name);
  if (remaining.length === 0) return; // Can't delete the last column
  const fallback = remaining[0];
  const next = new Map(store.sessions);
  for (const [id, session] of next) {
    if (session.column === name) {
      next.set(id, { ...session, column: fallback });
    }
  }
  store = { ...store, columns: remaining, sessions: next };
  emitChange();
  scheduleSave();
}

export function renameColumn(oldName: string, newName: string) {
  if (oldName === newName) return;
  if (store.columns.includes(newName)) return;
  const columns = store.columns.map((c) => (c === oldName ? newName : c));
  const next = new Map(store.sessions);
  for (const [id, session] of next) {
    if (session.column === oldName) {
      next.set(id, { ...session, column: newName });
    }
  }
  store = { ...store, columns, sessions: next };
  emitChange();
  scheduleSave();
}

// --- Hooks ---

export function useSessionStore() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useSessions(): Session[] {
  const { sessions } = useSessionStore();
  return Array.from(sessions.values());
}

export function useActiveSession(): Session | null {
  const { sessions, activeSessionId } = useSessionStore();
  if (!activeSessionId) return null;
  return sessions.get(activeSessionId) ?? null;
}

export function useColumns(): string[] {
  const { columns } = useSessionStore();
  return columns;
}

export function useSessionsByColumn(column: string): Session[] {
  const { sessions } = useSessionStore();
  return Array.from(sessions.values())
    .filter((s) => s.column === column)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function useRegistryLoaded(): boolean {
  const { loaded } = useSessionStore();
  return loaded;
}

// --- Hook State Listener ---

const STATUS_MAP: Record<string, SessionStatus> = {
  working: "running",
  waiting: "idle",
  permission: "permission",
  error: "error",
  ended: "closed",
};

export function startHookListener() {
  listen<{
    session_id: string;
    state: string;
    event: string;
    preview_lines: string[];
    cwd: string | null;
  }>("hook-state-update", (event) => {
    const { session_id, state, preview_lines, cwd } = event.payload;
    const { sessions } = store;

    // For ShellPwd events, match by Dex session ID (not claudeSessionId)
    if (cwd) {
      for (const session of sessions.values()) {
        if (session.id === session_id) {
          updateSessionCwd(session.id, cwd);
          break;
        }
      }
      return;
    }

    // For Claude hook events, match by claudeSessionId
    const status = STATUS_MAP[state];
    if (!status) return;

    for (const session of sessions.values()) {
      if (session.claudeSessionId === session_id) {
        updateSessionStatus(session.id, status);
        if (preview_lines && preview_lines.length > 0) {
          updatePreviewLines(session.id, preview_lines);
        }
        break;
      }
    }
  });
}
