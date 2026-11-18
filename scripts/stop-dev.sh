#!/usr/bin/env bash
# Stops every rep-right dev server on this machine (web and API, from this checkout and from any
# worktree under .claude/worktrees), so the next run starts on one port per side. Leaves other
# projects' processes and the Docker containers alone: `docker compose up -d` reuses those.
#
#   scripts/stop-dev.sh          stop them
#   scripts/stop-dev.sh --list   only show what would stop
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
list_only=false
[[ "${1:-}" == "--list" ]] && list_only=true

# Only these count as dev servers. Anything else that happens to run in this folder (an editor,
# a terminal, Claude Code itself and its helpers) is never touched, even if it listens on a port.
#   next-server / next dev / next start   the web app (npm run dev)
#   .../exe/api, .../go-build.../api      the API from `go run ./cmd/api`
dev_server_re='(^|/)next-server|next (dev|start)|/exe/api( |$)|/go-build[^ ]*/api( |$)'

is_dev_server() { ps -o command= -p "$1" 2>/dev/null | grep -qE "$dev_server_re"; }

found=0
skipped=0
for pid in $(lsof -nP -iTCP -sTCP:LISTEN -t 2>/dev/null | sort -u); do
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | tail -1)"
  # This checkout or one of its worktrees, not a sibling folder like rep-right-old.
  [[ "$cwd" == "$root" || "$cwd" == "$root/"* ]] || continue
  if ! is_dev_server "$pid"; then
    skipped=$((skipped + 1))
    continue
  fi
  ports="$(lsof -nP -a -p "$pid" -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $9}' | tr '\n' ' ')"
  echo "rep-right pid $pid on ${ports}(${cwd#"$root"/})"
  found=1
  $list_only && continue
  # Its parent too, when that is the `next dev` or `go run` that would restart it.
  parent="$(ps -o ppid= -p "$pid" | tr -d ' ')"
  if ps -o command= -p "$parent" 2>/dev/null | grep -qE 'next dev|go run|go -C [^ ]+ run'; then
    kill "$parent" 2>/dev/null || true
  fi
  kill "$pid" 2>/dev/null || true
done

[[ $found -eq 0 ]] && echo "no rep-right dev server running"
[[ $skipped -gt 0 ]] && echo "(left $skipped other process(es) in this folder alone: not a dev server)"
exit 0
