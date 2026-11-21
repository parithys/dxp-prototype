#!/usr/bin/env bash
# Pushes the four stacked branches of the native-button migration and opens one PR per step, each based on the previous branch
# (docs/migration/button-role-migration.md). Run from the repo root in a normal terminal; needs `gh auth login`.
set -euo pipefail
FOOTER=$'\n\nGenerated with [Claude Code](https://claude.com/claude-code)'
pr() { # branch base title body
  git push -u origin "$1"
  gh pr create --head "$1" --base "$2" --title "$3" --body "$4$FOOTER"
}
pr migration/foundation-v4 main "Inventory v4, size tokens, th scope, field errors, themed Button link/ghost" \
  "Inventory status rule v4 (button triage + conformance, Button Triage sheet, History), --size-* tokens for arbitrary lengths, th scope, profile field errors, stock link/ghost Button variants themed to the app (icon sizes require aria-label), react/button-has-type, pixel/style probe baselines. Gates: tsc, lint, npm test, build, full Playwright."
pr migration/buttons-icon migration/foundation-v4 "Buttons by role 1/3: icon-only controls -> Button ghost + icon (16)" \
  "16 icon-only buttons. Sizes unchanged; sweep, overlays, login pixels identical; probe updated for display/justify/radius only. Keyboard + accessible-name spot-check added. Disclosure toggles stay native."
pr migration/buttons-link migration/buttons-icon "Buttons by role 2/3: link-styled actions -> Button variant=link (23)" \
  "23 link-styled buttons keep their semantic class. Nothing in the probe, sweep, overlays or login changed. The library Back specimen stays native (.link would recolour it)."
pr migration/buttons-nav migration/buttons-link "Buttons by role 3/3: navigating buttons -> links" \
  "Global search, notifications, customer search, billing back, customer actions, product tiles become real links through the router Link. History-back and disabled journeys stay buttons. .menu-item gains a token focus ring. Probe updated for button -> link on search results."
