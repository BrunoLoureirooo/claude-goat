// SessionStart hook: hands the orchestrator directions to main sessions as additional context.
// ORCHESTRATOR_BRIEF=off skips it; ORCHESTRATOR_BRIEF_FORCE=1 also runs it in headless (sdk)
// sessions; ORCHESTRATOR_BRIEF_FILE overrides the directions path. Any error → silent exit 0.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

try {
  // drain the hook input so the writer never sees a broken pipe; its content is not needed
  if (!process.stdin.isTTY) readFileSync(0);
} catch {}

try {
  const env = process.env;
  const headless = (env.CLAUDE_CODE_ENTRYPOINT || "").startsWith("sdk") && env.ORCHESTRATOR_BRIEF_FORCE !== "1";
  if (!headless && env.ORCHESTRATOR_BRIEF !== "off") {
    const file = env.ORCHESTRATOR_BRIEF_FILE || join(homedir(), ".claude", "guidelines", "orchestrator.md");
    const text = readFileSync(file, "utf8");
    if (text.trim()) {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text } }) + "\n");
    }
  }
} catch {}
