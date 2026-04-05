import { invoke } from "@tauri-apps/api/core";
import { useRef, useState } from "react";
import { useInferCwd } from "../hooks/useInferCwd";
import { addSession, type SessionType } from "../store/sessions";
import { DirectoryPicker } from "./DirectoryPicker";

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inferred = useInferCwd(value, column);

  async function createSession(cwd: string) {
    if (!value.trim()) return;
    // Validate directory exists, fall back to ~ if not
    let validCwd = cwd;
    if (cwd !== "~") {
      const exists = await invoke<boolean>("check_directory_exists", {
        path: cwd,
      });
      if (!exists) {
        validCwd = "~";
      }
    }
    const { name, type } = parseInput(value);
    const session = addSession({ name, cwd: validCwd, column, type });
    setValue("");
    setEditing(false);
    setPickerOpen(false);
    onCreated?.(session.id);
  }

  function handleSubmit() {
    if (!value.trim()) {
      setEditing(false);
      setPickerOpen(false);
      return;
    }
    createSession(inferred.cwd);
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
      {/* Name input */}
      {!pickerOpen ? (
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
            if (e.key === "Tab" && value.trim()) {
              e.preventDefault();
              setPickerOpen(true);
            }
            if (e.key === "Escape") {
              setValue("");
              setEditing(false);
            }
          }}
          onBlur={(e) => {
            // Don't blur-submit if we're clicking into the picker
            if (e.relatedTarget?.closest("[data-directory-picker]")) return;
            handleSubmit();
          }}
          placeholder="session name..."
          className={`w-full bg-[#1c1c1c] text-[12px] text-[#e8e8e8] px-2 py-1.5 outline-none border border-[#7c6aef]/30 focus:border-[#7c6aef]/60 placeholder:text-[#333333] ${
            value.trim() ? "rounded-t border-b-0" : "rounded"
          }`}
        />
      ) : (
        <div className="bg-[#1c1c1c] rounded-t px-2 py-1.5 border border-b-0 border-[#7c6aef]/30">
          <span className="text-[13px] font-medium text-[#e8e8e8]">
            {value}
          </span>
        </div>
      )}

      {/* Ghost text (when picker is closed and there's input) */}
      {!pickerOpen && value.trim() && (
        <div className="bg-[#1c1c1c] rounded-b px-2 py-1 border border-t-0 border-[#7c6aef]/30">
          <span
            className={`text-[11px] font-mono truncate block ${
              inferred.confidence === "high"
                ? "text-[#666666]"
                : inferred.confidence === "low"
                  ? "text-[#444444]"
                  : "text-[#333333]"
            }`}
          >
            {inferred.cwd}
            {inferred.confidence === "low" ? " ?" : ""}
            <span className="text-[#333333] ml-2">Tab to change</span>
          </span>
        </div>
      )}

      {/* Directory picker (when Tab was pressed) */}
      {pickerOpen && (
        <div data-directory-picker>
          <DirectoryPicker
            inferredCwd={inferred.cwd}
            onSelect={(cwd) => createSession(cwd)}
            onBack={() => {
              setPickerOpen(false);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          />
        </div>
      )}
    </div>
  );
}
