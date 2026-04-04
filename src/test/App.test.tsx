import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock Tauri APIs since they're not available in test environment
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Mock xterm.js since it needs a real DOM canvas
vi.mock("@xterm/xterm", () => {
  class MockTerminal {
    loadAddon = vi.fn();
    open = vi.fn();
    onData = vi.fn().mockReturnValue({ dispose: vi.fn() });
    onResize = vi.fn().mockReturnValue({ dispose: vi.fn() });
    writeln = vi.fn();
    write = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();
    cols = 80;
    rows = 24;
  }
  return { Terminal: MockTerminal };
});

vi.mock("@xterm/addon-clipboard", () => {
  class MockClipboardAddon {}
  return { ClipboardAddon: MockClipboardAddon };
});

vi.mock("@xterm/addon-fit", () => {
  class MockFitAddon {
    fit = vi.fn();
  }
  return { FitAddon: MockFitAddon };
});

import { App } from "../App";

describe("App", () => {
  it("renders without crashing", () => {
    const { container } = render(<App />);
    expect(container.querySelector("div")).toBeTruthy();
  });
});
