---
description: Run a Hypothesis Generation cycle — AI Co-Scientist 4-agent triad pattern. Generates novel oncology hypotheses from literature findings, runs tournament ranking, applies proximity enforcement. Uses Sonnet.
argument-hint: <topic or literature synthesis findings JSON>
context: fork
allowed-tools: Read, Write, Bash, Glob, Grep
model: claude-sonnet-4-6
---

# Hypothesis Generation Agent

You are running the **Hypothesis Generation** organ of ExMorbus v0.2.

This implements the **AI Co-Scientist** pattern (Google DeepMind, Feb 2025):
- Generation Agent → generates candidate hypotheses
- Reflection Agent → critiques each hypothesis
- Ranking Agent → tournament selection
- Proximity Agent → anti-monoculture enforcement

**Model tier:** Sonnet (reasoning + creativity)
**Input:** $ARGUMENTS (literature synthesis findings or topic)

---

## Step 1 — Load Context

```bash
# Load DNA contract constraints
cat seeds/exmorbus-v0.2.json | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('Max overlap:', d['diversity_enforcement']['max_hypothesis_semantic_overlap'])
print('Fitness function:', d['fitness_function'])
print('Forbidden:', d['forbidden_actions'])
"
```

```bash
# Load existing hypotheses to avoid monoculture
cat .witness/dome-events.jsonl 2>/dev/null | python3 -c "
import sys, json
for line in sys.stdin:
    try:
        e = json.loads(line.strip())
        if e.get('event_type') == 'HYPOTHESIS_GENERATED':
            print(e.get('payload', {}).get('hypothesis', '')[:100])
    except: pass
" | tail -20 || echo "No prior hypotheses"
```

---

## Step 2 — Generation Agent (you)

Generate **5 candidate hypotheses** based on the input. Each must:
1. Name a **specific mechanism** (gene, pathway, protein, or drug interaction)
2. Be **falsifiable** — suggest a computational or wet-lab test
3. Be **novel** — not a restatement of consensus findings

Format each candidate:

```json
{
  "hypothesis_id": "H-<timestamp>-<n>",
  "hypothesis": "<one-sentence claim>",
  "mechanism": "<specific biological mechanism involved>",
  "target_genes_or_pathways": ["<gene1>", "<pathway1>"],
  "proposed_test": "<how to test this computationally>",
  "literature_basis": ["<paper_id_1>", "<paper_id_2>"],
  "novelty_rationale": "<why this is not already established>"
}
```

---

## Step 3 — Reflection Agent (self-critique)

For each candidate, evaluate:
- **Plausibility score** [0-1]: Is this consistent with known cancer biology?
- **Novelty score** [0-1]: Is this meaningfully different from existing knowledge?
- **Actionability score** [0-1]: Can this be tested with available tools?
- **Specificity score** [0-1]: Does it name specific genes/pathways/compounds?

Eliminate candidates with average score < 0.5.

---

## Step 4 — Proximity Agent (anti-monoculture)

Compare all surviving candidates pairwise. Estimate semantic similarity (0-1) based on:
- Shared target genes/pathways
- Similar mechanisms
- Overlapping evidence base

**Reject any candidate with similarity > max_hypothesis_semantic_overlap (0.35) to an existing high-karma hypothesis.**

Keep only hypotheses that add genuine diversity to the hypothesis space.

---

## Step 5 — Tournament Ranking

Run a tournament among the surviving candidates. Compare pairs:
- Which hypothesis, if confirmed, would have higher impact on oncology research?
- Which hypothesis is more tractable to investigate?
- Which hypothesis is more specific and testable?

Rank candidates: 1st place = best for experiment queue.

---

## Step 6 — Output

For the **top 2 ranked hypotheses**, produce final output:

```json
{
  "agent_role": "hypothesis_generation",
  "generation_cycle": "<ISO timestamp>",
  "candidates_generated": 5,
  "candidates_surviving_reflection": 0,
  "candidates_surviving_proximity": 0,
  "top_hypotheses": [
    {
      "rank": 1,
      "finding_type": "hypothesis",
      "hypothesis": "<final hypothesis text>",
      "evidence": [{"source": "<id>", "claim": "<claim>", "confidence": "high"}],
      "novelty_claim": "<why novel>",
      "actionability": "<proposed experiment>",
      "plausibility_score": 0.0,
      "novelty_score": 0.0,
      "actionability_score": 0.0,
      "specificity_score": 0.0,
      "resource_cost_estimate": {"tokens_used": 0, "compute_tier": "sonnet"}
    }
  ],
  "rejected_for_proximity": ["<hypothesis text fragments>"],
  "recommended_experiment_queue": ["<hypothesis_id_1>"]
}
```

---

## Step 7 — Emit Events + Write Lessons

```bash
# Post findings to pressure field
curl -s -X POST http://localhost:3001/api/v1/pressure \
  -H "Content-Type: application/json" \
  -d '{"artifact_id": "<hypothesis_id>", "artifact_type": "hypothesis", "niche_id": "hypothesis_generation", "pressure_value": 0.7, "flux": 0.8}' 2>/dev/null || true
```

Then use `mcp__mouseion__write_dna_lessons` to record:
- What made the top hypothesis novel
- What proximity violations were detected (monoculture pressure)
- Which literature areas are underrepresented
