// install.mjs — two independent jobs, runnable separately or together:
//   install → global CLAUDE.md, skills, plugins, MCPs, settings.json patch → ~/.claude
//   init    → scaffolds CLAUDE.md + docs/ in the CURRENT directory, then launches Claude
//             Code to interview you and fill them in
//
// Flags: --install (install only), --init (init only), --no-claude (init: skip the
// interview launch), --no-plugins (install: skip plugin + MCP installs).
// Pass neither --install nor --init and:
//   - repo mode, run from the repo root            → install only
//   - repo mode, run from elsewhere                 → both
//   - packed (dist/claude-goat.mjs), interactive TTY → prompts you to choose
//   - packed, non-interactive (piped/scripted)       → both
//
// Anything that already exists — a skill folder, a scaffold file — is skipped, never
// overwritten. Exceptions: the global CLAUDE.md, which is backed up then refreshed, and
// settings.json, which is edited in place (only SETTINGS_PATCH keys and ENV_PATCH env vars
// are touched — everything else the user has in there, including enabledPlugins, is left alone).
//
// `node build.mjs` packs this script + all payload files into dist/claude-goat.mjs, a single
// portable file that does the same thing anywhere without the repo.
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, readdir, access, copyFile, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const EMBEDDED = null; // ← build.mjs replaces this line with the packed payload

const here = dirname(fileURLToPath(import.meta.url));
const claudeDir = join(homedir(), ".claude");
const skillsDir = join(claudeDir, "skills");
const targetMd = join(claudeDir, "CLAUDE.md");
const project = process.cwd();
const noClaude = process.argv.includes("--no-claude");
const noPlugins = process.argv.includes("--no-plugins");
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
const SETTINGS_PATCH = { effortLevel: "medium" };
// env vars merged into settings.json's "env" object, alongside whatever the user already has
const ENV_PATCH = { ENABLE_STOP_REVIEW: "0" }; // security-guidance: skip the per-turn Stop review

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
    settings = { ...settings, ...SETTINGS_PATCH, env: { ...(settings.env ?? {}), ...ENV_PATCH } };
    await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    console.log(`✓ settings.json → effortLevel: ${SETTINGS_PATCH.effortLevel}, env.${Object.keys(ENV_PATCH)[0]}=${Object.values(ENV_PATCH)[0]}`);
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
      "  [1] install — global CLAUDE.md, skills, plugins, MCPs (~/.claude)\n" +
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
