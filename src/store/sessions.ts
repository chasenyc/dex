import { useSyncExternalStore } from "react";

export type SessionStatus =
  | "running"
  | "idle"
  | "exited"
  | "error"
  | "disconnected";

export interface Session {
  id: string;
  name: string;
  cwd: string;
  column: string;
  command?: string;
  status: SessionStatus;
  createdAt: number;
  lastActivity: number;
}

interface SessionStore {
  sessions: Map<string, Session>;
  activeSessionId: string | null;
  columns: string[];
}

type Listener = () => void;

let store: SessionStore = {
  sessions: new Map(),
  activeSessionId: null,
  columns: ["Backlog", "Active", "Done"],
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

export function addSession(
  name: string,
  cwd: string,
  column?: string,
  command?: string,
): Session {
  const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const session: Session = {
    id,
    name,
    cwd,
    column: column ?? "Active",
    command,
    status: "running",
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  const next = new Map(store.sessions);
  next.set(id, session);
  store = { ...store, sessions: next, activeSessionId: id };
  emitChange();
  return session;
}

export function removeSession(id: string) {
  const next = new Map(store.sessions);
  next.delete(id);
  const activeSessionId =
    store.activeSessionId === id ? null : store.activeSessionId;
  store = { ...store, sessions: next, activeSessionId };
  emitChange();
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
}

export function updateSessionColumn(id: string, column: string) {
  const session = store.sessions.get(id);
  if (!session) return;
  const next = new Map(store.sessions);
  next.set(id, { ...session, column });
  store = { ...store, sessions: next };
  emitChange();
}

export function moveSession(id: string, toColumn: string, _toIndex?: number) {
  const session = store.sessions.get(id);
  if (!session) return;
  const next = new Map(store.sessions);
  next.set(id, { ...session, column: toColumn });
  store = { ...store, sessions: next };
  emitChange();
}

export function setColumns(columns: string[]) {
  store = { ...store, columns };
  emitChange();
}

export function useSessionStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return snapshot;
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
  return Array.from(sessions.values()).filter((s) => s.column === column);
}
