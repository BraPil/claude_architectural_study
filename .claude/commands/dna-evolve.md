---
description: Evolve the DNA contract for a dome based on organ performance data and ancestor lessons. Applies PromptBreeder-style self-referential mutation.
argument-hint: <dome_id or leave blank for current dome>
context: fork
allowed-tools: Read, Write, Bash
---

# DNA Contract Evolution

You are running a DNA contract evolution cycle using PromptBreeder-style self-referential mutation.

**Target dome:** $ARGUMENTS (default: exmorbus-v0.2)

## Process

**Step 1 — Load current contract**

```bash
cat seeds/exmorbus-v0.2.json
```

**Step 2 — Load performance evidence**

```bash
# Read witness logs for performance signals
cat .witness/dome-events.jsonl 2>/dev/null | tail -50 || echo "No events yet"
cat .witness/reflexion-buffer.jsonl 2>/dev/null | tail -20 || echo "No reflexion data yet"
```

**Step 3 — Apply the mutation prompt**

Read the `evolution.mutation_prompt` field from the contract. This is the self-referential instruction: the contract tells you how to mutate itself.

Follow the mutation prompt exactly. It will guide you to:
- Identify the lesson most likely to improve next-generation token efficiency
- Propose one targeted mutation as a JSON patch

**Step 4 — Validate the mutation**

Check the proposed mutation against these constraints:
- Does not remove required `forbidden_actions`
- Does not increase `mitosis_threshold` above 0.85 (agents would never split)
- Does not reduce `min_active_niches` below 2 (would allow monoculture)
- `max_hypothesis_semantic_overlap` stays between 0.20 and 0.60
- `crossover_fields` must be a subset of the original typed fields

**Step 4b — EWC++ Anti-Forgetting Check**

Apply Elastic Weight Consolidation++ (EWC++) principle to the mutation:
- Identify "important parameters" — fields that were responsible for previous successes in `ancestor_performance.successful_niches`
- Calculate estimated importance weight for each mutated field: `importance = peak_karma * token_efficiency` in the successful niche that used this field
- Apply EWC++ penalty: if a mutation reduces a high-importance field's value by more than 20%, flag it and require explicit justification
- High-importance fields (weight > 0.5): `resource_priorities`, `diversity_enforcement.max_hypothesis_semantic_overlap`, `fitness_function`
- Log the EWC++ check result in the mutation_summary as `ewc_penalty_avoided: true|false`

**Step 5 — Output evolved contract**

Produce the full updated DNA contract as a JSON object, with:
- `contract_version` incremented (semver patch bump)
- `parent_contract_id` set to the current contract's lineage_id + version
- `created_at` updated to now
- The mutation applied
- A new entry in `ancestor_performance.documented_failure_modes` if reflexion data reveals a new failure pattern

Save the evolved contract to `seeds/<dome_id>-evolved.json`.

Report the mutation as:

```json
{
  "mutation_summary": {
    "field_changed": "<field path>",
    "old_value": "<old>",
    "new_value": "<new>",
    "rationale": "<why this improves fitness>",
    "evidence_from_performance_data": "<what in the logs suggested this>"
  },
  "new_contract_version": "<semver>",
  "output_file": "seeds/<dome_id>-evolved.json"
}
```
