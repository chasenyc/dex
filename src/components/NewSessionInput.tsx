import { useRef, useState } from "react";
import { useInferCwd } from "../hooks/useInferCwd";
import { addSession, type SessionType } from "../store/sessions";

interface NewSessionInputProps {
  column: string;
  onCreated?: (sessionId: string) => void;
}

function parseInput(raw: string): { name: string; type: SessionType } {
  const trimmed = raw.trim();

  if (trimmed.startsWith("!")) {
    const name = trimmed.slice(1).trim() || "shell";
    return { name, type: "shell" };
  }

  return { name: trimmed || "untitled", type: "claude" };
}

export function NewSessionInput({ column, onCreated }: NewSessionInputProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inferred = useInferCwd(value, column);

  function handleSubmit() {
    if (!value.trim()) {
      setEditing(false);
      return;
    }

    const { name, type } = parseInput(value);
    const session = addSession({ name, cwd: inferred.cwd, column, type });
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
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
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
        placeholder="session name..."
        className="w-full bg-[#1c1c1c] text-[12px] text-[#e8e8e8] rounded-t px-2 py-1.5 outline-none border border-[#7c6aef]/30 focus:border-[#7c6aef]/60 border-b-0 placeholder:text-[#333333]"
      />
      {value.trim() && (
        <div className="bg-[#1c1c1c] rounded-b px-2 py-1 border border-t-0 border-[#7c6aef]/30 text-[11px] font-mono truncate">
          <span
            className={
              inferred.confidence === "high"
                ? "text-[#666666]"
                : inferred.confidence === "low"
                  ? "text-[#444444]"
                  : "text-[#333333]"
            }
          >
            {inferred.cwd}
            {inferred.confidence === "low" ? " ?" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
