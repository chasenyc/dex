import { useEffect, useRef, useState } from "react";
import { ensureProjects, type Project } from "../hooks/useInferCwd";
import { useSessions } from "../store/sessions";

interface DirectoryPickerProps {
  inferredCwd: string;
  onSelect: (cwd: string) => void;
  onBack: () => void;
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  return lower.includes(q);
}

export function DirectoryPicker({
  inferredCwd,
  onSelect,
  onBack,
}: DirectoryPickerProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sessions = useSessions();

  useEffect(() => {
    ensureProjects().then(setProjects);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Build the list: inferred first, then recents, then all projects
  const recentCwds = [
    ...new Set(
      [...sessions]
        .filter((s) => s.cwd !== "~")
        .sort((a, b) => b.lastActivity - a.lastActivity)
        .map((s) => s.cwd),
    ),
  ].slice(0, 5);

  const allItems: {
    path: string;
    source: "inferred" | "recent" | "project";
  }[] = [];
  const seen = new Set<string>();

  // Add inferred cwd first
  if (inferredCwd !== "~") {
    allItems.push({ path: inferredCwd, source: "inferred" });
    seen.add(inferredCwd);
  }

  // Add recents
  for (const cwd of recentCwds) {
    if (!seen.has(cwd)) {
      allItems.push({ path: cwd, source: "recent" });
      seen.add(cwd);
    }
  }

  // Add all indexed projects
  for (const p of projects) {
    if (!seen.has(p.path)) {
      allItems.push({ path: p.path, source: "project" });
      seen.add(p.path);
    }
  }

  // Always add ~ at the end
  if (!seen.has("~")) {
    allItems.push({ path: "~", source: "project" });
  }

  const filtered = query
    ? allItems.filter((item) => fuzzyMatch(item.path, query))
    : allItems;

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

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
          onSelect(filtered[selectedIndex].path);
        }
        break;
      case "Escape":
        e.preventDefault();
        onBack();
        break;
      case "Backspace":
        if (query === "") {
          e.preventDefault();
          onBack();
        }
        break;
    }
  }

  return (
    <div className="bg-[#1c1c1c] rounded-b border border-t-0 border-[#7c6aef]/30 overflow-hidden animate-slideDown">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedIndex(0);
        }}
        onKeyDown={handleKeyDown}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="search directories..."
        className="w-full bg-transparent text-[11px] text-[#e8e8e8] px-2 py-1.5 outline-none placeholder:text-[#333333] border-b border-white/5"
      />
      <div ref={listRef} className="max-h-[180px] overflow-y-auto py-0.5">
        {filtered.length === 0 ? (
          <div className="px-2 py-1.5 text-[11px] text-[#333333]">
            No matches
          </div>
        ) : (
          filtered.slice(0, 20).map((item, index) => (
            <button
              key={item.path}
              type="button"
              onClick={() => onSelect(item.path)}
              className={`w-full text-left px-2 py-1 text-[11px] font-mono truncate transition-colors ${
                index === selectedIndex
                  ? "bg-[#252525] text-[#e8e8e8]"
                  : "text-[#666666] hover:bg-[#1f1f1f]"
              }`}
            >
              {item.path}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
