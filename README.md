# claude-goat

Personal Claude Code setup, deployable to any machine in one command. Ships my global `CLAUDE.md` (universal preferences, loaded every session) and a small set of hand-written skills drawn from real daily work.

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
| plugins (superpowers, typescript-lsp, security-guidance) | `claude plugin install` | Installed through the claude CLI from the official marketplace, skipped if already installed (`--no-plugins` to opt out) |
| MCP servers (playwright, context7) | `claude mcp add --scope user` | Registered through the claude CLI, skipped if already registered (`--no-plugins` covers these too) |

Nothing else in `~/.claude/` is touched. Re-running is safe (idempotent, backup gets refreshed).

**What each one is for:**
- `superpowers` — the brainstorm → plan → execute → verify → ship skill loop; see [templates/interview.md](templates/interview.md) for how it's wired into project init.
- `typescript-lsp` — real-time TS diagnostics after every edit. Needs the `typescript-language-server` binary on `PATH` (`pnpm add -g typescript typescript-language-server` — plain `npm i -g` needs root on systems where Node is installed system-wide). Only useful in TS/JS projects; harmless elsewhere.
- `security-guidance` — reviews each change for common vulnerabilities and has Claude fix findings in-session.
- `playwright` MCP — the browser the global CLAUDE.md's Real Verification rule drives for UI work.
- `context7` MCP — up-to-date library docs on demand, so scaffolded code isn't written against a stale training-cutoff API.

## Starting a new project

Same script, run from the root of a fresh (or existing) project instead of the repo:

```bash
node /path/to/claude-goat/install.mjs             # global install + scaffold + interactive fill-in
node /path/to/claude-goat/install.mjs --no-claude # skip the interview launch
```

Run from anywhere other than the repo itself, it first does the global install above (skipping what's already there), then scaffolds the project — again skipping anything that already exists:

| File | What it is |
|---|---|
| `CLAUDE.md` | Project instructions, full of `INIT:` placeholder comments |
| `docs/DESIGN.md` | Canonical visual system (tokens, typography, motion) — what `/impeccable` reads |
| `docs/features/_TEMPLATE.md` | Per-feature doc template: plan first, then implementation context |

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

Packs `install.mjs` plus the entire payload — global `CLAUDE.md`, all skills, all templates — into one self-contained file with a shebang. No repo, no dependencies, just Node (which is everywhere Claude Code is). Keep it in `~/bin`, a dotfiles repo, a USB stick, wherever:

```bash
cd my-new-project
claude-goat.mjs          # if it's on your PATH (it's chmod +x)
node claude-goat.mjs     # works anywhere, including Windows
```

It behaves exactly like running `install.mjs` from a project root: global install (skip what exists), plugin install via the claude CLI (needs network; skipped gracefully if `claude` isn't on PATH), scaffold (skip what exists), then the Claude interview. Re-run `node build.mjs` after editing any skill or template — the packed file is a snapshot, not a live view.

Plugins live in the `PLUGINS` list at the top of `install.mjs` — add a `[plugin@marketplace, marketplace-repo]` pair and rebuild.

## Zero-dependency fallback

An install is just "put the folder in the right place" — if you'd rather not run the script, the raw copies need nothing but a shell:

**macOS / Linux:**

```bash
mkdir -p ~/.claude/skills && cp -r skills/* ~/.claude/skills/ && cp global/CLAUDE.md ~/.claude/CLAUDE.md
```

**Windows PowerShell:**

```powershell
mkdir "$HOME\.claude\skills" -Force; cp -r skills\* "$HOME\.claude\skills\"; cp global\CLAUDE.md "$HOME\.claude\CLAUDE.md"
```

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
└── skills/
    ├── caveman/             # ultra-compressed output mode (~75% fewer tokens)
    ├── grill-with-docs/     # stress-test a plan against domain docs/ADRs
    └── impeccable/          # frontend design/audit toolkit (reference docs + scripts)
```

## Verifying it loaded

Inside a Claude Code session, `/memory` shows which instruction files are active — the global `CLAUDE.md` should be listed. To see a skill fire, describe a matching task (e.g. "add an EF Core entity for invoices") and watch it pick up `dotnet-conventions`.
