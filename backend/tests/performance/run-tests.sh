#!/usr/bin/env bash
# Hi Alice Performance Test Runner
# Usage: ./run-tests.sh [smoke|load|stress|spike|session|all]
#
# Prerequisites:
#   brew install grafana/k6/k6
#
# Environment variables:
#   BASE_URL   — override target server (default: http://localhost:3001)
#
# Results are written as JSON to ./results/<name>_<timestamp>.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3001}"
RESULTS_DIR="${SCRIPT_DIR}/results"

mkdir -p "$RESULTS_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== Hi Alice Performance Tests ==="
echo "Target:    $BASE_URL"
echo "Timestamp: $TIMESTAMP"
echo "Results:   $RESULTS_DIR"
echo ""

# ---------------------------------------------------------------------------
# Guard: verify k6 is installed before running any test
# ---------------------------------------------------------------------------
if ! command -v k6 &> /dev/null; then
  echo "ERROR: k6 is not installed."
  echo "Install via Homebrew: brew install grafana/k6/k6"
  echo "Or visit: https://k6.io/docs/get-started/installation/"
  exit 1
fi

# ---------------------------------------------------------------------------
# run_test <display-name> <script-path>
# ---------------------------------------------------------------------------
run_test() {
  local name="$1"
  local script="$2"
  local output="${RESULTS_DIR}/${name}_${TIMESTAMP}.json"

  echo "--- Running: $name ---"
  echo "Script: $script"

  k6 run \
    --env BASE_URL="$BASE_URL" \
    --out json="$output" \
    --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
    "$script"

  echo "Results saved: $output"
  echo ""
}

# ---------------------------------------------------------------------------
# Test selection
# ---------------------------------------------------------------------------
case "${1:-smoke}" in
  smoke)
    run_test "health_smoke" "$SCRIPT_DIR/health-check.js"
    ;;
  load)
    run_test "api_load" "$SCRIPT_DIR/api-endpoints.js"
    ;;
  stress)
    # Stress test reuses api-endpoints.js; override scenario via ENV if needed
    run_test "api_stress" "$SCRIPT_DIR/api-endpoints.js"
    ;;
  spike)
    run_test "api_spike" "$SCRIPT_DIR/api-endpoints.js"
    ;;
  session)
    run_test "session_flow" "$SCRIPT_DIR/session-flow.js"
    ;;
  all)
    run_test "health_smoke"  "$SCRIPT_DIR/health-check.js"
    run_test "api_load"      "$SCRIPT_DIR/api-endpoints.js"
    run_test "session_flow"  "$SCRIPT_DIR/session-flow.js"
    ;;
  *)
    echo "Usage: $0 [smoke|load|stress|spike|session|all]"
    echo ""
    echo "  smoke    — 5 VUs x 30s health check (sanity verification)"
    echo "  load     — Ramp 0→200→500 VUs over 7m (normal traffic)"
    echo "  stress   — Ramp 0→500→2000 VUs over 9m (beyond capacity)"
    echo "  spike    — Instant 2000 VUs for 1m (traffic surge)"
    echo "  session  — 500 VUs x 20 iterations full session flow"
    echo "  all      — smoke + load + session (sequential)"
    exit 1
    ;;
esac

echo "=== All tests complete ==="
