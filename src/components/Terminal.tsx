import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as XTerm } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import { updateSessionStatus } from "../store/sessions";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  sessionId: string;
  cwd?: string;
  command?: string;
  visible: boolean;
}

export function Terminal({ sessionId, cwd, command, visible }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);

  // Create terminal and PTY on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "'SF Mono', Menlo, Monaco, 'Cascadia Code', monospace",
      fontSize: 12,
      fontWeight: "400",
      fontWeightBold: "600",
      customGlyphs: true,
      lineHeight: 1,
      letterSpacing: 0,
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
    const clipboardAddon = new ClipboardAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(clipboardAddon);
    term.open(container);

    // WebGL renderer has fewer subpixel rounding artifacts
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // Falls back to canvas renderer if WebGL unavailable
    }

    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const ptyId = `${sessionId}-${Date.now()}`;
    ptyIdRef.current = ptyId;

    invoke("create_session", {
      id: ptyId,
      cwd,
      command,
      cols: term.cols,
      rows: term.rows,
    }).catch((err: unknown) => {
      term.writeln(`\r\nFailed to create session: ${String(err)}`);
      updateSessionStatus(sessionId, "error");
    });

    const outputUnlisten = listen<number[]>(`pty-output-${ptyId}`, (event) => {
      term.write(new Uint8Array(event.payload));
      updateSessionStatus(sessionId, "running");
    });

    const exitUnlisten = listen(`pty-exit-${ptyId}`, () => {
      term.writeln("\r\n[Process exited]");
      updateSessionStatus(sessionId, "exited");
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
  }, [sessionId, cwd, command]);

  // Re-fit when visibility changes
  useEffect(() => {
    if (visible && fitAddonRef.current) {
      // Small delay to let the DOM layout settle before fitting
      const timer = setTimeout(() => fitAddonRef.current?.fit(), 10);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Focus terminal when visible
  useEffect(() => {
    if (visible && termRef.current) {
      termRef.current.focus();
    }
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{
        padding: "4px",
        display: visible ? "block" : "none",
      }}
    />
  );
}
