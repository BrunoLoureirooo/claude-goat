// install.mjs — two independent jobs, runnable separately or together:
//   install → global CLAUDE.md, skills, agents, orchestrator directions + hook, plugins, MCPs,
//             settings.json patch → ~/.claude
//   init    → scaffolds CLAUDE.md + docs/ in the CURRENT directory, then launches Claude
//             Code to interview you and fill them in
//
// Flags: --install (install only), --init (init only), --no-claude (init: skip the
// interview launch), --no-plugins (install: skip plugin + MCP installs), --no-orchestrator
// (install: the worker agents only — no orchestrator agent, directions, hook or its settings),
// --no-repowise (skip the repowise CLI install and, in init, the index; the CI workflow and
// .gitignore lines are still written).
// Pass neither --install nor --init and:
//   - repo mode, run from the repo root            → install only
//   - repo mode, run from elsewhere                 → both
//   - packed (dist/claude-goat.mjs), interactive TTY → prompts you to choose
//   - packed, non-interactive (piped/scripted)       → both
//
// Anything that already exists — a skill folder, an agent, the directions, the hook, a scaffold
// file — is skipped, never overwritten. Exceptions: the global CLAUDE.md, which is backed up then
// refreshed, and settings.json, which is edited in place (only SETTINGS_PATCH keys and ENV_PATCH
// env vars are asserted; the orchestrator keys are only filled in when absent and its SessionStart
// hook entry only appended once — everything else the user has in there is left alone).
//
// `node build.mjs` packs this script + all payload files into dist/claude-goat.mjs, a single
// portable file that does the same thing anywhere without the repo.
import { homedir } from "node:os";
import { join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, readdir, access, copyFile, readFile, writeFile, chmod } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createInterface as _createInterface } from "node:readline";

// node:readline/promises requires Node 17+; wrap the callback API for compat
function createInterface(opts) {
  const rl = _createInterface(opts);
  const _question = rl.question.bind(rl);
  rl.question = (prompt) => new Promise((resolve) => _question(prompt, resolve));
  return rl;
}

const EMBEDDED = null; // ← build.mjs replaces this line with the packed payload

const here = dirname(fileURLToPath(import.meta.url));
const claudeDir = join(homedir(), ".claude");
const skillsDir = join(claudeDir, "skills");
const targetMd = join(claudeDir, "CLAUDE.md");
const project = process.cwd();
const noClaude = process.argv.includes("--no-claude");
const noPlugins = process.argv.includes("--no-plugins");
const noOrchestrator = process.argv.includes("--no-orchestrator");
const noRepowise = process.argv.includes("--no-repowise");
const flagInstall = process.argv.includes("--install");
const flagInit = process.argv.includes("--init");
const winShell = process.platform === "win32";

// plugins to install through the claude CLI: [plugin@marketplace, marketplace source repo]
const PLUGINS = [
  ["superpowers@claude-plugins-official", "anthropics/claude-plugins-official"],
  ["typescript-lsp@claude-plugins-official", "anthropics/claude-plugins-official"],
  ["security-guidance@claude-plugins-official", "anthropics/claude-plugins-official"],
];

// MCP servers to register through the claude CLI, user scope: [name, ...command]
const MCPS = [
  ["playwright", "npx", "@playwright/mcp@latest"],
  ["context7", "npx", "-y", "@upstash/context7-mcp"],
];

// top-level settings.json keys asserted on every run (merged in, not replaced wholesale)
const SETTINGS_PATCH = { model: "opus", effortLevel: "high" };
// per-model overrides merged into settings.json's "modelSettings" (every Claude 5.5 tier, same values)
const MODEL_IDS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
const MODEL_SETTINGS_PATCH = { effortLevel: "high", autoCompactWindow: 300000 };
// env vars merged into settings.json's "env" object, alongside whatever the user already has
const ENV_PATCH = { ENABLE_STOP_REVIEW: "0", CLAUDE_CODE_SUBAGENT_MODEL: "haiku" }; // haiku: subagents that name no model // security-guidance: skip the per-turn Stop review

// orchestrator mode: each key is set only when the user has none (never asserted over a choice)
const ORCHESTRATOR_SETTINGS = { agent: "orchestrator" };
const ORCHESTRATOR_ENV = { CLAUDE_CODE_FORK_SUBAGENT: "0" };
// [source, destination relative to ~/.claude] — installed unless --no-orchestrator
const ORCHESTRATOR_FILES = [
  ["agents/orchestrator.md", join("agents", "orchestrator.md")],
  ["guidelines/orchestrator.md", join("guidelines", "orchestrator.md")],
  ["hooks/orchestrator-brief.mjs", join("hooks", "orchestrator-brief.mjs")],
  ["guidelines/orchestrator-local.md", join("guidelines", "orchestrator-local.md")],
];
// the local-LLM relay script that agents/local-worker.md calls — installed always
const LOCAL_FILES = [
  ["bin/local-llm.mjs", join("bin", "local-llm.mjs")],
  ["bin/local-llm.json", "local-llm.json"], // tier → model map; edit to match what's pulled on the box
];
const briefHook = join(claudeDir, "hooks", "orchestrator-brief.mjs");
// forward slashes + double quotes work in cmd, PowerShell and Git Bash alike; POSIX gets single
// quotes so a $ or ` in the home path is never expanded
const BRIEF_COMMAND = winShell
  ? `node "${briefHook.split(sep).join("/")}"`
  : `node '${briefHook.replace(/'/g, "'\\''")}'`;

// packed mode: a flat { "skills/x/SKILL.md": "content", ... } map instead of the repo on disk
let files = null;
if (EMBEDDED) {
  const { gunzipSync } = await import("node:zlib");
  files = JSON.parse(gunzipSync(Buffer.from(EMBEDDED, "base64")).toString("utf8"));
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function readSource(rel) {
  return files ? files[rel] : readFile(join(here, rel), "utf8");
}

async function skillNames() {
  if (files) {
    return [...new Set(Object.keys(files).filter((p) => p.startsWith("skills/")).map((p) => p.split("/")[1]))];
  }
  const entries = await readdir(join(here, "skills"), { withFileTypes: true });
  return entries.filter((d) => d.isDirectory()).map((d) => d.name);
}

// files directly under a payload folder, e.g. agents/*.md
async function sourceFiles(dir) {
  if (files) {
    return Object.keys(files).filter((p) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes("/")).map((p) => p.slice(dir.length + 1));
  }
  const entries = await readdir(join(here, dir), { withFileTypes: true });
  return entries.filter((d) => d.isFile()).map((d) => d.name);
}

async function installFile(src, rel) {
  const dest = join(claudeDir, rel);
  if (await exists(dest)) {
    console.log(`⚠ ${rel} already installed — skipped`);
    return;
  }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, await readSource(src));
  console.log(`✓ ${rel}`);
}

async function copySkill(name, dest) {
  if (files) {
    const prefix = `skills/${name}/`;
    for (const [p, content] of Object.entries(files)) {
      if (!p.startsWith(prefix)) continue;
      const out = join(dest, p.slice(prefix.length));
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, content);
    }
  } else {
    await cp(join(here, "skills", name), dest, { recursive: true });
  }
}


// ── repowise: codebase index for agents (https://github.com/repowise-dev/repowise) ─────────────
const REPOWISE_IGNORES = [".repowise/", ".claude/CLAUDE.md", ".vscode/mcp.json", ".vscode/extensions.json", ".github/copilot-instructions.md"];

function hasCmd(cmd, args = ["--version"]) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: winShell });
  return !r.error && r.status === 0;
}

// installs the repowise CLI once (uv, else pipx); returns whether it is on PATH afterwards
function ensureRepowise() {
  if (hasCmd("repowise")) { console.log("⚠ repowise already installed — skipped"); return true; }
  for (const [tool, args] of [["uv", ["tool", "install", "repowise"]], ["pipx", ["install", "repowise"]]]) {
    if (!hasCmd(tool)) continue;
    console.log(`→ installing repowise via ${tool}…`);
    if (spawnSync(tool, args, { stdio: "inherit", shell: winShell }).status === 0 && hasCmd("repowise")) {
      console.log("✓ repowise");
      return true;
    }
  }
  console.log("⚠ repowise not installed — need uv or pipx on PATH (e.g. brew install uv), then: uv tool install repowise");
  return false;
}

// per-project: index with repowise (no model calls), keep it out of git, add the CI gates and the
// post-merge hook. Idempotent; every step skips what exists.
async function setupRepowise(project) {
  const git = (...a) => spawnSync("git", a, { cwd: project, encoding: "utf8", shell: winShell });
  const isRepo = git("rev-parse", "--git-dir").status === 0;
  const hasCommit = isRepo && git("rev-parse", "--verify", "HEAD").status === 0;

  // .gitignore: the index and the machine-specific editor files stay local
  const ignorePath = join(project, ".gitignore");
  const current = (await exists(ignorePath)) ? await readFile(ignorePath, "utf8") : "";
  const missing = REPOWISE_IGNORES.filter((l) => !current.split(/\r?\n/).includes(l));
  if (missing.length) {
    await writeFile(ignorePath, current + (current && !current.endsWith("\n") ? "\n" : "") + "# repowise (local index + generated editor files)\n" + missing.join("\n") + "\n");
    console.log(`✓ .gitignore → ${missing.join(", ")}`);
  }

  // CI gates
  const wf = join(".github", "workflows", "repowise.yml");
  if (await exists(join(project, wf))) {
    console.log(`⚠ ${wf} already exists — skipped`);
  } else {
    await mkdir(join(project, ".github", "workflows"), { recursive: true });
    await writeFile(join(project, wf), await readSource("templates/repowise.yml"));
    console.log(`✓ ${wf}`);
  }

  if (noRepowise || !isRepo) { if (!isRepo) console.log("⚠ not a git repo — repowise index skipped (git init + commit, then: repowise init --yes --no-prose --no-distill-hook)"); return; }
  if (!hasCmd("repowise")) { console.log("⚠ repowise CLI not on PATH — index skipped (install it, then: repowise init --yes --no-prose --no-distill-hook)"); return; }
  if (!hasCommit) { console.log("⚠ no commits yet — repowise index skipped; after the first commit run: repowise init --yes --no-prose --no-distill-hook"); return; }

  if (await exists(join(project, ".repowise", "state.json"))) {
    console.log("⚠ .repowise already initialized — skipped");
  } else {
    // --no-prose: no model calls, no key, code never leaves the machine; --no-distill-hook: don't
    // rewrite what the agent reads (skeleton reads, compacted command output)
    console.log("→ repowise init (graph, git, health, dead code; no model calls)…");
    const r = spawnSync("repowise", ["init", "--yes", "--no-prose", "--no-distill-hook"], { cwd: project, stdio: "inherit", shell: winShell });
    console.log(r.status === 0 ? "✓ .repowise" : "⚠ repowise init failed — run it by hand to see why");
  }

  // post-merge hook (post-commit is installed by repowise init); marker-delimited so it coexists
  const hookPath = join(project, ".git", "hooks", "post-merge");
  const marker = "repowise-merge-hook-start";
  const body = await readSource("templates/post-merge.sh");
  const existing = (await exists(hookPath)) ? await readFile(hookPath, "utf8") : "";
  if (existing.includes(marker)) {
    console.log("⚠ post-merge hook already installed — skipped");
  } else {
    await mkdir(dirname(hookPath), { recursive: true });
    await writeFile(hookPath, existing ? existing.replace(/\s*$/, "\n") + body.replace(/^#!.*\n/, "") : body);
    await chmod(hookPath, 0o755);
    console.log("✓ .git/hooks/post-merge");
  }
}

async function runInstall() {
  if (!files && !(await exists(join(here, "skills")))) {
    console.error("✗ can't find ./skills next to install.mjs — the repo is incomplete");
    process.exit(1);
  }

  console.log("── install: global setup ───────────────────────────────────────────────────");
  await mkdir(skillsDir, { recursive: true });

  if (await exists(targetMd)) {
    const backup = join(claudeDir, "CLAUDE_bak.md");
    await copyFile(targetMd, backup);
    console.log(`⚠ existing global CLAUDE.md — backed up to ${backup}`);
  }
  await writeFile(targetMd, await readSource("global/CLAUDE.md"));
  console.log(`✓ global CLAUDE.md → ${targetMd}`);

  const settingsPath = join(claudeDir, "settings.json");
  let settings = {};
  let settingsReadable = true;
  if (await exists(settingsPath)) {
    try {
      settings = JSON.parse(await readFile(settingsPath, "utf8"));
    } catch {
      settingsReadable = false;
      console.log(`⚠ ${settingsPath} isn't valid JSON — left untouched, fix it manually`);
    }
  }
  if (settingsReadable) {
    const modelSettings = { ...(settings.modelSettings ?? {}) };
    for (const id of MODEL_IDS) modelSettings[id] = { ...(modelSettings[id] ?? {}), ...MODEL_SETTINGS_PATCH };
    settings = { ...settings, ...SETTINGS_PATCH, modelSettings, env: { ...(settings.env ?? {}), ...ENV_PATCH } };
    const orchestratorNotes = noOrchestrator ? [] : mergeOrchestratorSettings(settings);
    await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    console.log(`✓ settings.json → model: ${SETTINGS_PATCH.model}, effortLevel: ${SETTINGS_PATCH.effortLevel}, autoCompactWindow: ${MODEL_SETTINGS_PATCH.autoCompactWindow} (all models), env.CLAUDE_CODE_SUBAGENT_MODEL=${ENV_PATCH.CLAUDE_CODE_SUBAGENT_MODEL}`);
    for (const note of orchestratorNotes) console.log(note);
  }

  for (const name of await skillNames()) {
    const dest = join(skillsDir, name);
    if (await exists(dest)) {
      console.log(`⚠ skill ${name} already installed — skipped`);
      continue;
    }
    await copySkill(name, dest);
    console.log(`✓ skill ${name}`);
  }

  for (const name of await sourceFiles("agents")) {
    if (name === "orchestrator.md") continue; // part of ORCHESTRATOR_FILES
    await installFile(`agents/${name}`, join("agents", name));
  }
  for (const [src, rel] of LOCAL_FILES) await installFile(src, rel);
  if (!noOrchestrator) {
    for (const [src, rel] of ORCHESTRATOR_FILES) await installFile(src, rel);
  }

  if (!noRepowise) ensureRepowise();

  // plugins (via the claude CLI; skipped if already installed)
  if (!noPlugins && PLUGINS.length > 0) {
    const installed = spawnSync("claude", ["plugin", "list"], { encoding: "utf8", shell: winShell });
    if (installed.error || installed.status !== 0) {
      console.log(`⚠ claude CLI not reachable — plugins skipped. Install manually: claude plugin install ${PLUGINS.map(([s]) => s).join(" ")}`);
    } else {
      const markets = spawnSync("claude", ["plugin", "marketplace", "list"], { encoding: "utf8", shell: winShell });
      for (const [spec, repo] of PLUGINS) {
        if (installed.stdout.includes(spec)) {
          console.log(`⚠ plugin ${spec} already installed — skipped`);
          continue;
        }
        // a marketplace must be registered before installing from it — first-run machines
        // that have never started claude interactively won't even have the official one
        const marketName = spec.split("@")[1];
        if (!markets.stdout?.includes(marketName)) {
          spawnSync("claude", ["plugin", "marketplace", "add", repo], { stdio: "inherit", shell: winShell });
        }
        const res = spawnSync("claude", ["plugin", "install", spec], { stdio: "inherit", shell: winShell });
        console.log(res.status === 0 ? `✓ plugin ${spec}` : `✗ plugin ${spec} failed — install manually with: claude plugin install ${spec}`);
      }
    }
  }

  // MCP servers (via the claude CLI; skipped if already registered)
  if (!noPlugins && MCPS.length > 0) {
    const registered = spawnSync("claude", ["mcp", "list"], { encoding: "utf8", shell: winShell });
    if (registered.error) {
      console.log(`⚠ claude CLI not reachable — MCP servers skipped. Register manually: claude mcp add --scope user ${MCPS.map(([n]) => n).join(", ")}`);
    } else {
      for (const [name, ...cmd] of MCPS) {
        if (registered.stdout?.includes(`${name}:`)) {
          console.log(`⚠ mcp ${name} already registered — skipped`);
          continue;
        }
        const res = spawnSync("claude", ["mcp", "add", "--scope", "user", name, "--", ...cmd], { stdio: "inherit", shell: winShell });
        console.log(res.status === 0 ? `✓ mcp ${name}` : `✗ mcp ${name} failed — register manually with: claude mcp add --scope user ${name} -- ${cmd.join(" ")}`);
      }
    }
  }
}

// fills the orchestrator keys into settings (mutated in place) only where the user has none;
// returns one report line per key
function mergeOrchestratorSettings(settings) {
  const notes = [];
  for (const [key, value] of Object.entries(ORCHESTRATOR_SETTINGS)) {
    if (key in settings) {
      notes.push(`⚠ settings.json ${key} already set (${JSON.stringify(settings[key])}) — left alone`);
    } else {
      settings[key] = value;
      notes.push(`✓ settings.json → ${key}: ${value}`);
    }
  }
  for (const [key, value] of Object.entries(ORCHESTRATOR_ENV)) {
    if (key in settings.env) {
      notes.push(`⚠ settings.json env.${key} already set — left alone`);
    } else {
      settings.env[key] = value;
      notes.push(`✓ settings.json → env.${key}=${value}`);
    }
  }
  if (settings.agent !== "orchestrator") {
    notes.push(`⚠ settings.json agent is set to ${JSON.stringify(settings.agent)}, not "orchestrator" — orchestrator hook not added`);
    return notes;
  }
  settings.hooks ??= {};
  if (typeof settings.hooks !== "object" || Array.isArray(settings.hooks)) {
    notes.push("⚠ settings.json hooks isn't an object — orchestrator hook not added, add it manually");
    return notes;
  }
  settings.hooks.SessionStart ??= [];
  const entries = settings.hooks.SessionStart;
  if (!Array.isArray(entries)) {
    notes.push("⚠ settings.json hooks.SessionStart isn't a list — orchestrator hook not added, add it manually");
  } else if (entries.some((e) => e?.hooks?.some?.((h) => h?.command === BRIEF_COMMAND))) {
    notes.push("⚠ settings.json SessionStart orchestrator hook already present — skipped");
  } else {
    entries.push({ matcher: "startup|resume|clear|compact", hooks: [{ type: "command", command: BRIEF_COMMAND }] });
    notes.push(`✓ settings.json → SessionStart hook: ${BRIEF_COMMAND}`);
  }
  return notes;
}

async function runInit() {
  if (!files && project === here) {
    console.error("✗ you're inside claude-goat itself — cd into the project you want to initialize");
    process.exit(1);
  }

  console.log("── init: project scaffold ──────────────────────────────────────────────────");

  // [template file, destination relative to the project root]
  const plan = [
    ["CLAUDE.project.md", "CLAUDE.md"],
    ["DESIGN.md", join("docs", "DESIGN.md")],
    ["feature.md", join("docs", "features", "_TEMPLATE.md")],
  ];

  await mkdir(join(project, "docs", "features"), { recursive: true });
  await mkdir(join(project, "src"), { recursive: true });

  let created = 0;
  for (const [src, dest] of plan) {
    if (await exists(join(project, dest))) {
      console.log(`⚠ ${dest} already exists — skipped`);
      continue;
    }
    await writeFile(join(project, dest), await readSource(`templates/${src}`));
    console.log(`✓ ${dest}`);
    created++;
  }

  await setupRepowise(project);

  if (created === 0) {
    console.log("\n→ project already initialized — nothing scaffolded.");
    return;
  }

  if (noClaude) {
    console.log("\n→ scaffolding done. Start Claude Code here and ask it to interview you and fill in the INIT: placeholders.");
    return;
  }

  let prompt = await readSource("templates/interview.md");
  // cmd.exe can't pass a multi-line argument through — flatten on Windows
  if (process.platform === "win32") prompt = prompt.replace(/\s+/g, " ").trim();

  console.log("\n→ launching Claude Code to interview you and fill in the placeholders…\n");
  const res = spawnSync("claude", [prompt], { stdio: "inherit", shell: winShell });

  if (res.error) {
    console.error("✗ couldn't launch `claude` — is it on your PATH?");
    console.error("  Start Claude Code in this directory yourself and say:");
    console.error("  «Interview me, fill in every INIT: placeholder in CLAUDE.md and docs/DESIGN.md, then brainstorm and write a plan for the first milestone into docs/features/»");
    process.exit(1);
  }
}

async function promptMode() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(
      "\nWhat do you want to run?\n" +
      "  [1] install — global CLAUDE.md, skills, agents, plugins, MCPs (~/.claude)\n" +
      "  [2] init    — scaffold + interview this project only\n" +
      "  [3] both (default)\n" +
      "Choice [1/2/3]: "
    )).trim();
    if (answer === "1") return "install";
    if (answer === "2") return "init";
    return "both";
  } finally {
    rl.close();
  }
}

let mode;
if (flagInstall && !flagInit) mode = "install";
else if (flagInit && !flagInstall) mode = "init";
else if (flagInstall && flagInit) mode = "both";
else if (files && process.stdin.isTTY && process.stdout.isTTY) mode = await promptMode();
else if (!files && project === here) mode = "install"; // repo mode, run from the repo root
else mode = "both"; // repo mode from a project dir, or packed + non-interactive

if (mode === "install" || mode === "both") await runInstall();
if (mode === "init" || mode === "both") await runInit();

if (mode === "install") {
  console.log("\n→ global install done. Re-run with --init (or from a project's root) to also scaffold a project.");
}
