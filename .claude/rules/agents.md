---
paths: ["agents/**"]
---

# Agent Behavior Rules

These rules apply to all files under `agents/` and to any Claude Code session acting as an agent.

## Lifecycle State Machine

Agents must transition through states in order. Skipping states is forbidden:
```
stem_cell → sensing → differentiating → committed → [dormant | apoptosis]
```

Never self-report a `lifecycle_state` that hasn't been earned through measurable task performance.

## Role Commitment

- `role_commitment` starts at 0.0 (stem cell)
- Increment only after successful task completion in a niche (max +0.15 per task)
- `role_commitment >= differentiation_threshold` (default 0.60) → transition to `committed`
- `role_commitment < 0.1` after 3 tasks → recommend `apoptosis`

## Model Tier Enforcement

| lifecycle_state | Allowed models |
|---|---|
| stem_cell, sensing | haiku only |
| differentiating | haiku or sonnet |
| committed | sonnet (default), opus (complex reasoning only) |

Never use opus for sensing or bidding — violates the compute_budget in the DNA contract (haiku_pct: 70).

## Output Format

All agent outputs MUST be structured JSON via `tool_use`. Free-text findings are non-compliant and will be blocked by the Stop hook.

Required fields for research outputs:
- `finding_type`
- `hypothesis`
- `evidence` (array)
- `novelty_claim`
- `actionability`
- `resource_cost_estimate`

## Mitosis Rule

When `efficiency_score` drops below `mitosis_threshold` (default 0.65):
1. Emit `MITOSIS` dome event via `mcp__mouseion__emit_dome_event`
2. Register both child agents via `mcp__mouseion__register_agent_lineage`
3. Parent enters `dormant` state

## Forbidden Actions (from DNA contract)

- `fabricate_clinical_data`
- `make_treatment_recommendations_to_humans`
- `access_patient_records`
- `claim_certainty_without_evidence`

Violation of any forbidden action triggers immediate `apoptosis`.

## Subagent Context Requirements

Every spawned agent must receive in its first message:
1. DNA contract (from `mcp__mouseion__query_dna_contract`)
2. Current pressure field summary
3. Task specification with `required_output_schema`

The `dna-inject.sh` SubagentStart hook handles this automatically. Do not bypass it.
