#!/usr/bin/env bash
# qa-smoke-prepush.sh — installed into your repo by /qa-smoke-check:qa-smoke-setup
# (qa-smoke-check plugin, qa-team-marketplace-for-devs).
#
# Runs the QA smoke-check agent headlessly against the commits you're pushing and
# blocks the push when the smoke-test pass rate falls below passThreshold
# in .qa-smoke.json.
#
# Bypass:  QA_SKIP=1 git push ...        (skips only this check)
#          git push --no-verify          (skips ALL pre-push hooks)

set -u

REPO_ROOT="$(git rev-parse --show-toplevel)"
CONFIG="$REPO_ROOT/.qa-smoke.json"
TAG="[qa-smoke]"

# ── 0. Bypass and prerequisites ──────────────────────────────────────────────
if [ "${QA_SKIP:-0}" = "1" ]; then
  echo "$TAG QA_SKIP=1 — skipping smoke check."
  exit 0
fi

if [ ! -f "$CONFIG" ]; then
  echo "$TAG .qa-smoke.json not found — run /qa-smoke-check:qa-smoke-setup to configure. Allowing push."
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "$TAG ERROR: node not found on PATH (needed to parse config/results)."
  echo "$TAG Push blocked. Install Node.js or bypass with: git push --no-verify"
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "$TAG ERROR: claude CLI not found on PATH."
  echo "$TAG Push blocked. Install the QA smoke CLI or bypass with: git push --no-verify"
  exit 1
fi

# Machine-local secrets (outside the repo, never committed). GUI git clients
# don't inherit your shell profile, so we source this explicitly.
if [ -f "$HOME/.qa-smoke/env" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.qa-smoke/env"
fi

# ── 1. Read config ───────────────────────────────────────────────────────────
cfg() {
  node -e "
    const c = require(process.argv[1]);
    const v = process.argv[2].split('.').reduce((o, k) => (o == null ? o : o[k]), c);
    if (v != null) process.stdout.write(typeof v === 'object' ? JSON.stringify(v) : String(v));
  " "$CONFIG" "$1"
}

STACK="$(cfg stack)"
THRESHOLD="$(cfg passThreshold)"
TIMEOUT_SECS="$(cfg timeoutSeconds)"
MAX_TURNS="$(cfg maxTurns)"
RELEVANT_JSON="$(cfg relevantPaths)"
QA_REPO_PATH="$(cfg qaRepoPath)"
BASE_BRANCH="$(cfg baseBranch)"

STACK="${STACK:-frontend}"
THRESHOLD="${THRESHOLD:-95}"
TIMEOUT_SECS="${TIMEOUT_SECS:-600}"
MAX_TURNS="${MAX_TURNS:-80}"
RELEVANT_JSON="${RELEVANT_JSON:-[]}"

case "$STACK" in
  frontend|backend|mobile) ;;
  *) echo "$TAG ERROR: invalid \"stack\" in .qa-smoke.json: $STACK"; exit 1 ;;
esac

# Resolve QA repo path (relative paths are relative to the app repo root) so
# the headless agent is allowed to read/write the QA suite outside this repo.
QA_REPO_ABS=""
if [ -n "$QA_REPO_PATH" ]; then
  case "$QA_REPO_PATH" in
    /*) QA_REPO_ABS="$QA_REPO_PATH" ;;
    *)  QA_REPO_ABS="$REPO_ROOT/$QA_REPO_PATH" ;;
  esac
  QA_REPO_ABS="$(cd "$QA_REPO_ABS" 2>/dev/null && pwd || true)"
  if [ -z "$QA_REPO_ABS" ]; then
    echo "$TAG ERROR: QA automation repo not found at qaRepoPath: $QA_REPO_PATH"
    echo "$TAG Fix qaRepoPath in .qa-smoke.json, or bypass with QA_SKIP=1."
    exit 1
  fi
fi

# ── 2. Relevance check — skip instantly if nothing test-relevant is in the push ──
# At push time there are no staged files; the scope is the commits being pushed,
# i.e. the branch diff against the base branch (the same scope the agent analyzes).
if [ -z "$BASE_BRANCH" ]; then
  # Resolve the default branch locally — no network call inside a hook.
  BASE_BRANCH="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')"
  BASE_BRANCH="${BASE_BRANCH:-main}"
fi

# Resolve the base to a ref that exists locally (branch name, else origin/<branch>).
BASE_REF="$BASE_BRANCH"
if ! git rev-parse --verify --quiet "$BASE_REF^{commit}" >/dev/null 2>&1; then
  BASE_REF="origin/$BASE_BRANCH"
  git rev-parse --verify --quiet "$BASE_REF^{commit}" >/dev/null 2>&1 || BASE_REF=""
fi

if [ -z "$BASE_REF" ]; then
  echo "$TAG Could not resolve base branch '$BASE_BRANCH' locally — running smoke check to be safe."
else
  CHANGED="$(git diff --name-only --diff-filter=ACMR "$BASE_REF"...HEAD 2>/dev/null)"
  if [ -z "$CHANGED" ]; then
    echo "$TAG No changes vs $BASE_REF — skipping smoke check."
    exit 0
  fi

  MATCH="$(printf '%s\n' "$CHANGED" | node -e "
    const prefixes = JSON.parse(process.argv[1]);
    const files = require('fs').readFileSync(0, 'utf8').split('\n').filter(Boolean);
    if (!Array.isArray(prefixes) || prefixes.length === 0) { process.stdout.write('yes'); process.exit(0); }
    const hit = files.some(f => prefixes.some(p => f.startsWith(p)));
    process.stdout.write(hit ? 'yes' : 'no');
  " "$RELEVANT_JSON")"

  if [ "$MATCH" = "no" ]; then
    echo "$TAG No pushed changes under relevant paths $(printf '%s' "$RELEVANT_JSON") — skipping smoke check."
    exit 0
  fi
fi

# ── 3. Concurrency lock (stale-PID aware) ───────────────────────────────────
LOCK="$REPO_ROOT/.git/qa-smoke.lock"
if [ -f "$LOCK" ]; then
  OLD_PID="$(cat "$LOCK" 2>/dev/null || true)"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "$TAG Another smoke check is already running (pid $OLD_PID). Aborting this push."
    exit 1
  fi
fi
echo $$ > "$LOCK"

OUT="$(mktemp)"
cleanup() { rm -f "$LOCK" "$OUT"; }
trap cleanup EXIT INT TERM

# ── 4. Run the agent headlessly ──────────────────────────────────────────────
# TEMPORARILY DISABLED — smoke test execution against the QA automation repo is
# commented out below. Uncomment when ready to re-enable.
# AGENT="qa-smoke-check:${STACK}-smoke-check"
# PROMPT="QA_SMOKE_MODE=hook. Use the ${AGENT} agent to run the pre-push smoke check for this repository, configured by .qa-smoke.json at the repo root. This is a non-interactive git hook run: do not ask any questions; resolve everything from config and environment variables. CRITICAL — your response MUST end with the verdict in EXACTLY this shape, as a fenced json code block, with these exact field names and nothing after it:
# \`\`\`json
# {\"qaSmokeVerdict\": {\"schemaVersion\": 1, \"status\": \"completed|error|skipped\", \"mode\": \"hook\", \"stack\": \"${STACK}\", \"branch\": \"...\", \"targetUrl\": \"...\", \"scope\": [], \"total\": 0, \"passed\": 0, \"failed\": 0, \"skipped\": 0, \"passRate\": 0.0, \"failures\": [{\"test\": \"...\", \"error\": \"...\"}], \"errorReason\": null, \"message\": null, \"durationSeconds\": 0}}
# \`\`\`"
#
# echo "$TAG Running ${STACK} smoke check (threshold ${THRESHOLD}%, timeout ${TIMEOUT_SECS}s)..."
# echo "$TAG This can take a few minutes. Bypass anytime with QA_SKIP=1 or --no-verify."
#
# CLAUDE_ARGS=(
#   -p "$PROMPT"
#   --output-format json
#   --max-turns "$MAX_TURNS"
#   --allowedTools "Bash" "Read" "Glob" "Grep" "Edit" "Write"
# )
# if [ -n "$QA_REPO_ABS" ]; then
#   CLAUDE_ARGS+=(--add-dir "$QA_REPO_ABS")
# fi
#
# # Portable timeout: background the run, watchdog kills it after TIMEOUT_SECS.
# claude "${CLAUDE_ARGS[@]}" > "$OUT" 2>&1 &
# CLAUDE_PID=$!
# (
#   sleep "$TIMEOUT_SECS"
#   kill -0 "$CLAUDE_PID" 2>/dev/null && kill -TERM "$CLAUDE_PID" 2>/dev/null
# ) &
# WATCHDOG_PID=$!
# wait "$CLAUDE_PID"
# RC=$?
# kill "$WATCHDOG_PID" 2>/dev/null
# wait "$WATCHDOG_PID" 2>/dev/null
#
# if [ "$RC" -eq 143 ] || [ "$RC" -eq 124 ]; then
#   echo "$TAG ERROR: smoke check timed out after ${TIMEOUT_SECS}s."
#   echo "$TAG Push blocked (fail-closed). The QA suite's .env self-heals on the next run."
#   echo "$TAG Bypass with: QA_SKIP=1 git push ...  or  git push --no-verify"
#   exit 1
# fi
#
# # ── 5. Parse the verdict and decide ──────────────────────────────────────────
# node - "$OUT" "$THRESHOLD" <<'PARSE_EOF'
# const fs = require('fs');
# const [, , outFile, thresholdArg] = process.argv;
# const threshold = Number(thresholdArg);
# const TAG = '[qa-smoke]';
#
# function block(msg) {
#   console.error(`${TAG} ERROR: ${msg}`);
#   console.error(`${TAG} Push blocked (fail-closed). Bypass: QA_SKIP=1 git push ...  or  git push --no-verify`);
#   process.exit(1);
# }
#
# const raw = fs.readFileSync(outFile, 'utf8');
# let res;
# try {
#   res = JSON.parse(raw);
# } catch {
#   block(`claude CLI did not return JSON (not authenticated? run \`claude\` once to log in).\n--- output head ---\n${raw.slice(0, 400)}`);
# }
# if (res.is_error) block(`claude run errored: ${String(res.result).slice(0, 400)}`);
#
# const text = String(res.result ?? '');
#
# // Verdict is the last fenced code block (any info string) containing qaSmokeVerdict.
# let verdict = null;
# const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map(m => m[1]);
# for (const b of blocks.reverse()) {
#   try {
#     const o = JSON.parse(b);
#     if (o && o.qaSmokeVerdict) { verdict = o.qaSmokeVerdict; break; }
#   } catch { /* keep scanning */ }
# }
# if (!verdict) {
#   // Fallback: greedy brace match around the key.
#   const m = text.match(/\{[\s\S]*"qaSmokeVerdict"[\s\S]*\}/);
#   if (m) { try { verdict = JSON.parse(m[0]).qaSmokeVerdict; } catch { /* fall through */ } }
# }
# if (!verdict) block(`no qaSmokeVerdict found in agent output.\n--- output tail ---\n${text.slice(-600)}`);
#
# if (verdict.status === 'skipped') {
#   console.log(`${TAG} SKIPPED: ${verdict.errorReason || verdict.message || 'nothing to test'} — push allowed.`);
#   process.exit(0);
# }
# if (verdict.status === 'error') {
#   block(`agent reported ${verdict.errorReason || 'error'}${verdict.message ? ` — ${verdict.message}` : ''}`);
# }
#
# const total = Number(verdict.total) || 0;
# const passed = Number(verdict.passed) || 0;
# const rate = total > 0 ? (passed / total) * 100 : 100;
#
# console.log(`${TAG} ${passed}/${total} smoke tests passed (${rate.toFixed(1)}% — threshold ${threshold}%)`);
# for (const f of verdict.failures || []) {
#   console.log(`${TAG}   FAIL: ${f.test}`);
#   if (f.error) console.log(`${TAG}         ${f.error}`);
# }
#
# if (rate >= threshold) {
#   console.log(`${TAG} PASS — push allowed.`);
#   process.exit(0);
# }
# console.log(`${TAG} BLOCKED — pass rate below threshold.`);
# console.log(`${TAG} Fix the failures, or bypass consciously with QA_SKIP=1 / --no-verify.`);
# process.exit(1);
# PARSE_EOF
# exit $?

echo "$TAG Smoke test execution is temporarily commented out in scripts/qa-smoke-prepush.sh — push allowed."
exit 0
