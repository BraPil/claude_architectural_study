---
description: Activate Test-Time Reinforcement Learning for novel oncology variant exploration. Uses TTRL pattern to generate and self-evaluate variants of existing high-fitness hypotheses, expanding into adjacent unexplored territory.
argument-hint: <hypothesis_id or hypothesis text to expand>
context: fork
allowed-tools: Read, Write, Bash, Glob, Grep
model: claude-opus-4-6
---

# TTRL Activation — Novel Variant Explorer

You are running **Test-Time Reinforcement Learning (TTRL)** for oncology variant discovery.

**Pattern:** TTRL (Tencent, 2025) — self-improvement at inference time without weight updates:
- Generate variants of a proven hypothesis
- Self-evaluate variants against the fitness function
- Select and propagate the highest-scoring variants
- Apply to adjacent biological space not yet explored

**Purpose:** Expand confirmed high-quality hypotheses into novel adjacent territory.
**Input:** $ARGUMENTS (hypothesis to expand)
**Model tier:** Opus (creative generation + rigorous self-evaluation)

---

## Step 1 — Load Seed Hypothesis

If $ARGUMENTS is a hypothesis ID, look it up in experiment results:
```bash
ls .witness/experiments/ 2>/dev/null | head -10
cat .witness/experiments/<hypothesis_id>.json 2>/dev/null || echo "Using provided text"
```

If $ARGUMENTS is a text hypothesis, structure it:
- `hypothesis`: the core claim
- `mechanism`: biological mechanism involved
- `evidence`: known supporting evidence
- `target_genes_or_pathways`: specific biological entities

Load fitness evaluation criteria:
```bash
cat seeds/exmorbus-v0.2.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(json.dumps(d.get('fitness_evaluation_criteria', {}), indent=2))
"
```

---

## Step 2 — Generate Variants (TTRL Generation)

Generate **6 variants** of the seed hypothesis by applying these mutation operators:

| Operator | Description |
|---|---|
| `pathway_shift` | Same mechanism, different pathway |
| `tissue_specificity` | Same mechanism, different cancer type |
| `upstream_cause` | What causes the mechanism? |
| `downstream_effect` | What does the mechanism enable? |
| `temporal_variant` | Same mechanism at different disease stage |
| `drug_intervention` | Can the mechanism be drugged? |

For each variant:
```json
{
  "variant_id": "VAR-<seed_id>-<n>",
  "seed_hypothesis_id": "<id>",
  "mutation_operator": "<operator>",
  "variant_hypothesis": "<the new hypothesis text>",
  "mechanism_delta": "<what changed vs. seed>",
  "novel_prediction": "<what this uniquely predicts>",
  "required_evidence": ["<what data would confirm this>"]
}
```

---

## Step 3 — Self-Evaluation (TTRL Reward Signal)

For each variant, evaluate against the ExMorbus fitness criteria:

**Scoring rubric:**
- `novelty` [0-1]: Is this meaningfully different from both the seed AND existing literature?
- `plausibility` [0-1]: Does the biological logic hold? Are there any obvious contradictions?
- `actionability` [0-1]: Can this be tested computationally? Is there data available?
- `specificity` [0-1]: Does it name specific molecules/genes/pathways?
- `diversity_bonus` [0-1]: Does it cover an underrepresented cancer type or mechanism class?

**Composite TTRL score:** `(novelty*0.3 + plausibility*0.25 + actionability*0.25 + specificity*0.1 + diversity_bonus*0.1)`

Eliminate variants with score < 0.5.

---

## Step 4 — Proximity Check

Apply the proximity rule from the DNA contract (`max_hypothesis_semantic_overlap = 0.35`):
- Compare each surviving variant to the seed hypothesis
- Compare variants to each other
- Reject any with overlap > 0.35

---

## Step 5 — TTRL Selection

Rank surviving variants by TTRL score. Select the **top 2**.

For each selected variant, decide the next action:
- Score > 0.8 → Send directly to `/experiment-design` queue
- Score 0.6-0.8 → Send to `/hypothesis-gen` for further refinement
- Score 0.5-0.6 → Archive as weak signal, monitor

---

## Step 6 — Output

```json
{
  "agent_role": "ttrl_activation",
  "seed_hypothesis_id": "<id>",
  "finding_type": "hypothesis_expansion",
  "hypothesis": "<the strongest selected variant>",
  "variants_generated": 6,
  "variants_surviving_evaluation": 0,
  "variants_surviving_proximity": 0,
  "top_variants": [
    {
      "variant_id": "<id>",
      "variant_hypothesis": "<text>",
      "ttrl_score": 0.0,
      "mutation_operator": "<operator>",
      "recommended_next_step": "experiment_design|hypothesis_gen|archive",
      "evidence": [],
      "novelty_claim": "<what is new>",
      "actionability": "<how to test>"
    }
  ],
  "coverage_expanded": ["<cancer_types_or_mechanisms_now_covered>"],
  "evidence": [{"source": "seed_hypothesis", "claim": "<seed mechanism>", "confidence": "high"}],
  "novelty_claim": "TTRL expansion maps adjacent biological territory from confirmed seed hypothesis",
  "actionability": "Queue top variants for experiment design: /experiment-design <variant_id>",
  "resource_cost_estimate": {"tokens_used": 0, "model": "opus"}
}
```

---

## Step 7 — Write Lessons + Emit

For top variants, emit:
- Tool: `mcp__mouseion__emit_dome_event`
- `event_type`: "KNOWLEDGE_TRANSFER"
- `payload`: `{"source": "ttrl_expansion", "variants": [...], "seed_id": "..."}`

Write TTRL lesson:
- Tool: `mcp__mouseion__write_dna_lessons`
- `lesson_type`: "insight"
- `lesson`: which mutation operators produced the highest TTRL scores, and which cancer types are still underexplored
- `evidence`: variant IDs and their scores
