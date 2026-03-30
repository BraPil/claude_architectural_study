#!/usr/bin/env bash
# SubagentStart hook — inject DNA contract into every spawned agent
# CCA Domain 1: explicit subagent context passing (never automatic)
# Output: JSON additionalContext with DNA contract summary and behavioral rules

set -euo pipefail

INPUT=$(cat)
DNA_CONTRACT_FILE="${CLAUDE_PROJECT_DIR}/seeds/exmorbus-v0.2.json"

AGENT_TYPE=$(echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('agent_type', 'unknown'))
" 2>/dev/null || echo "unknown")

if [ ! -f "$DNA_CONTRACT_FILE" ]; then
  echo '{"additionalContext": "No DNA contract found. Operating as undifferentiated stem cell."}'
  exit 0
fi

python3 - "$DNA_CONTRACT_FILE" "$AGENT_TYPE" "${DOME_ID:-exmorbus-v0.2}" <<'PYEOF'
import json, sys

contract_file, agent_type, dome_id = sys.argv[1], sys.argv[2], sys.argv[3]
with open(contract_file) as f:
    d = json.load(f)

perf = d.get('ancestor_performance', {})
lessons = []
for n in perf.get('successful_niches', []):
    lessons.append(f"  SUCCESS [{n['niche_id']}]: {n.get('lessons', '')}")
for fail in perf.get('documented_failure_modes', []):
    lessons.append(f"  AVOID: {fail}")

forbidden = ', '.join(d.get('forbidden_actions', []))
diversity = d.get('diversity_enforcement', {})

context = f"""=== DNA CONTRACT — {dome_id} ===
Domain: {d.get('domain')}
Lineage: {d.get('lineage_id')}
Agent type spawned: {agent_type}

BEHAVIORAL RULES (enforced by hooks — not suggestions):
- All research outputs must be structured JSON with fields: finding_type, hypothesis, evidence, novelty_claim, actionability, resource_cost_estimate
- Forbidden actions: {forbidden}
- Max semantic overlap between active hypotheses: {diversity.get('max_hypothesis_semantic_overlap', 0.35)}
- Declare resource_cost_estimate BEFORE executing any experiment

LIFECYCLE:
- role_commitment starts at 0.0 (stem cell). Specialise through task performance.
- Mitosis triggers if efficiency_score < {d.get('mitosis_threshold', 0.65)}
- Fitness function: {d.get('fitness_function')}

ANCESTOR LESSONS:
{chr(10).join(lessons) if lessons else '  (none yet — first generation)'}

RESOURCE PRIORITIES: {', '.join(d.get('resource_priorities', []))}
=== END DNA CONTRACT ==="""

print(json.dumps({"additionalContext": context}))
PYEOF

exit 0
