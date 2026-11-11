#!/bin/sh
# repowise-bootstrap-start
# Builds the repowise index on the first commit (or as soon as repowise is installed) when
# claude-goat could not do it at init time. A no-op once .repowise/state.json exists.
PATH="$HOME/.local/bin:$PATH"
command -v repowise >/dev/null 2>&1 || exit 0
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -f "$ROOT/.repowise/state.json" ] && exit 0
mkdir -p "$ROOT/.repowise" 2>/dev/null
( cd "$ROOT" && repowise init --yes --no-prose --no-distill-hook >> "$ROOT/.repowise/.bootstrap.log" 2>&1 & ) >/dev/null 2>&1
# repowise-bootstrap-end
