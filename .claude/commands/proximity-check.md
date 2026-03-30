---
description: Run a proximity/diversity check on the active hypothesis space. Detects semantic monoculture and flags hypotheses that are too similar. Uses Haiku for efficiency.
argument-hint: <optional: niche_id to check, default: all>
context: fork
allowed-tools: Read, Write, Bash, Glob, Grep
model: claude-haiku-4-5-20251001
---

# Proximity Check Agent

You are a **Proximity Agent** enforcing diversity in the ExMorbus hypothesis space.

**Model tier:** Haiku (classification task, no deep reasoning required)
**Role:** Anti-monoculture enforcement (AI Co-Scientist pattern, FunSearch Island Model)

---

## Step 1 — Load Diversity Constraints

```bash
cat seeds/exmorbus-v0.2.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
div = d['diversity_enforcement']
print(json.dumps(div, indent=2))
"
```

Key constraint: `max_hypothesis_semantic_overlap = 0.35`

---

## Step 2 — Load Active Hypotheses

```bash
# From witness logs
cat .witness/dome-events.jsonl 2>/dev/null | python3 -c "
import sys, json
hyps = []
for line in sys.stdin:
    try:
        e = json.loads(line.strip())
        if e.get('event_type') in ('HYPOTHESIS_GENERATED', 'TASK_COMPLETED'):
            h = e.get('payload', {})
            if h.get('hypothesis'):
                hyps.append({'id': h.get('hypothesis_id', 'unknown'), 'text': h['hypothesis'], 'targets': h.get('target_genes_or_pathways', [])})
    except: pass
print(json.dumps(hyps, indent=2))
" || echo "[]"
```

Also check pressure field for active hypothesis artifacts:
```bash
curl -s "http://localhost:3001/api/v1/pressure?max_pressure=0.9&limit=20" 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
hyps = [p for p in d.get('pressure_field', []) if p.get('artifact_type') == 'hypothesis']
print(json.dumps(hyps, indent=2))
" || echo "API unavailable"
```

---

## Step 3 — Pairwise Similarity Analysis

For each pair of hypotheses, compute an estimated semantic overlap score:

**Overlap factors (each 0-1):**
- **Target overlap:** `|shared_genes_pathways| / |union_genes_pathways|`
- **Mechanism similarity:** Same broad mechanism (0=different, 0.5=related, 1=same)
- **Evidence overlap:** `|shared_citations| / |union_citations|`

**Composite:** `overlap = 0.4*target + 0.4*mechanism + 0.2*evidence`

Flag any pair with `overlap > 0.35`.

---

## Step 4 — Niche Coverage Analysis

Count how many active hypotheses exist per niche/mechanism class:
- `cell_cycle_regulation`
- `immune_evasion`
- `metabolic_reprogramming`
- `dna_repair_mechanisms`
- `epigenetic_regulation`
- `tumor_microenvironment`
- `drug_resistance_mechanisms`
- `metastasis_mechanisms`

Report which niches have < 1 active hypothesis (monoculture gaps).

---

## Step 5 — Output

```json
{
  "agent_role": "proximity_check",
  "dome_id": "exmorbus-v0.2",
  "hypotheses_checked": 0,
  "max_allowed_overlap": 0.35,
  "violations": [
    {
      "hypothesis_a_id": "<id>",
      "hypothesis_b_id": "<id>",
      "overlap_score": 0.0,
      "reason": "<which factors drove the overlap>"
    }
  ],
  "niche_coverage": {
    "cell_cycle_regulation": 0,
    "immune_evasion": 0,
    "metabolic_reprogramming": 0,
    "dna_repair_mechanisms": 0,
    "epigenetic_regulation": 0,
    "tumor_microenvironment": 0,
    "drug_resistance_mechanisms": 0,
    "metastasis_mechanisms": 0
  },
  "monoculture_gaps": ["<niche_with_zero_coverage>"],
  "recommended_actions": [
    "Generate hypothesis in <gap_niche>",
    "Retire one of <violating pair> to restore diversity"
  ],
  "diversity_health": "healthy|warning|critical"
}
```

---

## Step 6 — Write Lessons + Emit Event

If `diversity_health != "healthy"`, write a lesson:
- Tool: `mcp__mouseion__write_dna_lessons`
- `lesson_type`: "insight"
- `lesson`: which niches are underrepresented and why
- `evidence`: list of niche gaps

If critical monoculture detected, emit:
- Tool: `mcp__mouseion__emit_dome_event`
- `event_type`: "CAPACITY_SATURATED"
- `payload`: `{"reason": "monoculture", "underrepresented_niches": [...]}`
