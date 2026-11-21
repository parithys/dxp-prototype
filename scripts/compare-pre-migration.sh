#!/usr/bin/env bash
# Pre-migration comparison (docs/migration/phase7-accessibility.md, "Not verified here"): pixels and accessibility tree of every swept screen,
# the pre-shadcn build (commit 3d061b1) against this one. Run from the repo root in a normal terminal (the Claude sandbox cannot start servers).
# Expected differences: checkbox tick, dialog and tab markup, the dev showcase, the component-catalogue count. Anything else needs explaining.
set -euo pipefail
WT=${WT:-/tmp/head-wt}
git worktree add "$WT" 3d061b1
ln -s "$PWD/node_modules" "$WT/node_modules"
(cd "$WT" && PORT=5181 npm run dev > /tmp/head-wt.log 2>&1 & echo $! > /tmp/head-wt.pid)
until curl -sf http://localhost:5181 > /dev/null; do sleep 2; done
SNAP_DIR=pre PORT=5181 npx playwright test sweep.spec --update-snapshots
SNAP_DIR=pre PORT=5180 npx playwright test sweep.spec || echo "Differences found: review each one."
kill "$(cat /tmp/head-wt.pid)"; git worktree remove --force "$WT"
