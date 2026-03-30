---
description: Execute horizontal gene transfer between domes — share high-fitness DNA contract fields from one dome to another via the Mouseion. Implements FunSearch island migration pattern.
argument-hint: <source_dome_id> <target_dome_id>
context: fork
allowed-tools: Read, Write, Bash, Glob, Grep
model: claude-sonnet-4-6
---

# Horizontal Gene Transfer Agent

You are executing **horizontal gene transfer** between domes via the Mouseion.

**Pattern:** FunSearch Island Model (DeepMind Nature 2023)
- Isolated sub-populations (domes) occasionally exchange high-fitness genetic material
- Prevents echo chambers in individual domes
- Maintains cross-domain knowledge without merging populations

**Arguments:** $ARGUMENTS (format: `<source_dome_id> <target_dome_id>`)

---

## Step 1 — Load Both DNA Contracts

```bash
# Parse arguments
SOURCE_DOME=$(echo "$ARGUMENTS" | awk '{print $1}')
TARGET_DOME=$(echo "$ARGUMENTS" | awk '{print $2}')

echo "Source: $SOURCE_DOME"
echo "Target: $TARGET_DOME"

# Load source contract
ls seeds/ | grep "${SOURCE_DOME:-exmorbus}"
```

```bash
cat seeds/<source_dome>-*.json 2>/dev/null | head -100 || cat seeds/exmorbus-v0.2.json
```

```bash
cat seeds/<target_dome>-*.json 2>/dev/null | head -100
```

---

## Step 2 — Identify High-Fitness Fields

From the source contract, identify `crossover_fields` (listed in `evolution.crossover_fields`).

For each crossover field, assess whether it would improve the target dome:

| Field | Transfer if... |
|---|---|
| `resource_priorities` | Target is missing high-value sources that worked in source |
| `fitness_evaluation_criteria` | Source has more refined criteria for overlapping domain |
| `diversity_enforcement` | Source discovered better overlap threshold |
| `mitosis_threshold` | Source achieved better efficiency with different threshold |
| `ancestor_performance.successful_niches` | Niche lessons are directly applicable to target domain |

---

## Step 3 — Design the Crossover

Select 1-3 fields to transfer. For each field:
1. Show the source value
2. Show the current target value
3. Propose the merged/replaced value
4. Explain why this improves target fitness

**Mutation rule:** Never simply copy — adapt the field for the target domain context.

Example: If transferring `resource_priorities` from ExMorbus to Disease Vectors:
- Keep target-specific sources (vector_base, who_disease_data)
- Add high-performing sources from source (pubmed_api position 1 was validated)
- Remove sources irrelevant to target domain

---

## Step 4 — Write Updated Target Contract

Apply the crossover fields to the target contract:

```bash
python3 << 'PYEOF'
import json

# Load target contract
with open('seeds/<target_dome>-*.json') as f:
    target = json.load(f)

# Apply crossover fields
# (Apply the designed mutations here)
target['contract_version'] = '<bump patch version>'
target['evolution']['last_gene_transfer'] = {
    'from_dome': '<source>',
    'to_dome': '<target>',
    'transferred_fields': ['<field1>'],
    'transfer_date': '<ISO date>'
}
target['created_at'] = '<ISO date now>'

with open('seeds/<target_dome>-v<new>.json', 'w') as f:
    json.dump(target, f, indent=2)
print('Updated contract written')
PYEOF
```

---

## Step 5 — Emit Transfer Events

Tool: `mcp__mouseion__emit_dome_event`
- `event_type`: "HORIZONTAL_GENE_TRANSFER"
- `source_dome_id`: `<source>`
- `target_dome_id`: `<target>`
- `payload`:
```json
{
  "transferred_fields": ["<field1>", "<field2>"],
  "source_fitness_rationale": "<why these fields were high-value in source>",
  "adaptation_applied": "<how fields were adapted for target domain>",
  "new_target_contract_version": "<version>"
}
```

Tool: `mcp__mouseion__write_dna_lessons`
- `lineage_id`: `<target_dome_lineage_id>`
- `lesson_type`: "insight"
- `lesson`: what cross-domain knowledge was transferred and why it applies

---

## Step 6 — Output

```json
{
  "agent_role": "gene_transfer",
  "finding_type": "cross_dome_evolution",
  "source_dome": "<id>",
  "target_dome": "<id>",
  "hypothesis": "Cross-domain knowledge transfer improves target dome fitness",
  "fields_transferred": ["<field1>"],
  "evidence": [{"source": "source_dome_performance", "claim": "<what metric improved in source>", "confidence": "medium"}],
  "novelty_claim": "FunSearch island migration: divergent populations exchange selected traits without merging",
  "actionability": "Run /dna-evolve on target dome to incorporate transferred fields",
  "resource_cost_estimate": {"tokens_used": 0, "model": "sonnet"}
}
```
