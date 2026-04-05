import type { Session } from "../store/sessions";

export function buildCommand(
  session: Session,
  isResume: boolean,
): string | undefined {
  if (session.type === "shell") {
    return undefined; // default shell
  }

  // Build the Claude command
  let claudeCmd: string;
  if (isResume && session.claudeSessionId) {
    claudeCmd = `claude --resume ${session.claudeSessionId}`;
  } else {
    const parts = ["claude"];
    if (session.claudeSessionId) {
      parts.push(`--session-id ${session.claudeSessionId}`);
    }
    if (session.name) {
      parts.push(`-n "${session.name}"`);
    }
    claudeCmd = parts.join(" ");
  }

  // When Claude exits, drop into an interactive shell so the terminal stays alive
  return `${claudeCmd}; exec $SHELL -i`;
}
