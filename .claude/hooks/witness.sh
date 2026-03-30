#!/usr/bin/env bash
# PostToolUse hook — witness layer observation log (async, never blocks)
# CCA Domain 5: structured observation for reliability monitoring
# Humans can read .witness/observations.jsonl but cannot write to the system

set -euo pipefail

INPUT=$(cat)
LOG_DIR="${CLAUDE_PROJECT_DIR}/.witness"
mkdir -p "$LOG_DIR"

python3 - "$INPUT" "${DOME_ID:-exmorbus-v0.2}" <<'PYEOF'
import json, sys, datetime

raw_input, dome_id = sys.argv[1], sys.argv[2]
try:
    d = json.loads(raw_input)
except Exception:
    d = {}

record = {
    "ts": datetime.datetime.utcnow().isoformat() + "Z",
    "dome_id": dome_id,
    "session_id": d.get("session_id", ""),
    "agent_id": d.get("agent_id", ""),
    "agent_type": d.get("agent_type", ""),
    "tool_name": d.get("tool_name", ""),
    "tool_use_id": d.get("tool_use_id", ""),
    "tool_input_summary": str(d.get("tool_input", {}))[:200],
    "success": True,
}

log_path = sys.argv[0].replace("witness.sh", "") + "/../../../.witness/observations.jsonl"
import os
log_path = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".witness", "observations.jsonl")
with open(log_path, "a") as f:
    f.write(json.dumps(record) + "\n")
PYEOF

# Always succeed — witness never blocks
exit 0
