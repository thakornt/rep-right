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

found=0
for pid in $(lsof -nP -iTCP -sTCP:LISTEN -t 2>/dev/null | sort -u); do
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | tail -1)"
  [[ "$cwd" == "$root"* ]] || continue
  ports="$(lsof -nP -a -p "$pid" -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $9}' | tr '\n' ' ')"
  echo "rep-right pid $pid on ${ports}(${cwd#"$root"/})"
  found=1
  $list_only && continue
  # Its parent too, when that is the `next dev` or `go run` that would restart it.
  parent="$(ps -o ppid= -p "$pid" | tr -d ' ')"
  if ps -o command= -p "$parent" 2>/dev/null | grep -qE 'next dev|go run'; then kill "$parent" 2>/dev/null || true; fi
  kill "$pid" 2>/dev/null || true
done

[[ $found -eq 0 ]] && echo "no rep-right dev server running"
exit 0
