import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as XTerm } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  sessionId: string;
  cwd?: string;
}

export function Terminal({ sessionId, cwd }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      theme: {
        background: "#0f0f0f",
        foreground: "#e8e8e8",
        cursor: "#7c6aef",
        selectionBackground: "rgba(124, 106, 239, 0.3)",
        black: "#1c1c1c",
        red: "#f87171",
        green: "#34d399",
        yellow: "#fbbf24",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#e8e8e8",
        brightBlack: "#555555",
        brightRed: "#fca5a5",
        brightGreen: "#6ee7b7",
        brightYellow: "#fcd34d",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#ffffff",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Unique ID per effect run so React StrictMode double-mount doesn't collide
    const ptyId = `${sessionId}-${Date.now()}`;
    const cols = term.cols;
    const rows = term.rows;

    invoke("create_session", { id: ptyId, cwd, cols, rows }).catch(
      (err: unknown) => {
        term.writeln(`\r\nFailed to create session: ${String(err)}`);
      },
    );

    const outputUnlisten = listen<number[]>(`pty-output-${ptyId}`, (event) => {
      term.write(new Uint8Array(event.payload));
    });

    const exitUnlisten = listen(`pty-exit-${ptyId}`, () => {
      term.writeln("\r\n[Process exited]");
    });

    const onDataDisposable = term.onData((data: string) => {
      const encoder = new TextEncoder();
      const bytes = Array.from(encoder.encode(data));
      invoke("write_to_session", { id: ptyId, data: bytes }).catch(() => {});
    });

    const onResizeDisposable = term.onResize(
      ({ cols, rows }: { cols: number; rows: number }) => {
        invoke("resize_session", { id: ptyId, cols, rows }).catch(() => {});
      },
    );

    const handleWindowResize = () => {
      fitAddon.fit();
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      onDataDisposable.dispose();
      onResizeDisposable.dispose();
      outputUnlisten.then((unlisten) => unlisten());
      exitUnlisten.then((unlisten) => unlisten());
      invoke("close_session", { id: ptyId }).catch(() => {});
      term.dispose();
    };
  }, [sessionId, cwd]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ padding: "4px" }}
    />
  );
}
