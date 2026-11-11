#!/bin/sh
# repowise-merge-hook-start
# Re-syncs the repowise index after a merge or pull lands new commits (background, non-blocking).
# post-commit covers local commits; this covers `git pull` / merges of main. Installed by claude-goat.
command -v repowise >/dev/null 2>&1 || exit 0
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -f "$ROOT/.repowise/state.json" ] || exit 0
( cd "$ROOT" && repowise update --index-only >> "$ROOT/.repowise/.update.log" 2>&1 & ) >/dev/null 2>&1
# repowise-merge-hook-end
