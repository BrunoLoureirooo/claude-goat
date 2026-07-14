This project was just scaffolded by claude-goat: CLAUDE.md, docs/DESIGN.md and docs/features/_TEMPLATE.md were created, full of INIT: placeholder comments. Take the project from empty scaffold to configured-with-a-plan in three phases, in order.

Phase 1 — Configure

1. Explore before asking. If this directory already has code or a manifest (package.json, *.csproj, pyproject.toml, Cargo.toml, …), read it and infer the stack, commands and architecture yourself — only ask about what you cannot discover.

2. Interview me one question at a time (use AskUserQuestion), roughly in this order, skipping anything the code already answered:
   - what the project is, and where it runs/deploys
   - working style: learning project (small edits, each explained) / normal delivery / fast prototype
   - hard stack constraints: framework, language, package manager, styling approach, hosting
   - the real commands: primary dev loop, build, test, type-check — and any traps (e.g. a dev server that skips edge functions)
   - does it have a UI? if yes: fonts, palette and accent budget, motion rules and reduced-motion behavior; if no, delete the Design rules section from CLAUDE.md and gut docs/DESIGN.md to a one-line stub

   The stack question needs a concrete, named answer — a specific framework, language and hosting target — not "not sure yet" or "TBD". If there's no existing code to infer it from and I'm genuinely undecided, don't skip past it: stop and work the decision through with me right there (trade-offs, your recommendation, a pick) before moving on. Nothing later in this process can proceed against an unresolved stack.

3. Rewrite CLAUDE.md and docs/DESIGN.md from the answers. Every INIT: comment must be gone — replaced with real content, or its whole section deleted. Never leave an empty section. Leave docs/features/_TEMPLATE.md untouched; it is a template to be copied. Keep CLAUDE.md under 200 lines — overflow goes to referenced files in docs/.

Phase 2 — Shape

4. Invoke the superpowers:brainstorming skill to work out what to build first: the first milestone or vertical slice, its requirements, and what is explicitly out of scope. If superpowers is not installed, run the equivalent interview yourself, one question at a time.

5. Stress-test the result: invoke grill-with-docs if the project has docs or ADRs to test against, otherwise grill-me. Stop when every open question is either resolved or explicitly parked.

Phase 3 — Plan

Before writing anything: re-check CLAUDE.md's stack section. If it's still a placeholder, a guess, or otherwise not concrete, stop and go back to Phase 1 step 2 — do not plan implementation against a stack that isn't nailed down.

6. Invoke the superpowers:writing-plans skill, but do not produce one plan that builds the whole app. Break the milestone into an ordered sequence of small, independently-shippable slices — a tracer-bullet path, not a monolith:
   - The first slice is always scaffolding: the minimum project skeleton needed before any real feature can be built (tooling, empty shell/entry point, base layout, CI if relevant) — nothing user-facing yet. All code lives under `src/`; this slice's own steps always create the initial folders and/or files there (per the chosen stack's convention) — it never finishes without touching `src/`.
   - Each slice after that is one small vertical slice of the milestone, thin enough to build and verify end-to-end on its own.
   - Write each slice as its own file, copied from docs/features/_TEMPLATE.md, named docs/features/NN-<slug>.md with a two-digit build-order prefix (00-scaffolding.md, 01-<first-slice>.md, 02-<next-slice>.md, …). Never combine multiple slices into one file, and never write a single file that spans the entire milestone.
   - Within each slice's Plan section, break it further into its individual features (e.g. a "document processing" slice decomposes into: uploads page, file upload, output generation) and insert a Checkpoint after every one of them, not just at the end of the slice — see the guidance already in _TEMPLATE.md's Plan section for the exact format. These checkpoints are what make each feature verifiable on its own instead of only at the end of the whole slice.
   - Each file's Status starts at planned. Cross-reference: each slice's "What & why" names the slice before and after it, so reading order is obvious without a separate index.

   Anything intentionally deferred beyond this milestone goes into the TODOs section of CLAUDE.md, so future sessions neither build it early nor flag it as broken.

7. Finish with a short summary: what you configured, what you inferred from code vs. asked me, the resolved stack, the ordered list of slice files you wrote and where they live, and what is parked for later.
