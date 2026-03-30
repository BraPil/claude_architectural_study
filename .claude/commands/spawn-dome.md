---
description: Spawn a sibling dome from a CAPACITY_SATURATED signal. Reads the spawn queue, selects the next pending spawn recommendation, creates a new DNA contract seeded from the parent, and emits the SPAWN_REQUEST event.
argument-hint: <dome_id to spawn, or leave blank to read spawn queue>
context: fork
allowed-tools: Read, Write, Bash, Glob, Grep
model: claude-sonnet-4-6
---

# Spawn Dome Agent

You are executing a **sibling dome spawn** from the Mouseion spawn controller.

**Trigger:** CAPACITY_SATURATED event from a saturated dome
**Model tier:** Sonnet (DNA contract design + spawn coordination)

---

## Step 1 — Read Spawn Queue

```bash
cat .witness/spawn-queue.jsonl 2>/dev/null | python3 -c "
import sys, json
pending = []
for line in sys.stdin:
    try:
        e = json.loads(line.strip())
        if e.get('status') == 'pending_human_review':
            pending.append(e)
    except: pass
print(json.dumps(pending, indent=2))
" || echo "Spawn queue empty"
```

If $ARGUMENTS is provided, use that as the target dome domain. Otherwise, use the first `pending_human_review` item.

---

## Step 2 — Select Sibling Domain

Map the suggested domain to a DNA contract template:

| Domain | Suggested by | DNA Template |
|---|---|---|
| `disease_vectors` | ExMorbus CAPACITY_SATURATED | seeds/disease-vectors-v0.1.json |
| `toxicity_vectors` | Disease Vectors CAPACITY_SATURATED | seeds/toxicity-vectors-v0.1.json |
| `drug_discovery` | Any oncology dome | seeds/drug-discovery-v0.1.json |

```bash
# Load parent contract for inheritance
cat seeds/exmorbus-v0.2.json
```

Extract from parent:
- `resource_priorities` — inherit with domain-specific modifications
- `mitosis_threshold`, `apoptosis_threshold` — inherit
- `fitness_function` — adapt to new domain
- `ancestor_performance.successful_niches` — becomes inheritance for child dome

---

## Step 3 — Design Child DNA Contract

Create the child dome DNA contract by:
1. Starting from the domain-appropriate template
2. Setting `parent_contract_id` to the parent's `lineage_id`
3. Seeding `ancestor_performance.parent_domain_lessons` from parent's documented lessons
4. Adjusting `resource_priorities` for the new domain
5. Setting new `domain` and `lineage_id`

The child contract MUST be a proper fork — not a copy — with:
- Different `lineage_id` (e.g., `disease-vectors-v0.1`)
- Different `domain` (e.g., `disease_vector_research`)
- Inherited mitosis/apoptosis thresholds
- Adapted `fitness_function` for new domain
- `crossover_fields` listing which fields were inherited from parent

---

## Step 4 — Write Child Contract

```bash
# Write the new dome's DNA contract
cat > seeds/<new_dome_id>.json << 'EOF'
<evolved_contract_json>
EOF
```

---

## Step 5 — Register + Emit Events

Register the new dome's first stem cell:
- Tool: `mcp__mouseion__register_agent_lineage`
- `agent_id`: `<new_dome_id>-genesis-stem-cell`
- `parent_agent_id`: null
- `dome_id`: `<new_dome_id>`
- `generation`: 0
- `specialization_hint`: first niche from new contract

Emit spawn request:
- Tool: `mcp__mouseion__emit_dome_event`
- `event_type`: "SPAWN_REQUEST"
- `source_dome_id`: `exmorbus-v0.2`
- `target_dome_id`: `<new_dome_id>`
- `payload`:
```json
{
  "new_dome_id": "<id>",
  "new_domain": "<domain>",
  "seed_contract_file": "seeds/<new_dome_id>.json",
  "inherited_from": "exmorbus-v0.2",
  "trigger": "CAPACITY_SATURATED"
}
```

Update spawn queue entry status:
```bash
# Mark spawn as executed
python3 -c "
import json
entry = {'status': 'executed', 'executed_at': '$(date -u +%Y-%m-%dT%H:%M:%SZ)', 'new_dome_id': '<id>'}
with open('.witness/spawn-queue.jsonl', 'a') as f:
    f.write(json.dumps(entry) + '\n')
"
```

---

## Step 6 — Output

```json
{
  "agent_role": "spawn_dome",
  "finding_type": "dome_spawn",
  "hypothesis": "Sibling dome can absorb overflow specializations from saturated parent",
  "spawned_dome_id": "<id>",
  "parent_dome_id": "exmorbus-v0.2",
  "seed_contract": "<path to new contract>",
  "evidence": [{"source": "spawn_queue", "claim": "CAPACITY_SATURATED triggered spawn", "confidence": "high"}],
  "novelty_claim": "FunSearch island model: new isolated sub-population for divergent evolution",
  "actionability": "Run /stem-cell in new dome to begin population",
  "resource_cost_estimate": {"tokens_used": 0, "model": "sonnet"}
}
```

---

## Step 7 — Write Transfer Lesson

Record the gene transfer for DNA evolution:
- Tool: `mcp__mouseion__emit_dome_event`
- `event_type`: "HORIZONTAL_GENE_TRANSFER"
- `payload`:
```json
{
  "from_dome": "exmorbus-v0.2",
  "to_dome": "<new_dome_id>",
  "transferred_fields": ["resource_priorities", "mitosis_threshold", "fitness_evaluation_criteria"],
  "mutation_applied": "<what was changed for the new domain>"
}
```
