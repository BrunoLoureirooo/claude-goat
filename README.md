# claude-goat

Personal Claude Code setup, deployable to any machine in one command. Ships my global `CLAUDE.md` (universal preferences, loaded every session), a small set of hand-written skills drawn from real daily work, three model-tier worker agents and an orchestrator mode that delegates to them.

## Install

```bash
git clone <this-repo> && cd claude-goat && node install.mjs
```

Then start Claude Code — or run `/reload-plugins` if it's already open (skills are discovered at session startup).

Why Node and not bash? Claude Code has Node as a hard runtime dependency, so anywhere Claude Code runs, `node install.mjs` runs too — identically on macOS, Windows, and Linux. No `$HOME` vs `%USERPROFILE%`, no `/` vs `\`, no separate `.sh` + `.ps1` to keep in sync.

## What it does

| Source | Destination | Behavior |
|---|---|---|
| `global/CLAUDE.md` | `~/.claude/CLAUDE.md` | Existing file is backed up to `~/.claude/CLAUDE_bak.md` first, then overwritten |
| `skills/*` | `~/.claude/skills/` | Merged in — skill folders that already exist are skipped, everything else already there is left alone |
| `agents/*` | `~/.claude/agents/` | Same rule: an agent file that already exists is skipped. `haiku-worker`, `sonnet-worker`, `opus-worker`, `local-worker` (see [Local LLM](#local-llm)), plus `orchestrator` (pinned to Opus; see [Orchestrator mode](#orchestrator-mode)) |
| `guidelines/orchestrator.md`, `hooks/orchestrator-brief.mjs` | `~/.claude/guidelines/`, `~/.claude/hooks/` | The orchestrator's directions and the SessionStart hook that hands them to each session; skipped if already there (`--no-orchestrator` to opt out) |
| plugins (superpowers, typescript-lsp, security-guidance) | `claude plugin install` | Installed through the claude CLI from the official marketplace, skipped if already installed (`--no-plugins` to opt out) |
| MCP servers (playwright, context7) | `claude mcp add --scope user` | Registered through the claude CLI, skipped if already registered (`--no-plugins` covers these too) |
| `SETTINGS_PATCH` / `ENV_PATCH` in `install.mjs` | `~/.claude/settings.json` | Edited in place — only the listed keys are merged in, everything else already there (`enabledPlugins`, `theme`, your own `env` vars, …) is left alone. Invalid JSON is reported and left untouched rather than clobbered |
| repowise (`ensureRepowise` / `setupRepowise` in `install.mjs`) | `uv tool install`, per-project `.repowise/`, `.github/workflows/repowise.yml`, `.git/hooks/post-merge` | See [Repowise](#repowise). Also edits `~/.claude/settings.json` and `~/.claude.json` (MCP entry and hooks) via `repowise init` |
| `ORCHESTRATOR_SETTINGS` / `ORCHESTRATOR_ENV` in `install.mjs` | `~/.claude/settings.json` | Filled in only when absent: `agent: "orchestrator"`, `env.CLAUDE_CODE_FORK_SUBAGENT: "0"`; one `SessionStart` hook entry is appended unless an entry with the same command is already there, and only when `agent` is absent or already `"orchestrator"`. Existing hooks and keys are never removed or reordered (`--no-orchestrator` skips all of this) |

Nothing else in `~/.claude/` is touched — only `CLAUDE.md` (+ its backup), `settings.json` and the `skills/`, `agents/`, `guidelines/` and `hooks/` folders. Re-running is safe (idempotent, backup gets refreshed).

## Install vs. init

`install.mjs` does two independent jobs — global install (this table) and project init (next section) — runnable separately or together:

```bash
node install.mjs --install   # only ~/.claude: CLAUDE.md, skills, agents, plugins, MCPs, settings.json
node install.mjs --init      # only the current directory: scaffold + interview
node install.mjs             # let it decide (see below), or the packed file will ask you
```

With neither flag:
- **repo mode, run from the repo root** → install only (there's no project to scaffold)
- **repo mode, run from elsewhere** → both
- **packed file (`dist/claude-goat.mjs`), interactive terminal** → prompts you to pick 1/2/3
- **packed file, piped or scripted (no TTY)** → defaults to both, so it never hangs waiting for input

**What each one is for:**
- `superpowers` — the brainstorm → plan → execute → verify → ship skill loop; see [templates/interview.md](templates/interview.md) for how it's wired into project init.
- `typescript-lsp` — real-time TS diagnostics after every edit. Needs the `typescript-language-server` binary on `PATH` (`pnpm add -g typescript typescript-language-server` — plain `npm i -g` needs root on systems where Node is installed system-wide). Only useful in TS/JS projects; harmless elsewhere.
- `security-guidance` — reviews each change for common vulnerabilities and has Claude fix findings in-session.
- `model: "opus"`, `effortLevel: "high"` and, under `modelSettings` for the opus, sonnet and haiku 5.5 ids, `effortLevel: "high"` + `autoCompactWindow: 300000` — asserted on every run, overriding what was there. `env.CLAUDE_CODE_SUBAGENT_MODEL: "haiku"` is asserted too: subagents that name no model run on Haiku (the workers all name their own).
- `env.ENABLE_STOP_REVIEW: "0"` — `security-guidance` otherwise runs an LLM diff review after every response, not just at commit/push. This disables just that per-turn pass; pattern-based warnings on edits and the LLM review at `git commit`/`git push` still run.
- `playwright` MCP — the browser the global CLAUDE.md's Real Verification rule drives for UI work.
- `context7` MCP — up-to-date library docs on demand, so scaffolded code isn't written against a stale training-cutoff API.

## Repowise

[Repowise](https://github.com/repowise-dev/repowise) indexes a repo (dependency graph, git history, hotspots, dead code, health, decisions) and serves it to agents over MCP. Claude Goat wires it in:

- **Install:** `uv tool install repowise` (falls back to `pipx`; skipped with `--no-repowise`).
- **Init (every new project):** installs two git hooks and leaves the first index build to them: a bootstrap `post-commit` hook runs `repowise init --yes --no-prose --no-distill-hook` in the background on the first commit after setup (a no-op once `.repowise/state.json` exists), so setup stays fast and a project with no commits yet still gets indexed as soon as it has one. `--no-prose` makes no model calls and needs no key, so no code leaves the machine (add prose later with `repowise generate`); `--no-distill-hook` keeps repowise from rewriting what the agent reads. The CLI itself is installed with uv, which the installer installs first (brew, else astral's script) when neither uv nor pipx is present. Run the init command by hand to index immediately.
- **Kept out of git:** the index (`.repowise/*`: databases, caches, vector store) and the machine-specific editor files repowise generates go in `.gitignore`. The small shareable config (`.repowise/config.yaml`, `decisions.yaml`, plus `health-rules.json`, `policies.yaml`, `teams.yaml` if present) is un-ignored so it can be committed.
- **Index freshness:** the index is local to each checkout, so CI cannot refresh it for you. repowise's post-commit hook (installed by `init`) covers your own commits; Claude Goat adds a `post-merge` hook (`templates/post-merge.sh`) that runs `repowise update --index-only` after pulls and merges of main.
- **CI:** `.github/workflows/repowise.yml` runs repowise's gates (doc drift, security) on every pull request and push to main with a pinned release tag; no API key. Add `health`, `risk` or `coverage` to `checks:` when you want them.

## Local LLM

Subagents can only run Anthropic models, so local models sit behind `agents/local-worker.md`, a cheap Haiku relay. Modes: **draft** sends one self-contained prompt through `bin/local-llm.mjs` (text in, text out); **explore** (read-only) and **edit** drive `opencode run -m ollama/<model>` so the local model gets file tools. Output is always reported UNVERIFIED.

**Regular vs local mode** is decided at session start: the SessionStart hook probes the box (2 s cap). If it answers, the hook appends `guidelines/orchestrator-local.md` plus the resolved tiers, and local models do the bulk of the work (small for discovery, large for writing code), Sonnet is the reserve after two failed local attempts, and Opus plans and orchestrates. If it doesn't, you get plain orchestrator mode (opus/sonnet/haiku workers). `LOCAL_LLM=off` forces regular mode.

**Tiers** (`~/.claude/local-llm.json`, installed from `bin/local-llm.json`): `large` (≈ sonnet) / `medium` / `small` (≈ haiku) each name an Ollama model. The default sends all three to the 80B `qwen3-coder-next`: on a 64 GB box a second model can't stay loaded beside it, so mixing models means a reload (tens of seconds) on every switch, while a mixture-of-experts model generates fast once resident. Pair it with `OLLAMA_KEEP_ALIVE=-1` on the server so it stays loaded. On a bigger box, pull a smaller model (`node ~/.claude/bin/local-llm.mjs --pull small`), point `small`/`medium` at it in the json, and set `OLLAMA_MAX_LOADED_MODELS=2`. A tier whose model isn't installed falls back to the next larger one. Edit/explore modes pass the model to opencode inline, so `opencode.json` needs no changes. Overrides: `LOCAL_LLM_URL`, `LOCAL_LLM_MODEL` (forces one model), `LOCAL_LLM_TIMEOUT_S`. Check it: `node ~/.claude/bin/local-llm.mjs --probe`.

## Orchestrator mode

After the install (if `agent` wasn't already set), every interactive session runs as the `orchestrator` agent: the main thread plans, writes briefs, dispatches `haiku-worker`, `sonnet-worker` or `opus-worker` (cheapest tier that can do the job) and judges their reports, instead of reading and editing project files itself. The agent file has an empty body, so Claude Code's default system prompt stays; the directions it follows live in `~/.claude/guidelines/orchestrator.md` and reach the session through `hooks/orchestrator-brief.mjs` on startup, resume, `/clear` and compaction. Headless sessions (`claude -p`, the SDK) don't get them unless `ORCHESTRATOR_BRIEF_FORCE=1`. The hook is added only when `agent` is absent or already `"orchestrator"`; if it is set to anything else the installer prints a note and leaves the hook out, so the directions never reach sessions running as your own agent. The two env keys make subagents that name no model run on Sonnet rather than the main model, and turn off forks (which copy the main model and the whole conversation).

- **Off switch:** `ORCHESTRATOR_BRIEF=off` in the environment skips the directions.
- **One plain session:** `ORCHESTRATOR_BRIEF=off claude --agent claude` (PowerShell: `$env:ORCHESTRATOR_BRIEF="off"; claude --agent claude`, which lasts for that shell).
- **Workers only:** `node install.mjs --no-orchestrator` installs the three workers and leaves the orchestrator agent, directions, hook and settings keys out.
- **Undo:** delete `agent` and the `orchestrator-brief.mjs` `SessionStart` entry from `~/.claude/settings.json`; remove `env.CLAUDE_CODE_FORK_SUBAGENT` too if you want the old subagent defaults back.

Behaviour this relies on, as observed on one Claude Code version: [docs/claude-code-notes.md](docs/claude-code-notes.md).

## Starting a new project

Same script, run from the root of a fresh (or existing) project instead of the repo:

```bash
node /path/to/claude-goat/install.mjs             # global install + scaffold + interactive fill-in
node /path/to/claude-goat/install.mjs --init      # scaffold only, skip the global install
node /path/to/claude-goat/install.mjs --no-claude # skip the interview launch
```

Run from anywhere other than the repo itself with no flags, it does both — the global install above (skipping what's already there), then scaffolds the project — again skipping anything that already exists:

| File | What it is |
|---|---|
| `CLAUDE.md` | Project instructions, full of `INIT:` placeholder comments |
| `docs/DESIGN.md` | Canonical visual system (tokens, typography, motion) — what `/impeccable` reads |
| `docs/features/_TEMPLATE.md` | Per-slice doc template: plan first, then implementation context |
| `src/` | Empty on creation. All code lives here — non-negotiable, stated in `CLAUDE.md`'s Architecture section; the `00-scaffolding` slice always populates it first |

Then it launches `claude` with [templates/interview.md](templates/interview.md) as the prompt, which runs three phases in one session:

1. **Configure** — inspects any existing code first, interviews you one question at a time (what's the project, working style, stack, commands, design rules), and rewrites `CLAUDE.md` + `docs/DESIGN.md` from your answers — every placeholder replaced or its section deleted, capped at 200 lines.
2. **Shape** — brainstorms the first milestone with `superpowers:brainstorming`, then stress-tests it with `grill-with-docs`/`grill-me` until open questions are resolved or parked.
3. **Plan** — turns the shaped milestone into an implementation plan via `superpowers:writing-plans`, saved to `docs/features/<feature>.md`, with deferred work recorded in CLAUDE.md's TODOs.

So one command takes an empty directory to configured-with-a-plan.

Tip: alias it — `alias claude-init='node ~/Projects/claude_configs/install.mjs'`.

## Portable single file

```bash
node build.mjs    # → dist/claude-goat.mjs (~700 KB)
```

Packs `install.mjs` plus the entire payload — global `CLAUDE.md`, all skills, agents and templates, the orchestrator directions and hook — into one self-contained file with a shebang. No repo, no dependencies, just Node (which is everywhere Claude Code is). Keep it in `~/bin`, a dotfiles repo, a USB stick, wherever:

```bash
cd my-new-project
claude-goat.mjs          # if it's on your PATH (it's chmod +x)
node claude-goat.mjs     # works anywhere, including Windows
```

Run with no arguments in an interactive terminal, it prompts you: install only, init only, or both. Pass `--install` or `--init` to skip the prompt, or pipe/script it (no TTY) and it defaults to both so it never hangs. Otherwise it behaves like `install.mjs` from a project root: global install (skip what exists), plugin install via the claude CLI (needs network; skipped gracefully if `claude` isn't on PATH), scaffold (skip what exists), then the Claude interview. Re-run `node build.mjs` after editing any skill or template — the packed file is a snapshot, not a live view.

Plugins live in the `PLUGINS` list at the top of `install.mjs` — add a `[plugin@marketplace, marketplace-repo]` pair and rebuild.

## Zero-dependency fallback

An install is just "put the folder in the right place" — if you'd rather not run the script, the raw copies need nothing but a shell:

**macOS / Linux:**

```bash
mkdir -p ~/.claude/skills ~/.claude/agents ~/.claude/guidelines ~/.claude/hooks && cp -r skills/* ~/.claude/skills/ && cp agents/*.md ~/.claude/agents/ && cp guidelines/orchestrator.md ~/.claude/guidelines/ && cp hooks/orchestrator-brief.mjs ~/.claude/hooks/ && cp global/CLAUDE.md ~/.claude/CLAUDE.md
```

**Windows PowerShell:**

```powershell
mkdir "$HOME\.claude\skills","$HOME\.claude\agents","$HOME\.claude\guidelines","$HOME\.claude\hooks" -Force; cp -r skills\* "$HOME\.claude\skills\"; cp agents\*.md "$HOME\.claude\agents\"; cp guidelines\orchestrator.md "$HOME\.claude\guidelines\"; cp hooks\orchestrator-brief.mjs "$HOME\.claude\hooks\"; cp global\CLAUDE.md "$HOME\.claude\CLAUDE.md"
```

The copies overwrite what is there, and they don't edit `settings.json`: the orchestrator only switches on once `settings.json` has `"agent": "orchestrator"` and a `SessionStart` hook running `node <home>/.claude/hooks/orchestrator-brief.mjs` (copy only `agents/*-worker.md` if you want the workers alone).

## Layout

```
claude-goat/
├── install.mjs              # the one script: global install + project init
├── build.mjs                # packs it all into dist/claude-goat.mjs (portable single file)
├── templates/
│   ├── CLAUDE.project.md    # project CLAUDE.md scaffold (INIT: placeholders)
│   ├── DESIGN.md            # visual-system doc scaffold
│   ├── feature.md           # docs/features/<feature>.md template
│   └── interview.md         # the prompt init-project hands to claude
├── global/
│   └── CLAUDE.md            # personal global memory → ~/.claude/CLAUDE.md
├── agents/
│   ├── haiku-worker.md      # bounded, checkable work (no Edit/Write)
│   ├── sonnet-worker.md     # the default worker: implementation, tests, scripts
│   ├── opus-worker.md       # design, review, debugging, adversarial checks
│   └── orchestrator.md      # empty-bodied main-thread agent → settings "agent"
├── guidelines/
│   └── orchestrator.md      # the orchestrator's directions → ~/.claude/guidelines/
├── hooks/
│   └── orchestrator-brief.mjs # SessionStart hook that injects those directions
├── docs/
│   └── claude-code-notes.md # Claude Code behaviour observed while building the above
└── skills/
    ├── caveman/             # ultra-compressed output mode (~75% fewer tokens)
    ├── grill-with-docs/     # stress-test a plan against domain docs/ADRs
    ├── impeccable/          # frontend design/audit toolkit (reference docs + scripts)
    └── quick-fix/           # speed mode: skip ceremony + verification for low-stakes edits
```

## Verifying it loaded

Inside a Claude Code session, `/memory` shows which instruction files are active — the global `CLAUDE.md` should be listed. To see a skill fire, describe a matching task (e.g. "add an EF Core entity for invoices") and watch it pick up `/caveman`.
