#!/bin/sh
# repowise-merge-hook-start
# After a merge or pull: refresh the repowise index (background, non-blocking), or build it if it
# was never built. post-commit covers local commits; this covers `git pull` / merges of main.
PATH="$HOME/.local/bin:$PATH"
command -v repowise >/dev/null 2>&1 || exit 0
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
mkdir -p "$ROOT/.repowise" 2>/dev/null
if [ -f "$ROOT/.repowise/state.json" ]; then
  ( cd "$ROOT" && repowise update --index-only >> "$ROOT/.repowise/.update.log" 2>&1 & ) >/dev/null 2>&1
else
  ( cd "$ROOT" && repowise init --yes --no-prose --no-distill-hook >> "$ROOT/.repowise/.bootstrap.log" 2>&1 & ) >/dev/null 2>&1
fi
# repowise-merge-hook-end
