import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as XTerm } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import { updatePreviewLines, updateSessionStatus } from "../store/sessions";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  sessionId: string;
  cwd?: string;
  command?: string;
  visible: boolean;
  onExit?: () => void;
}

export function Terminal({
  sessionId,
  cwd,
  command,
  visible,
  onExit,
}: TerminalProps) {
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

    let previewTimer: ReturnType<typeof setTimeout> | null = null;
    function extractPreview() {
      if (previewTimer) clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        const buf = term.buffer.active;
        const lines: string[] = [];
        // Walk from the bottom up to find the last 3 non-empty lines
        for (let i = buf.cursorY + buf.baseY; i >= 0 && lines.length < 3; i--) {
          const line = buf.getLine(i)?.translateToString(true)?.trim();
          if (line) lines.unshift(line);
        }
        updatePreviewLines(sessionId, lines);
      }, 200);
    }

    const outputUnlisten = listen<number[]>(`pty-output-${ptyId}`, (event) => {
      term.write(new Uint8Array(event.payload));
      updateSessionStatus(sessionId, "running");
      extractPreview();
    });

    const exitUnlisten = listen(`pty-exit-${ptyId}`, () => {
      if (previewTimer) clearTimeout(previewTimer);
      updateSessionStatus(sessionId, "closed");
      onExit?.();
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
      // Only fit if our container is visible (has dimensions)
      const el = containerRef.current;
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        fitAddon.fit();
      }
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      if (previewTimer) clearTimeout(previewTimer);
      window.removeEventListener("resize", handleWindowResize);
      onDataDisposable.dispose();
      onResizeDisposable.dispose();
      outputUnlisten.then((unlisten) => unlisten());
      exitUnlisten.then((unlisten) => unlisten());
      invoke("close_session", { id: ptyId }).catch(() => {});
      term.dispose();
    };
  }, [sessionId, cwd, command, onExit]);

  // Re-fit when visibility changes
  useEffect(() => {
    if (visible && fitAddonRef.current) {
      // Delay to let the DOM layout settle after display:none → block
      const timer = setTimeout(() => {
        const el = containerRef.current;
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
          fitAddonRef.current?.fit();
        }
      }, 30);
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
