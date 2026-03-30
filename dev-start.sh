#!/usr/bin/env bash
# dev-start.sh — Start witness dashboard for local development (no Docker required)
# Usage: ./dev-start.sh [port]
#
# Starts only the witness observer on the given port (default 9000).
# The full Docker stack (dome-api, postgres, redis) is NOT required for observation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-9000}"

echo "Starting Witness Observer on http://localhost:${PORT}"
echo "Watching: ${SCRIPT_DIR}/.witness/"
echo "Press Ctrl+C to stop."
echo ""

exec env \
  CLAUDE_PROJECT_DIR="${SCRIPT_DIR}" \
  WITNESS_PORT="${PORT}" \
  DOME_ID="${DOME_ID:-exmorbus-v0.2}" \
  node "${SCRIPT_DIR}/witness/server.js"
