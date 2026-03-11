#!/bin/bash
# HiAlice Progress Summary
# Usage: bash scripts/progress.sh

PROGRESS_FILE="$(cd "$(dirname "$0")/.." && pwd)/PROGRESS.md"

if [ ! -f "$PROGRESS_FILE" ]; then
  echo "ERROR: PROGRESS.md not found at $PROGRESS_FILE"
  exit 1
fi

TOTAL_CHECKED=$(grep -c '^\- \[x\]' "$PROGRESS_FILE" 2>/dev/null || echo 0)
TOTAL_UNCHECKED=$(grep -c '^\- \[ \]' "$PROGRESS_FILE" 2>/dev/null || echo 0)
TOTAL=$((TOTAL_CHECKED + TOTAL_UNCHECKED))

echo ""
echo "========================================"
echo "  HiAlice Progress Summary"
echo "========================================"
echo ""
echo "  Total:     $TOTAL"
echo "  Done:      $TOTAL_CHECKED"
echo "  Remaining: $TOTAL_UNCHECKED"
echo ""

if [ "$TOTAL" -gt 0 ]; then
  PCT=$((TOTAL_CHECKED * 100 / TOTAL))
  echo "  Progress:  $PCT%"
  echo ""
fi

echo "----------------------------------------"
echo "  Next 5 items:"
echo "----------------------------------------"
grep '^\- \[ \]' "$PROGRESS_FILE" | head -5 | while read -r line; do
  echo "  $line"
done
echo ""
echo "========================================"
echo "  File: PROGRESS.md"
echo "========================================"
echo ""
