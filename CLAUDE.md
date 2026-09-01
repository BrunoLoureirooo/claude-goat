# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- INIT: scaffolded by claude-goat init-project. Every "INIT:" comment is a placeholder —
     replace the section below it and delete the comment. A section that doesn't apply gets
     deleted entirely, never left empty. Keep this file under 200 lines. -->

## Project

<!-- INIT: one short paragraph: what this is, where it runs/deploys, and the one sentence of
     context that changes how Claude should behave here (e.g. "learning project — make unitary
     edits with explanations, not batch changes", or "production billing code — be conservative"). -->

## Working style

<!-- INIT: how should Claude pace and size its work? Pick ONE lane and state it hard:
     - learning project → small, single-purpose edits, each immediately followed by a plain
       explanation of what it does and why; never write a whole file in one shot; one concept
       per edit
     - normal delivery → focused diffs, no drive-by refactors, explain only when asked
     - prototype → speed over polish, mark every shortcut with a TODO
     If it's non-negotiable, put NON-NEGOTIABLE in the heading. -->

## Commands

```bash
# INIT: the real commands, one line each, with a short trailing comment.
# Mark the PRIMARY dev command and say what it actually runs — and what it does NOT
# (e.g. "pnpm dev = fast HMR but no edge functions; pnpm start = the real local run").
# Include: dev loop, build, preview, test, type-check.
```

## Stack (non-negotiable)

<!-- INIT: bullet list of hard constraints only — framework + key config, styling approach,
     package manager, hosting target, i18n. If Claude is allowed to deviate from it, it
     doesn't belong in this list. -->

## File conventions

See [docs/DESIGN.md](docs/DESIGN.md) — canonical visual system: tokens, typography, motion.
Each small, independently-shippable slice gets its own `docs/features/NN-<slug>.md` (two-digit build-order prefix, e.g. `00-scaffolding.md`, `01-<first-slice>.md`) — plan first, then implementation context. Copy [docs/features/_TEMPLATE.md](docs/features/_TEMPLATE.md) per slice; never combine slices into one file or let one file span the whole app.

<!-- INIT: add pointers to any other canonical docs (PRODUCT.md, docs/PHASES.md, …), each with
     a one-line "what lives there and who reads it". Delete this comment if there are none. -->

## Architecture

All code lives under `src/` — no exceptions carved out per file type or framework convention.

<!-- INIT: annotated tree of the directories inside src/ that matter, e.g.

src/
  layouts/       # single layout shell
  components/    # one component per section
  content/       # collections (Zod schemas)

plus the one or two structural rules worth stating ("adding an entry = drop a .md file,
no code change"). -->

## Design rules

<!-- INIT: UI projects only — delete this whole section otherwise. The detail lives in
     docs/DESIGN.md; this is the short list Claude must never violate: fonts, the accent
     budget (which color is the hero, which is the ONE sparing accent), motion rules, and
     prefers-reduced-motion behavior. -->

## Agent / skill rules

- Large-scale code analysis → deploy Haiku agents
- All visual changes → run `/impeccable` `/design-motion-principles`
- Each slice → its own `docs/features/NN-<slug>.md` (plan first, then impl context) — never one file per app or per milestone
- All code → under `src/`; the scaffolding slice (`00-scaffolding.md`) always creates the initial folders/files there, never leaves it empty
- Executing a slice → after every individual feature within it (not just at the end of the slice), stop at the plan's Checkpoint: ask whether the user will test it themselves or wants Claude to spin up an agent to test it (Playwright MCP for a UI flow, a subagent otherwise) — wait for their answer before starting the next feature
- Every implemented feature → spin up the app and drive the real flow in a browser via the Playwright MCP before marking complete; ≥90% confidence from observed behavior or report it as UNVERIFIED
- CLAUDE.md max 200 lines — overflow goes to referenced docs/

<!-- INIT: keep, trim, or extend — these are the house defaults. -->

## TODOs

<!-- INIT: the current phase's intentional stubs — what's missing on purpose, so Claude
     neither builds it early nor flags it as broken. -->
