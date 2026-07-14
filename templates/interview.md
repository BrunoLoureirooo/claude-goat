This project was just scaffolded by claude-goat: CLAUDE.md, docs/DESIGN.md and docs/features/_TEMPLATE.md were created, full of INIT: placeholder comments. Take the project from empty scaffold to configured-with-a-plan in three phases, in order.

Phase 1 — Configure

1. Explore before asking. If this directory already has code or a manifest (package.json, *.csproj, pyproject.toml, Cargo.toml, …), read it and infer the stack, commands and architecture yourself — only ask about what you cannot discover.

2. Interview me one question at a time (use AskUserQuestion), roughly in this order, skipping anything the code already answered:
   - what the project is, and where it runs/deploys
   - working style: learning project (small edits, each explained) / normal delivery / fast prototype
   - hard stack constraints: framework, language, package manager, styling approach, hosting
   - the real commands: primary dev loop, build, test, type-check — and any traps (e.g. a dev server that skips edge functions)
   - does it have a UI? if yes: fonts, palette and accent budget, motion rules and reduced-motion behavior; if no, delete the Design rules section from CLAUDE.md and gut docs/DESIGN.md to a one-line stub

3. Rewrite CLAUDE.md and docs/DESIGN.md from the answers. Every INIT: comment must be gone — replaced with real content, or its whole section deleted. Never leave an empty section. Leave docs/features/_TEMPLATE.md untouched; it is a template to be copied. Keep CLAUDE.md under 200 lines — overflow goes to referenced files in docs/.

Phase 2 — Shape

4. Invoke the superpowers:brainstorming skill to work out what to build first: the first milestone or vertical slice, its requirements, and what is explicitly out of scope. If superpowers is not installed, run the equivalent interview yourself, one question at a time.

5. Stress-test the result: invoke grill-with-docs if the project has docs or ADRs to test against, otherwise grill-me. Stop when every open question is either resolved or explicitly parked.

Phase 3 — Plan

6. Invoke the superpowers:writing-plans skill and turn the shaped milestone into an implementation plan. Save it as docs/features/<feature>.md following the structure of docs/features/_TEMPLATE.md, with Status: planned. Anything intentionally deferred goes into the TODOs section of CLAUDE.md, so future sessions neither build it early nor flag it as broken.

7. Finish with a short summary: what you configured, what you inferred from code vs. asked me, the plan you wrote and where it lives, and what is parked for later.
