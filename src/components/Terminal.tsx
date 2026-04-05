import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as XTerm } from "@xterm/xterm";
import { useEffect, useRef } from "react";
import { updateSessionCwd, updateSessionStatus } from "../store/sessions";
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

  // Store initial values and callbacks in refs so the main useEffect only depends
  // on sessionId. Without this, every CWD update from the OSC 7 hook would flow
  // back through the parent as a new `cwd` prop, re-triggering the effect and
  // destroying + recreating the entire terminal (the "screen clear" bug).
  const initialCwdRef = useRef(cwd);
  const initialCommandRef = useRef(command);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

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

    // Capture CWD from shell chpwd hook via OSC 7
    // Format: file://termaude-<session-id>/absolute/path
    const oscDisposable = term.parser.registerOscHandler(7, (data) => {
      const prefix = `file://termaude-${sessionId}`;
      if (data.startsWith(prefix)) {
        const pwd = data.slice(prefix.length);
        if (pwd) {
          updateSessionCwd(
            sessionId,
            decodeURIComponent(pwd).replace(/^\/Users\/[^/]+/, "~"),
          );
        }
      }
      return false;
    });

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const ptyId = `${sessionId}-${Date.now()}`;
    ptyIdRef.current = ptyId;

    invoke("create_session", {
      id: ptyId,
      cwd: initialCwdRef.current,
      command: initialCommandRef.current,
      sessionId,
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
      updateSessionStatus(sessionId, "closed");
      onExitRef.current?.();
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
      window.removeEventListener("resize", handleWindowResize);
      oscDisposable.dispose();
      onDataDisposable.dispose();
      onResizeDisposable.dispose();
      outputUnlisten.then((unlisten) => unlisten());
      exitUnlisten.then((unlisten) => unlisten());
      invoke("close_session", { id: ptyId }).catch(() => {});
      term.dispose();
    };
  }, [sessionId]);

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
