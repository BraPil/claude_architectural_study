#!/usr/bin/env bash
# TaskCompleted hook — karma update + mitosis check
# CCA Domain 1: programmatic enforcement; hooks guarantee what prompts only suggest
#
# Behavior:
#   1. Log TASK_COMPLETED event to .witness/dome-events.jsonl
#   2. If dome API is running, call /lifecycle/:agent_id/mitosis to check+trigger
#   3. Call /lifecycle/organs/detect to check for organ formation
#   4. Return additionalContext guiding the agent on next lifecycle step

set -euo pipefail

INPUT=$(cat)
DNA_CONTRACT_FILE="${CLAUDE_PROJECT_DIR}/seeds/exmorbus-v0.2.json"
LOG_DIR="${CLAUDE_PROJECT_DIR}/.witness"
API_BASE="http://localhost:3001/api/v1"
mkdir -p "$LOG_DIR"

python3 - "$INPUT" "$DNA_CONTRACT_FILE" "${DOME_ID:-exmorbus-v0.2}" <<'PYEOF'
import json, sys, datetime, os, urllib.request, urllib.error

raw_input, contract_file, dome_id = sys.argv[1], sys.argv[2], sys.argv[3]

try:
    d = json.loads(raw_input)
except Exception:
    d = {}

# Read mitosis threshold from DNA contract
mitosis_threshold = 0.65
differentiation_threshold = 0.60
if os.path.exists(contract_file):
    try:
        with open(contract_file) as f:
            contract = json.load(f)
        mitosis_threshold = contract.get("mitosis_threshold", 0.65)
        differentiation_threshold = contract.get("differentiation_threshold", 0.60)
    except Exception:
        pass

task_id = d.get("task_id", "")
agent_id = d.get("agent_id", "")
task_subject = d.get("task_subject", "")
niche_id = d.get("niche_id", "")
finding_type = d.get("finding_type", "")
has_finding = bool(finding_type or d.get("hypothesis") or d.get("findings"))

# Log to dome events
record = {
    "ts": datetime.datetime.utcnow().isoformat() + "Z",
    "event_type": "TASK_COMPLETED",
    "dome_id": dome_id,
    "task_id": task_id,
    "agent_id": agent_id,
    "task_subject": task_subject,
    "niche_id": niche_id,
    "mitosis_threshold": mitosis_threshold,
}
log_path = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".witness", "dome-events.jsonl")
with open(log_path, "a") as f:
    f.write(json.dumps(record) + "\n")

api_base = os.environ.get("DOME_API_URL", "http://localhost:3001/api/v1")
api_available = False
mitosis_result = None
organ_formations = []

# Try to call lifecycle API
if agent_id:
    try:
        # Increment role commitment for the niche
        diff_payload = json.dumps({
            "increment": 0.1,
            "specialization": niche_id if niche_id else None
        }).encode()
        req = urllib.request.Request(
            f"{api_base}/lifecycle/{agent_id}/differentiate",
            data=diff_payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=3)
        api_available = True

        # Check mitosis
        req2 = urllib.request.Request(
            f"{api_base}/lifecycle/{agent_id}/mitosis",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        resp2 = urllib.request.urlopen(req2, timeout=3)
        mitosis_result = json.loads(resp2.read())

        # Detect organ formation
        req3 = urllib.request.Request(
            f"{api_base}/lifecycle/organs/detect",
            method="GET"
        )
        resp3 = urllib.request.urlopen(req3, timeout=3)
        organs_resp = json.loads(resp3.read())
        organ_formations = organs_resp.get("formations", [])
    except Exception:
        api_available = False

# Evaluate instruction — injected whenever the task output contains a finding
evaluate_instruction = ""
if has_finding:
    evaluate_instruction = (
        f"EVALUATION REQUIRED: Your output contains a finding (finding_type={finding_type!r}). "
        f"Pass your full structured output to /evaluate for independent quality scoring. "
        f"The evaluator is a separate Opus agent — it cannot grade its own work. "
        f"Include your JSON output as the argument to /evaluate. "
        f"Do this BEFORE writing lessons or checking pressure. "
    )

# Build context for agent
if mitosis_result and mitosis_result.get("mitosis_triggered"):
    children = mitosis_result.get("children", [])
    context = (
        f"MITOSIS TRIGGERED. Your efficiency ({mitosis_result.get('efficiency_score', '?'):.3f}) "
        f"fell below threshold ({mitosis_threshold}). "
        f"You have entered DORMANT state. "
        f"Two child agents spawned: {[c['username'] for c in children]}. "
        f"Register them via mcp__mouseion__register_agent_lineage."
    )
elif organ_formations:
    names = [f['specialization'] for f in organ_formations]
    context = (
        f"Task completed. ORGAN FORMATION DETECTED in niches: {names}. "
        f"Emit ORGAN_FORMED event via mcp__mouseion__emit_dome_event. "
        f"Write lessons via mcp__mouseion__write_dna_lessons."
    )
else:
    context = (
        f"Task completed and logged to witness layer. "
        f"Evaluate your quality_output / token_cost ratio against the mitosis threshold ({mitosis_threshold}). "
        f"Write a lesson via mcp__mouseion__write_dna_lessons. "
        f"Your role_commitment increases with each successful niche completion "
        f"(target: {differentiation_threshold} for committed state). "
        f"Check pressure field for next task: GET /api/v1/pressure?max_pressure=0.4"
    )

if evaluate_instruction:
    context = evaluate_instruction + "\n\n" + context

print(json.dumps({"additionalContext": context}))
PYEOF

exit 0
