import { useRef, useState } from "react";
import { addSession, type SessionType } from "../store/sessions";

interface NewSessionInputProps {
  column: string;
  onCreated?: (sessionId: string) => void;
}

interface ParsedInput {
  name: string;
  cwd: string;
  type: SessionType;
}

function parseInput(raw: string): ParsedInput {
  const trimmed = raw.trim();

  // ! prefix → raw shell
  if (trimmed.startsWith("!")) {
    const rest = trimmed.slice(1).trim();
    return parseNameAndCwd(rest, "shell", "shell");
  }

  // Default → Claude Code
  return parseNameAndCwd(trimmed, "claude", "untitled");
}

function parseNameAndCwd(
  input: string,
  type: SessionType,
  defaultName: string,
): ParsedInput {
  if (!input) {
    return { name: defaultName, cwd: "~", type };
  }

  // Check if the entire input is a path
  if (input.startsWith("~/") || input.startsWith("/")) {
    const name = input.split("/").filter(Boolean).pop() ?? defaultName;
    return { name, cwd: input, type };
  }

  // Check for "name /path" or "name ~/path" pattern
  const spacePathMatch = input.match(/^(\S+)\s+(~?\/.*)$/);
  if (spacePathMatch) {
    return { name: spacePathMatch[1], cwd: spacePathMatch[2], type };
  }

  // Just a name
  return { name: input, cwd: "~", type };
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

    const { name, cwd, type } = parseInput(value);
    const session = addSession({ name, cwd, column, type });
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
        placeholder="name [~/path] or ! for shell..."
        className="w-full bg-[#1c1c1c] text-[12px] text-[#e8e8e8] rounded px-2 py-1.5 outline-none border border-[#7c6aef]/30 focus:border-[#7c6aef]/60 placeholder:text-[#333333]"
      />
    </div>
  );
}
