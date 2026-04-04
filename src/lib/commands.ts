import type { Session } from "../store/sessions";

export function buildCommand(
  session: Session,
  isResume: boolean,
): string | undefined {
  if (session.type === "shell") {
    return undefined; // default shell
  }

  // Claude Code session
  if (isResume && session.claudeSessionId) {
    return `claude --resume ${session.claudeSessionId}`;
  }

  const parts = ["claude"];
  if (session.claudeSessionId) {
    parts.push(`--session-id ${session.claudeSessionId}`);
  }
  if (session.name) {
    parts.push(`-n "${session.name}"`);
  }
  return parts.join(" ");
}
