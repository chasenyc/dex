import { useRef, useState } from "react";
import { addSession } from "../store/sessions";

interface NewSessionInputProps {
  column: string;
  onCreated?: (sessionId: string) => void;
}

function parseInput(raw: string): { name: string; command?: string } {
  const trimmed = raw.trim();

  // #c prefix → Claude Code session
  if (trimmed.startsWith("#c")) {
    const rest = trimmed.slice(2).trim();
    if (rest) {
      return { name: rest, command: `claude -n "${rest}"` };
    }
    return { name: "claude", command: "claude" };
  }

  return { name: trimmed || "untitled" };
}

export function NewSessionInput({ column, onCreated }: NewSessionInputProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    if (!value.trim()) {
      setEditing(false);
      return;
    }

    const { name, command } = parseInput(value);
    const session = addSession(name, "~", column, command);
    setValue("");
    setEditing(false);
    onCreated?.(session.id);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setEditing(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="text-[11px] text-[#333333] hover:text-[#555555] py-2 transition-colors w-full text-left px-1"
      >
        + New Session
      </button>
    );
  }

  return (
    <div className="px-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === "Escape") {
            setValue("");
            setEditing(false);
          }
        }}
        onBlur={handleSubmit}
        placeholder="session name or #c for claude..."
        className="w-full bg-[#1c1c1c] text-[12px] text-[#e8e8e8] rounded px-2 py-1.5 outline-none border border-[#7c6aef]/30 focus:border-[#7c6aef]/60 placeholder:text-[#333333]"
      />
    </div>
  );
}
