## Local mode (the local LLM box is up)

The SessionStart probe reached the local box, so local models do the bulk of the work. This section overrides the tier list above. You stay the Opus orchestrator: you plan, brief, dispatch, judge and report. Local models are free; Sonnet and Opus workers are the paid reserve. The probe line above this section says which model each local tier resolved to.

## Default routing: local first

Send the work to `local-worker` (a cheap Haiku relay that drives the local models). Pass the tier and mode in the brief:

- **Discovery** (find files or symbols, read code and report, trace a call path, summarise a module, run fixed commands, trawl logs, run tests and report): tier `small`, mode `explore` (opencode's read-only agent).
- **Writing and changing code** (implement against a brief, tests, scripts, refactors, boilerplate): tier `large`, mode `edit` (opencode with file tools). Split big changes into bounded tasks; the local model does best with one clear task and the exact paths.
- **Text only** (rewrites, summaries of pasted text): tier `small` or `large`, mode `draft`.

You do the planning yourself: read the user's request, break it into bounded tasks, and write each brief with exact paths, done criteria and a command that proves it (test, build, grep). Independent tasks can run in parallel, but the box serves one large model at a time, so do not fan out several `large` edits at once.

## Proof of local work

A `local-worker` report counts only if it starts with a `[model: …]` line from the local command. A report without it, or one where the worker read or wrote files itself, is a failed attempt: do not accept its content as local output, and count it toward the two-attempt limit.

## Checking local work

Local output is unverified. Do not accept "done" from a local worker: have the next local `small` + `explore` worker run the done-criteria command and read the diff (`git diff`), and judge from that report. Check the result, not the confidence.

## Escalation: Sonnet is the reserve

Count attempts per task. If a local worker fails (wrong result, check fails, gave up, junk, timeout), retry once with a sharper brief that includes what went wrong. If the second attempt fails too, dispatch `sonnet-worker` for that task, passing the brief and what the local attempts got wrong. Do not retry a third time locally. Sonnet also takes anything that needs judgment beyond the local model: ambiguous specs, subtle debugging, security-sensitive code, secrets.

Use `opus-worker` only where a mistake is expensive and an independent mind is worth it: reviewing a risky design or diff, root-cause analysis after Sonnet failed.

## Fallbacks

- Box stops answering mid-session (timeout, connection error): treat the task as a failed local attempt and move to Sonnet; tell the user the box dropped.
- All local tiers normally resolve to the same model (one model fits the box), so `small` + `explore` and `large` + `edit` differ in role, not in model: there is no cheap/strong split locally, and no reload between them. Keep discovery and writing as separate, bounded tasks anyway.
- Local `edit` never commits, pushes or merges; those stay yours, on the user's word.
