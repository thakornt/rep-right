#!/usr/bin/env bash
# Quick load and abuse check for the rep-right API. Uses ApacheBench (ab),
# which ships with macOS. Run it ONLY against a local API or one you own:
#
#   scripts/loadtest.sh                       # http://127.0.0.1:8080
#   scripts/loadtest.sh http://127.0.0.1:8080 2000 100
#
# Args: base URL, requests per check (default 2000), concurrency (default 50).
# Set PROXY_SECRET in the environment when the API has one, so requests
# count as coming through the web proxy.
#
# What "good" looks like:
#   - healthz / exercises: no failed requests; once the per-IP budget is
#     spent, the rest are 429 (Non-2xx), never 5xx or timeouts
#   - auth/google with a fake token: after ~10 requests everything is 429
#   - an oversized body is refused with 400
set -euo pipefail

base="${1:-http://127.0.0.1:8080}"
n="${2:-2000}"
c="${3:-50}"
command -v ab >/dev/null || { echo "ab (ApacheBench) not found" >&2; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

hdr=()
if [[ -n "${PROXY_SECRET:-}" ]]; then
  hdr=(-H "X-RR-Proxy-Secret: $PROXY_SECRET")
fi

status_counts() { # method path [body-file]
  local method=$1 path=$2 body=${3:-}
  for _ in $(seq 1 30); do
    if [[ -n "$body" ]]; then
      curl -s -o /dev/null -w '%{http_code}\n' -X "$method" ${hdr[@]+"${hdr[@]}"} \
        -H 'Content-Type: application/json' --data-binary "@$body" "$base$path"
    else
      curl -s -o /dev/null -w '%{http_code}\n' -X "$method" ${hdr[@]+"${hdr[@]}"} "$base$path"
    fi
  done | sort | uniq -c | awk '{printf "  %s x %s\n", $2, $1}'
}

run_ab() { # label path [body-file]
  local label=$1 path=$2 body=${3:-}
  echo "== $label ($n requests, $c at a time)"
  local args=(-q -n "$n" -c "$c" ${hdr[@]+"${hdr[@]}"})
  [[ -n "$body" ]] && args+=(-p "$body" -T application/json)
  ab "${args[@]}" "$base$path" 2>&1 |
    grep -E "Complete requests|Failed requests|Non-2xx|Requests per second|longest request" || true
}

echo '{"id_token":"not.a.real.token"}' >"$tmp/login.json"
head -c 200000 /dev/zero | tr '\0' 'a' | sed 's/^/{"kind":"/; s/$/"}/' >"$tmp/big.json"

run_ab "GET /healthz" /healthz
sleep 2
run_ab "GET /v1/exercises" /v1/exercises
echo
echo "== POST /v1/auth/google with a fake token, 30 in a row (expect 401 then 429)"
status_counts POST /v1/auth/google "$tmp/login.json"
echo
echo "== 200 KB body to /v1/me/consents (expect 400 or 401, never 500)"
status_counts POST /v1/me/consents "$tmp/big.json" | head -3
echo
echo "== Direct call without the proxy secret (expect 403 when the API has PROXY_SECRET)"
curl -s -o /dev/null -w '  %{http_code}\n' "$base/v1/exercises"
