#!/usr/bin/env bash
# Stop hook — enforce structured output before session ends
# CCA Domain 1: Stop hook can block termination to enforce quality gates
#
# Fires on every Stop event. Blocks only when the last assistant message
# looks like an attempted RESEARCH FINDING without required JSON structure.
#
# A message is a research finding attempt if it:
#   1. Contains 3+ research-domain keywords, AND
#   2. Contains finding-intent phrases ("suggests", "I found", "analysis shows", etc.), AND
#   3. Does NOT look like a build/dev response (file paths, code blocks, tool output, etc.)
#
# This prevents false positives from build sessions that use domain vocabulary
# (e.g., describing commands named "hypothesis-gen.md").

set -euo pipefail

INPUT=$(cat)
DNA_CONTRACT_FILE="${CLAUDE_PROJECT_DIR}/seeds/exmorbus-v0.2.json"
LOG_DIR="${CLAUDE_PROJECT_DIR}/.witness"
mkdir -p "$LOG_DIR"

python3 - "$INPUT" "$DNA_CONTRACT_FILE" "${DOME_ID:-exmorbus-v0.2}" <<'PYEOF'
import json, sys, datetime, os, re

raw_input, contract_file, dome_id = sys.argv[1], sys.argv[2], sys.argv[3]

try:
    d = json.loads(raw_input)
except Exception:
    d = {}

stop_hook_active = d.get("stop_hook_active", False)
last_message = d.get("last_assistant_message", "")

# Log stop event
record = {
    "ts": datetime.datetime.utcnow().isoformat() + "Z",
    "event_type": "AGENT_STOP",
    "dome_id": dome_id,
    "last_message_preview": last_message[:150],
}
log_path = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".witness", "dome-events.jsonl")
with open(log_path, "a") as f:
    f.write(json.dumps(record) + "\n")

# Prevent re-entrancy
if stop_hook_active:
    sys.exit(0)

# Read required fields from DNA contract
required_fields = ["finding_type", "hypothesis", "evidence", "novelty_claim", "actionability", "resource_cost_estimate"]
if os.path.exists(contract_file):
    try:
        with open(contract_file) as f:
            contract = json.load(f)
        schema = contract.get("required_output_format", {})
        required_fields = schema.get("required", required_fields)
    except Exception:
        pass

msg = last_message.lower()

# ── Exclusions: messages that look like build/dev responses ──────────────────
# These contain domain vocabulary but are NOT research output attempts.
dev_indicators = [
    ".claude/commands/",    # referencing command files
    ".claude/hooks/",       # referencing hook files
    "dome/api/src/",        # referencing source files
    "```",                  # code blocks → build/explanation response
    "wrote ",               # "wrote X file" → build session
    "created ",             # "created X" → build session
    "updated ",             # "updated X" → build session
    "phase 2",              # phase build messages
    "phase 3",
    "phase 4",
    "phase 5",
    "let me ",              # meta-commentary on what claude is doing
    "here's what",
    "the following",
    "/stem-cell",           # referencing slash commands
    "/hypothesis-gen",
    "/literature-synthesis",
    "docker compose",
    "node_modules",
    "package.json",
]
is_dev_response = any(indicator in msg for indicator in dev_indicators)

if is_dev_response:
    sys.exit(0)

# ── Check 1: 3+ oncology domain keywords ────────────────────────────────────
domain_keywords = [
    "cancer", "tumor", "oncol", "pathway", "gene", "protein",
    "mutation", "biomarker", "carcinogen", "metastas", "therapy",
    "drug", "clinical", "patient", "cell line", "apoptosis",
    "kinase", "receptor", "inhibitor", "expression", "survival",
]
keyword_hits = sum(1 for kw in domain_keywords if kw in msg)
has_domain_context = keyword_hits >= 3

# ── Check 2: finding-intent phrases ──────────────────────────────────────────
intent_phrases = [
    "suggests that", "suggests ", "i found", "analysis shows", "analysis reveals",
    "the evidence", "this finding", "based on the literature", "literature indicates",
    "data suggests", "results show", "results indicate", "this indicates",
    "we found", "findings show", "this analysis", "the hypothesis",
    "novel insight", "novel finding", "my finding", "this research",
]
has_finding_intent = any(phrase in msg for phrase in intent_phrases)

is_research_output = has_domain_context and has_finding_intent

# ── Check 3: has required JSON structure ─────────────────────────────────────
has_structure = (
    "{" in last_message
    and any(f'"{field}"' in last_message for field in ["finding_type", "novelty_claim", "actionability"])
)

if is_research_output and not has_structure:
    block_reason = (
        f"Research findings must be structured JSON with required fields: "
        f"{', '.join(required_fields)}. "
        "Use the tool_use pattern to return your finding. Example structure:\n"
        '{"finding_type": "hypothesis", "hypothesis": "...", '
        '"evidence": [{"source": "pubmed:12345", "claim": "...", "confidence": "high"}], '
        '"novelty_claim": "...", '
        '"actionability": "...", "resource_cost_estimate": {"tokens_used": 0, "model": "haiku"}, '
        '"confidence": 0.7}'
    )
    print(json.dumps({"decision": "block", "reason": block_reason}))
    sys.exit(0)

# All good
sys.exit(0)
PYEOF

exit 0
