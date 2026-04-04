import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSessions, useSessionsByColumn } from "../store/sessions";

interface Project {
  name: string;
  path: string;
}

interface InferResult {
  cwd: string;
  confidence: "high" | "low" | "none";
}

let cachedProjects: Project[] | null = null;
let loadingProjects = false;

async function ensureProjects(): Promise<Project[]> {
  if (cachedProjects) return cachedProjects;
  if (loadingProjects) {
    // Wait for the in-flight load
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (cachedProjects) {
          clearInterval(check);
          resolve(cachedProjects);
        }
      }, 50);
    });
  }

  loadingProjects = true;
  try {
    const projects = await invoke<Project[]>("load_project_index");
    cachedProjects = projects;
    return projects;
  } catch {
    cachedProjects = [];
    return [];
  } finally {
    loadingProjects = false;
  }
}

// Trigger background scan on first import
void invoke("scan_projects").then((projects) => {
  if (Array.isArray(projects)) {
    cachedProjects = projects as Project[];
  }
});

export function useInferCwd(name: string, column: string): InferResult {
  const [projects, setProjects] = useState<Project[]>(cachedProjects ?? []);
  const columnSessions = useSessionsByColumn(column);
  const allSessions = useSessions();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      ensureProjects().then(setProjects);
    }
  }, []);

  return useMemo(() => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return { cwd: "~", confidence: "none" };

    // Signal 1: Project name match — full string or any word in the name
    const exactMatch = projects.find((p) => p.name.toLowerCase() === trimmed);
    if (exactMatch) {
      return { cwd: exactMatch.path, confidence: "high" };
    }

    const words = trimmed.split(/\s+/);
    if (words.length > 1) {
      for (const word of words) {
        const wordMatch = projects.find((p) => p.name.toLowerCase() === word);
        if (wordMatch) {
          return { cwd: wordMatch.path, confidence: "high" };
        }
      }
    }

    // Signal 2: Column consensus — if 2+ siblings share a cwd
    const cwdCounts = new Map<string, number>();
    for (const s of columnSessions) {
      cwdCounts.set(s.cwd, (cwdCounts.get(s.cwd) ?? 0) + 1);
    }
    for (const [cwd, count] of cwdCounts) {
      if (count >= 2 && cwd !== "~") {
        return { cwd, confidence: "high" };
      }
    }

    // Signal 3: Most recently used cwd (not ~)
    const recentSession = [...allSessions]
      .filter((s) => s.cwd !== "~")
      .sort((a, b) => b.lastActivity - a.lastActivity)[0];
    if (recentSession) {
      return { cwd: recentSession.cwd, confidence: "low" };
    }

    // Signal 4: Partial project name match
    const partialMatch = projects.find((p) =>
      p.name.toLowerCase().includes(trimmed),
    );
    if (partialMatch) {
      return { cwd: partialMatch.path, confidence: "low" };
    }

    return { cwd: "~", confidence: "none" };
  }, [name, projects, columnSessions, allSessions]);
}

export type { Project };
export { ensureProjects };
