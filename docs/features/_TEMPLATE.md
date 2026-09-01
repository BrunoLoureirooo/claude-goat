# <slice name>

> Copy this file to `docs/features/NN-<slug>.md` — a two-digit build-order prefix
> (00-scaffolding, 01-<first-slice>, 02-<next-slice>, …) — one file per small,
> independently-shippable slice. Never combine multiple slices into one file, and
> never let one file span an entire milestone or app.
> Fill in **What & why** and **Plan** BEFORE writing code; keep **Implementation notes**
> and **Gotchas** updated as you build. This file is the context a future session loads
> instead of re-deriving everything.

**Status:** planned | in progress | live

## What & why

<!-- What this slice does, for whom, and the constraint that shapes it.
     Name the slice before this one and the slice after it, so reading order
     is obvious without a separate index. -->

## Plan

<!-- Break the slice into individual features (e.g. for a "document processing" slice:
     1. uploads page, 2. file upload, 3. output generation) — each small enough to build
     and verify on its own. Note which are stubbed for later.

     After EVERY feature, insert a Checkpoint (not just at the end of the slice). At each
     one, stop and use AskUserQuestion to offer: (a) the user tests it themselves, or
     (b) Claude spins up an agent to test it — the Playwright MCP for a UI flow, a
     subagent otherwise. Wait for their answer before starting the next feature. -->

1. <feature 1>
   **Checkpoint:** test yourself, or have Claude test it?
2. <feature 2>
   **Checkpoint:** test yourself, or have Claude test it?

## Implementation notes

<!-- Where it lives (files), how data flows, decisions made along the way and why. -->

## Gotchas

<!-- The things that will bite the next session: env vars needed, commands that don't run it,
     APIs with surprising behavior. -->
