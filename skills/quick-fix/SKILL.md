---
name: quick-fix
description: >
  Speed mode for low-stakes changes. Skips brainstorming, planning, TDD, code
  review, and the Playwright browser-verification gate — makes the smallest
  direct edit and reports it as unverified for the user to check themselves.
  Use when user says "quick fix", "just make it quick", "doesn't matter much,
  just do it", "no testing", "I'll check it myself", "skip the ceremony",
  or invokes /quick-fix.
---

Make the smallest direct edit that satisfies the request. No brainstorming, no
written plan, no TDD, no `docs/features/` entry, no code-review request/receive
cycle, no Playwright browser drive, no ≥90% confidence gate. Ship the diff and
let the user check it themselves.

## Scope

Applies only to the task in the same message as the trigger phrase (or the one
immediately following an explicit `/quick-fix`). It does not persist across
unrelated later requests in the same conversation — a new task gets full rigor
unless the user triggers quick-fix again for it. If the user wants it to stay
on for a whole session, they'll say so explicitly ("stay in quick-fix mode").

## Never skipped, even here

- Never weaken, skip, or delete an existing failing test to reach green —
  that's not a ceremony cost, it's hiding a real break.
- No hardcoded secrets, no obviously injectable/unsafe code.
- If the change is destructive or hard to reverse (dropping data, force-push,
  deleting files) or touches auth/payments/security, drop quick-fix mode for
  that step: warn plainly, get explicit confirmation, then resume.

## Reporting

Close with one explicit line, e.g. "Quick-fix — unverified, not run." Never
say "done," "fixed," or "working" — those claims require the verification this
mode is skipping. State what changed and that the user should check it.
