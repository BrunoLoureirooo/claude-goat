# claude-goat metrics — design

**Date:** 2026-08-12
**Status:** approved, ready for planning

## Problem

`install.mjs --init` launches a Claude session with [`templates/interview.md`](../../../templates/interview.md)
as its prompt — the "setup agent". It takes a project from empty scaffold to
configured-with-a-plan. There is currently no way to tell whether a change to
`interview.md`, the templates, or the global `CLAUDE.md` makes that agent better
or worse.

We want a feedback loop: measurable numbers per session, saved next to the global
`CLAUDE.md`, in a format that can be analysed from a dev environment and compared
across versions of the setup.

## What we are measuring

Three families, all derived from data already on disk:

1. **Token efficiency** — how many tokens the work cost.
2. **Corrections** — how much rework and human intervention the work needed.
   This is the "is the workflow improving" signal.
3. **Efficacy** — did the setup agent actually satisfy the contract that
   `interview.md` states, checked against the resulting files.

## Sources considered and rejected

**`~/.claude/telemetry/`** — files are named `1p_failed_events.*`. It is a
dead-letter queue for analytics events that *failed to upload* to Anthropic, not
a local log. On this machine it holds 150 events from two isolated days, they are
internal product events (`tengu_skill_loaded`, `tengu_feature_ok`, `tengu_exit`),
they contain **no token counts**, and the schema is undocumented and free to
change between releases. Reading it would produce silent, gappy data.

**OpenTelemetry export** (`CLAUDE_CODE_ENABLE_TELEMETRY=1`) — exports the right
metrics (`claude_code.token.usage`, `claude_code.cost.usage`, …) but has **no
file exporter**. It writes to a Prometheus scrape endpoint or an OTLP collector,
so it requires running collector infrastructure permanently. It also carries no
scaffold-efficacy or corrections-per-task signal.

**A `SessionEnd` hook** — workable (the hook payload hands over `session_id`,
`transcript_path` and `cwd` directly), but it collects only from install day
forward, adds a `settings.json` patch, a collector script installed into
`~/.claude`, a marker-file gate, a packed-payload change, and per-session
execution that could disrupt a live session. Rejected as disproportionate:
everything it would capture is already in the transcripts.

## Chosen approach

**One script, run on demand. Nothing runs during sessions.**

```bash
node metrics.mjs   # scans ~/.claude/projects/**/*.jsonl → ~/.claude/claude-goat/runs.jsonl
```

The decisive advantage: the transcripts are already there. At time of writing
this machine has 16 transcripts, 11 MB, spanning 2026-07-13 to 2026-08-12 across
8 projects — each with full per-message token counts, tool calls, skill
invocations, interrupts and errors. The first run produces a month of history
instead of starting from zero.

Because nothing executes inside a session, a bug in this script can never
disrupt Claude Code.

## Effect on the existing flow

None. `metrics.mjs` is standalone and manual — not called by `install.mjs`, not
by `build.mjs`, not on a schedule, not on session end.

| Command | Change |
|---|---|
| `node install.mjs` | unchanged, except `runInit()` writes `.claude-goat.json` |
| `node build.mjs` | unchanged; `metrics.mjs` stays repo-only and is **not** added to the packed payload — records derive from the local `~/.claude/projects`, and analysis happens where the repo lives |
| `node metrics.mjs` | new |

It writes only inside `~/.claude/claude-goat/`. Projects, `settings.json`,
skills and the global `CLAUDE.md` are read at most, never modified.

The cost of being manual: a session whose transcript is pruned before a scan is
lost permanently. Accepted for now; the rejected `SessionEnd` hook is the fix if
that turns out to matter.

## Inputs

### 1. Transcripts — `~/.claude/projects/<slug>/<session-id>.jsonl`

Newline-delimited JSON. Verified line types and fields:

| Line type | Fields read | Yields |
|---|---|---|
| `assistant` | `message.usage.{input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens}` | token totals |
| `assistant` | `message.model` | per-model split (sessions mix models) |
| `assistant` | `message.content[].tool_use.{id, name, input}` | tool counts; edit churn via `input.file_path`; skills via `input.skill` |
| `user` | `message.content[].tool_result.{tool_use_id, is_error}` | tool errors, bash failures (joined to `tool_use.name` by id) |
| `user` | `message.content` text | real prompts (segment boundaries) and `[Request interrupted by user]` markers |
| any | `timestamp`, `version`, `gitBranch`, `cwd`, `sessionId`, `isSidechain` | duration, CC version, project identity, subagent share |

### 2. The project directory

Resolved from the transcript's `cwd`. Read only for efficacy checks:
`CLAUDE.md`, `docs/DESIGN.md`, `docs/features/*.md`. Skipped entirely when the
project is not goat-scaffolded (no `CLAUDE.md` **and** no `docs/features/`).

### 3. Config fingerprint — this repo, or the project's `.claude-goat.json`

Preferred source is `<project>/.claude-goat.json` when present: it records the
template hashes and goat SHA *as of the moment that project was scaffolded*,
which is the honest answer. Only projects scaffolded after the `install.mjs`
change below will have it.

Fallback, and the only option for existing projects: read this repo directly —
`git rev-parse HEAD`, plus sha256 of `templates/*.md` and `global/CLAUDE.md`.
Records built this way are marked `config.source: "scan-time"` so they are never
mistaken for session-time truth.

### 4. Its own prior output

`~/.claude/claude-goat/runs.jsonl`, to skip sessions already processed.

Nothing is read from `~/.claude/telemetry/` and nothing from the network.

## Output layout

Under `~/.claude/claude-goat/` (next to the global `CLAUDE.md`):

```
runs.jsonl              one line per session — the file you query
templates/<sha256>.md   content-addressed template snapshots, deduped
```

## Record shape

One JSON object per line in `runs.jsonl`:

```jsonc
{
  "schema": 1,
  "capturedAt": "2026-08-12T00:00:00.000Z",
  "session": {
    "id": "7a5e9755-…",
    "project": "/home/vyrus-extreme/Projects/claude_configs",
    "startedAt": "2026-07-13T23:22:59.237Z",
    "endedAt": "2026-07-14T22:34:43.990Z",
    "durationMs": 83504753,
    "claudeCodeVersion": "2.1.207",
    "gitBranch": "master"
  },
  "config": {
    "source": "scan-time",
    "goatSha": "63dad15",
    "globalClaudeMd": "<sha256>",
    "templates": { "interview.md": "<sha256>", "CLAUDE.project.md": "<sha256>" }
  },
  "tokens": {
    "input": 856, "output": 348900,
    "cacheCreate": 1223208, "cacheRead": 38019446,
    "byModel": {
      "claude-fable-5":  { "messages": 174, "input": 412, "output": 190100, "cacheCreate": 700000, "cacheRead": 20100000 },
      "claude-sonnet-5": { "messages": 152, "input": 444, "output": 158800, "cacheCreate": 523208, "cacheRead": 17919446 }
    }
  },
  "turns": { "assistant": 326, "userPrompts": 28, "segments": 28, "sidechain": 0 },
  "tools": {
    "calls": { "Bash": 60, "Edit": 47, "Read": 24 },
    "total": 151, "errors": 5, "bashFailures": 2
  },
  "skills": ["superpowers:brainstorming"],
  "corrections": {
    "interrupts": 3,
    "toolErrors": 5,
    "bashFailures": 2,
    "churn": { "README.md": 19, "install.mjs": 16 },
    "correctiveTurns": { "count": 4, "heuristic": true }
  },
  "segments": [
    { "n": 1, "startedAt": "2026-07-13T23:22:59.237Z", "durationMs": 412000,
      "tokens": 18400, "toolCalls": 7, "errors": 0, "interrupts": 0, "slice": null },
    { "n": 2, "startedAt": "2026-07-13T23:29:51.100Z", "durationMs": 903000,
      "tokens": 51200, "toolCalls": 14, "errors": 2, "interrupts": 1, "slice": "01-uploads.md" }
  ],
  "efficacy": {
    "applicable": true,
    "checks": { "initPlaceholdersRemaining": 0, "claudeMdLines": 187 },
    "passed": 8, "total": 9
  }
}
```

### Corrections — hard signals vs. heuristic

Four are counted, not guessed:

- `interrupts` — `[Request interrupted by user]` / `[Request interrupted by user for tool use]`
- `toolErrors` — `tool_result.is_error`
- `bashFailures` — the same, filtered to `tool_use.name === "Bash"`
- `churn` — repeat `Edit`/`Write`/`NotebookEdit` calls against one `file_path`

`correctiveTurns` (user prompts matching corrective language: "no", "wrong",
"revert", "undo", "actually", "not what") is a keyword heuristic. It lives in its
own field carrying `heuristic: true` so it can never be mistaken for a
measurement.

### "Corrections per issue"

Nothing in a transcript knows what an "issue" is, so none is inferred. The unit
is a **segment**: one real user prompt through to the next. Per segment we record
tokens, tool calls, errors, interrupts and duration. *Corrections per segment* is
then a direct measure of the loop as experienced — a task that took 12 prompts
and 4 interrupts is visibly worse than one that took 2. Where a session clearly
worked on a single `docs/features/NN-*.md`, its segments are tagged with that
slice.

### Efficacy checks

`interview.md` is read as a spec and checked against the filesystem:

| Check | Target |
|---|---|
| `initPlaceholdersRemaining` — `INIT:` occurrences in `CLAUDE.md` + `docs/DESIGN.md` | 0 |
| `claudeMdLines` | ≤ 200 |
| `templateUntouched` — `docs/features/_TEMPLATE.md` matches shipped hash | true |
| `hasScaffoldingSlice` — `00-scaffolding.md` exists | true |
| `sliceCount` / `sliceNumbersSequential` | ≥ 1, sequential |
| `checkpointsPerSlice` | ≥ 1 each |
| `todosSection` — CLAUDE.md TODOs section non-empty | true |

`applicable: false` when the project was never goat-scaffolded; the checks are
then omitted rather than reported as failures.

## Behaviour

- **Idempotent and incremental.** A session already in `runs.jsonl` is skipped
  unless its transcript's mtime is newer than the record's `capturedAt` (so live
  sessions get refreshed on a later run).
- **Records outlive their sources.** Claude Code prunes transcripts on a
  configurable schedule (`cleanupPeriodDays`). The oldest transcript here is
  2026-07-13, roughly at the default 30-day boundary and about to disappear.
  Because records are kept once written, running this periodically preserves
  history as transcripts age out.
- **Malformed lines are skipped**, not fatal. A truncated final line is normal
  for a session still running.

## Structure

```
metrics.mjs           CLI entry point: resolve paths, walk, load prior, write output
metrics/parse.mjs     transcript JSONL → session metrics (pure)
metrics/efficacy.mjs  project dir → efficacy checks (pure)
metrics/config.mjs    repo SHA + template hashes + snapshot writing
```

`parse.mjs` and `efficacy.mjs` are pure functions of their inputs, which is what
makes them testable without a live Claude session.

## Testing

- **Unit** — the 16 real transcripts in `~/.claude/projects/` are the fixtures.
  Known-good values already extracted by hand for
  `7a5e9755-f81b-428f-9aea-75d49e52f354`: 326 assistant turns, 28 user prompts,
  3 interrupts, 5 tool errors of 151 results, 2 bash failures of 60, README.md
  edited 19×, models `{fable-5: 174, sonnet-5: 152}`. `parse.mjs` must reproduce
  these exactly.
- **Efficacy** — a temp dir scaffolded by `install.mjs --init --no-claude` gives
  the all-placeholders-remaining case; this repo gives a non-goat project for the
  `applicable: false` path.
- **Real verification** (per global `CLAUDE.md` §5 — CLI, so exercise the real
  entry point): run `node metrics.mjs` against the real `~/.claude/projects`,
  inspect the emitted `runs.jsonl`, then re-run and confirm zero re-processing.

## Deliberately out of scope

- **USD cost estimates.** A baked-in price table goes stale silently and means
  nothing on a subscription. Derivable from the stored token counts later.
- **A report command or dashboard.** Raw JSONL only; analysis happens in the dev
  environment.
- **`SessionEnd` hook / `settings.json` changes.** See rejected approaches.
- **Verbatim prompt text.** Counts only, so the log stays metrics rather than
  conversation content.

## Known limitations

- **`effortLevel` is not recorded per session.** It is absent from transcripts,
  and reading `settings.json` at scan time would report today's value rather than
  the session's. Omitted rather than logged misleadingly.
- **Retroactive records cannot know their template versions.** The config
  fingerprint for a past session reflects scan time, not session time. Fixed
  going forward by the `install.mjs` change below.
- **This is not a controlled experiment.** A hard project scores worse than an
  easy one regardless of setup quality. Trends across many comparable runs carry
  signal; any single pairwise comparison does not.
- **Sessions are pruned before they are scanned** if the script is not run within
  the retention window. Unrecoverable when it happens.

## The one `install.mjs` change

`runInit()` writes `.claude-goat.json` at the project root before launching
Claude — template hashes, goat SHA, timestamp, and the pinned init session id via
`--session-id`. This is what lets a future record say *which version of
`interview.md` produced this project*. Everything else in this design works
without it.
