// SessionStart hook: hands the orchestrator directions to main sessions as additional context.
// ORCHESTRATOR_BRIEF=off skips it; ORCHESTRATOR_BRIEF_FORCE=1 also runs it in headless (sdk)
// sessions; ORCHESTRATOR_BRIEF_FILE overrides the directions path. Any error → silent exit 0.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text + localMode(file) } }) + "\n");
    }
  }
} catch {}

// local mode: probe the local LLM box (2s cap); when up, append the local-routing directions and the
// resolved tiers. Box down, script missing or LOCAL_LLM=off → "" (regular orchestrator mode).
function localMode(briefFile) {
  try {
    if (process.env.LOCAL_LLM === "off") return "";
    const probe = spawnSync("node", [join(homedir(), ".claude", "bin", "local-llm.mjs"), "--probe", "--timeout", "2"], { encoding: "utf8", timeout: 5000 });
    if (probe.status !== 0) return "";
    const { tiers, url } = JSON.parse(probe.stdout);
    const rules = readFileSync(join(briefFile, "..", "orchestrator-local.md"), "utf8");
    const line = Object.entries(tiers).map(([t, m]) => `${t}=${m ?? "none"}`).join(", ");
    return `\n\nLocal LLM probe: UP at ${url} — tiers: ${line}\n\n${rules}`;
  } catch {
    return "";
  }
}
